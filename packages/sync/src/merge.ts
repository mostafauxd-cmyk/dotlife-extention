import { keyOf, type Change, type ServerChange } from "./change";

/**
 * How two versions of one record are settled (v1, PLAN §9): the later change wins, whole record.
 * Every side — each phone and the server — decides the same way from the two versions alone, so
 * they end up equal whichever order changes arrive in. Field-by-field merging (two phones editing
 * different occurrences of one series) is for a later version.
 */

/**
 * Whether `a` replaces `b`: the later `changedAt`; on a tie a removal, then the larger JSON — any
 * fixed order would do, as long as everyone uses the same one.
 */
export function supersedes(a: Change, b: Change): boolean {
  const ta = Date.parse(a.changedAt);
  const tb = Date.parse(b.changedAt);
  if (ta !== tb) return ta > tb;
  if ((a.data === null) !== (b.data === null)) return a.data === null;
  return JSON.stringify(a.data) > JSON.stringify(b.data);
}

/** How far ahead of the server a phone's clock may run before its stamps are pulled back. */
export const MAX_CLOCK_AHEAD_MS = 5 * 60 * 1000;

/**
 * A change stamped in the future (a phone whose clock runs ahead) is taken as made now; otherwise
 * it would win against every later edit from other phones until that time came.
 */
export function clampClock(c: Change, now: Date): Change {
  if (Date.parse(c.changedAt) <= now.getTime() + MAX_CLOCK_AHEAD_MS) return c;
  return { ...c, changedAt: now.toISOString() };
}

// ---- server ----

/**
 * A push, as the server takes it: each change that supersedes the stored version is written with
 * the next rev; the others are rejected with the stored version, which the phone then adopts.
 * `stored` is the account's current version of each pushed record (absent = never seen).
 */
export function acceptPush(
  stored: ReadonlyMap<string, ServerChange>,
  incoming: readonly Change[],
  rev: number,
  now: Date,
): { write: ServerChange[]; rejected: ServerChange[]; rev: number } {
  const latest = new Map(stored);
  const write = new Map<string, ServerChange>();
  let next = rev;
  for (const raw of incoming) {
    const c = clampClock(raw, now);
    const key = keyOf(c);
    const have = latest.get(key);
    if (have !== undefined && !supersedes(c, have)) continue;
    next += 1;
    const sc: ServerChange = {
      entity: c.entity,
      id: c.id,
      data: c.data,
      changedAt: c.changedAt,
      rev: next,
    };
    latest.set(key, sc);
    write.set(key, sc);
  }
  // rejected: every pushed record whose final server version is not the one this phone sent
  const rejected = new Map<string, ServerChange>();
  for (const raw of incoming) {
    const key = keyOf(raw);
    const final = latest.get(key);
    if (final !== undefined && !write.has(key)) rejected.set(key, final);
  }
  return { write: [...write.values()], rejected: [...rejected.values()], rev: next };
}

/** One pull page: records changed after `since`, oldest first; `all` is one version per record. */
export function pullPage(
  all: readonly ServerChange[],
  since: number,
  limit: number,
): { changes: ServerChange[]; rev: number; more: boolean } {
  const after = all.filter((c) => c.rev > since).sort((a, b) => a.rev - b.rev);
  const changes = after.slice(0, limit);
  return {
    changes,
    rev: changes.length === 0 ? since : (changes[changes.length - 1]?.rev ?? since),
    more: after.length > limit,
  };
}

// ---- phone ----

/** A record as the phone holds it, and whether it waits in the outbox. */
export type Local = { change: Change; dirty: boolean };

/**
 * Changes from the server, as the phone takes them: each replaces the local record unless the
 * phone has an unsent change that supersedes it (that one is pushed next and wins there too).
 * `settled` are outbox keys to drop: a local unsent change the server's version beat.
 */
export function applyPull(
  local: (key: string) => Local | undefined,
  incoming: readonly ServerChange[],
): { adopt: Change[]; settled: string[] } {
  const adopt: Change[] = [];
  const settled: string[] = [];
  for (const sc of incoming) {
    const key = keyOf(sc);
    const mine = local(key);
    const c: Change = { entity: sc.entity, id: sc.id, data: sc.data, changedAt: sc.changedAt };
    if (mine?.dirty === true) {
      if (supersedes(mine.change, c)) continue;
      settled.push(key);
    }
    adopt.push(c);
  }
  return { adopt, settled };
}

/**
 * After a push: the outbox keys that are done — sent, and not changed again on the phone while the
 * push was on its way (those stay for the next push). Rejected ones are adopted by `applyPull`.
 */
export function settlePush(
  sent: readonly Change[],
  current: (key: string) => Change | undefined,
): string[] {
  return sent
    .filter((c) => {
      const now = current(keyOf(c));
      return now !== undefined && now.changedAt === c.changedAt;
    })
    .map(keyOf);
}
