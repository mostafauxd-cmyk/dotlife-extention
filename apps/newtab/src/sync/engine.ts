import {
  applyPull,
  keyOf,
  MAX_PUSH,
  MAX_PUSH_BYTES,
  MAX_RECORD_BYTES,
  type Change,
  type Local as Held,
  type PullResponse,
  type PushResponse,
  type ServerChange,
} from "@dotlife/sync";

/**
 * One sync, over the rules in @dotlife/sync: send what changed here, take what changed elsewhere.
 * A copy of the phone's own engine (dotlife `apps/mobile/src/sync/engine.ts`), so the new tab pushes
 * and pulls exactly as the app does. Pure — this device's records and the server come in as `Local`
 * and `Remote`, and the tests run it against the server's own rules.
 */

/** The phone's side: its records, the outbox, and how far it has pulled. */
export type Local = {
  /** Changed records waiting to be sent (the outbox), oldest first; `changedAt` = written. */
  dirty: (limit: number) => Promise<Change[]>;
  /** One record as held, and whether it waits in the outbox. */
  get: (entity: string, id: string) => Promise<Held | undefined>;
  /** Write what came from the server (no outbox), and drop `settled` keys from the outbox. */
  adopt: (changes: readonly Change[], settled: readonly string[]) => Promise<void>;
  /** Drop sent records from the outbox, unless they changed again while on their way. */
  settle: (sent: readonly Change[]) => Promise<void>;
  /** Every record back into the outbox (the server lost them: restored from an old backup). */
  markAllDirty: () => Promise<void>;
  cursor: () => Promise<number>;
  setCursor: (rev: number) => Promise<void>;
};

export type Remote = {
  push: (changes: readonly Change[]) => Promise<PushResponse>;
  pull: (since: number) => Promise<PullResponse>;
};

/** Up to `MAX_PUSH` changes whose JSON stays under `MAX_PUSH_BYTES` (one always goes). */
export function batch(changes: readonly Change[]): Change[] {
  const out: Change[] = [];
  let bytes = 0;
  for (const c of changes) {
    const size = JSON.stringify(c).length + 1;
    if (out.length > 0 && (out.length >= MAX_PUSH || bytes + size > MAX_PUSH_BYTES)) break;
    out.push(c);
    bytes += size;
  }
  return out;
}

/** Server versions into the phone, except where an unsent change on the phone is newer. */
async function take(local: Local, incoming: readonly ServerChange[]): Promise<Change[]> {
  if (incoming.length === 0) return [];
  const held = new Map<string, Held>();
  for (const c of incoming) {
    const h = await local.get(c.entity, c.id);
    if (h !== undefined) held.set(keyOf(c), h);
  }
  const { adopt, settled } = applyPull((k) => held.get(k), incoming);
  await local.adopt(adopt, settled);
  return adopt;
}

/** How often one sync sends the same record: a record edited during its own push goes again once. */
const SENDS_PER_SYNC = 2;

async function pushAll(local: Local, remote: Remote): Promise<Change[]> {
  const adopted: Change[] = [];
  const sends = new Map<string, number>();
  for (;;) {
    const waiting = await local.dirty(MAX_PUSH * 2);
    // sent already, unchanged since: the server has it. Sent twice and still changing (someone
    // typing through the sync): it waits for the next sync, so this loop always ends
    const fresh = waiting.filter((c) => {
      // the server refuses the whole push for one record over its limit: such a record stays on
      // the phone (and in the outbox) instead of stopping every other one from being backed up
      if (c.data !== null && JSON.stringify(c.data).length > MAX_RECORD_BYTES) return false;
      const n = sends.get(keyOf(c)) ?? 0;
      return n < SENDS_PER_SYNC && !sends.has(`${keyOf(c)}@${c.changedAt}`);
    });
    if (fresh.length === 0) return adopted;
    const sent = batch(fresh);
    for (const c of sent) {
      sends.set(keyOf(c), (sends.get(keyOf(c)) ?? 0) + 1);
      sends.set(`${keyOf(c)}@${c.changedAt}`, 1);
    }
    const res = await remote.push(sent);
    await local.settle(sent);
    adopted.push(...(await take(local, res.rejected)));
  }
}

async function pullAll(
  local: Local,
  remote: Remote,
): Promise<{ adopted: Change[]; reset: boolean }> {
  const adopted: Change[] = [];
  let reset = false;
  let since = await local.cursor();
  for (;;) {
    const page = await remote.pull(since);
    if (page.reset === true && !reset) {
      // the server went back to an older copy: everything this phone has goes up again
      reset = true;
      await local.markAllDirty();
    }
    adopted.push(...(await take(local, page.changes)));
    since = page.rev;
    await local.setCursor(since);
    if (!page.more) return { adopted, reset };
  }
}

/**
 * Push, then pull (then push again if the server had lost data). Resolves with every record the
 * phone took from the server, for the app to show.
 */
export async function syncOnce(local: Local, remote: Remote): Promise<Change[]> {
  const adopted = await pushAll(local, remote);
  const pulled = await pullAll(local, remote);
  adopted.push(...pulled.adopted);
  if (pulled.reset) adopted.push(...(await pushAll(local, remote)));
  return adopted;
}
