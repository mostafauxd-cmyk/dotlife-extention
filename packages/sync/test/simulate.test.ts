import { describe, expect, it } from "vitest";

import {
  acceptPush,
  applyPull,
  keyOf,
  pullPage,
  settlePush,
  supersedes,
  type Change,
  type Local,
  type ServerChange,
} from "../src";

/**
 * Phones and a server running the real rules on random edits, syncing in random order. Whatever
 * happens, after everyone syncs twice all phones hold exactly what the server holds.
 */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Server {
  records = new Map<string, ServerChange>();
  rev = 0;
}

class Phone {
  records = new Map<string, Local>();
  cursor = 0;
  constructor(readonly skewMs: number) {}

  edit(id: string, data: unknown, now: number): Change {
    const c: Change = {
      entity: "note",
      id,
      data,
      changedAt: new Date(now + this.skewMs).toISOString(),
    };
    this.records.set(keyOf(c), { change: c, dirty: true });
    return c;
  }

  sync(server: Server, now: number, page: number): void {
    const sent = [...this.records.values()].filter((l) => l.dirty).map((l) => l.change);
    const res = acceptPush(server.records, sent, server.rev, new Date(now));
    for (const w of res.write) server.records.set(keyOf(w), w);
    server.rev = res.rev;
    for (const key of settlePush(sent, (k) => this.records.get(k)?.change)) {
      const l = this.records.get(key);
      if (l !== undefined) l.dirty = false;
    }
    this.take(res.rejected);
    for (;;) {
      const p = pullPage([...server.records.values()], this.cursor, page);
      this.take(p.changes);
      this.cursor = p.rev;
      if (!p.more) break;
    }
  }

  private take(changes: readonly ServerChange[]): void {
    const { adopt, settled } = applyPull((k) => this.records.get(k), changes);
    for (const key of settled) {
      const l = this.records.get(key);
      if (l !== undefined) l.dirty = false;
    }
    for (const c of adopt) this.records.set(keyOf(c), { change: c, dirty: false });
  }

  view(): Map<string, unknown> {
    return new Map([...this.records].map(([k, l]) => [k, l.change.data]));
  }
}

function run(seed: number, skews: number[]) {
  const r = rng(seed);
  const server = new Server();
  const phones = skews.map((s) => new Phone(s));
  const edits: Change[] = [];
  let now = Date.UTC(2026, 9, 11, 9, 0);
  for (let step = 0; step < 400; step++) {
    now += Math.floor(r() * 90_000);
    const phone = phones[Math.floor(r() * phones.length)];
    if (phone === undefined) continue;
    if (r() < 0.7) {
      const id = `n${String(Math.floor(r() * 12))}`;
      const data = r() < 0.15 ? null : { text: String(step), pinned: r() < 0.5 };
      edits.push(phone.edit(id, data, now));
    } else {
      phone.sync(server, now, 1 + Math.floor(r() * 4));
    }
  }
  for (let round = 0; round < 2; round++) {
    for (const p of phones) p.sync(server, (now += 1000), 3);
  }
  return { server, phones, edits };
}

describe("sync simulation", () => {
  it("phones with good clocks converge on the latest edit of every record", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { server, phones, edits } = run(seed, [0, 0, 0]);
      const truth = new Map<string, unknown>([...server.records].map(([k, c]) => [k, c.data]));
      for (const p of phones) expect(p.view()).toEqual(truth);
      expect(phones.every((p) => [...p.records.values()].every((l) => !l.dirty))).toBe(true);
      // the winner of each record is its latest edit
      const latest = new Map<string, Change>();
      for (const e of edits) {
        const have = latest.get(keyOf(e));
        if (have === undefined || supersedes(e, have)) latest.set(keyOf(e), e);
      }
      expect(new Map([...latest].map(([k, c]) => [k, c.data]))).toEqual(truth);
    }
  });

  it("phones with clocks behind or far ahead still converge", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { server, phones } = run(seed, [0, -3 * 60_000, 40 * 60_000]);
      const truth = new Map<string, unknown>([...server.records].map(([k, c]) => [k, c.data]));
      for (const p of phones) expect(p.view()).toEqual(truth);
    }
  });
});
