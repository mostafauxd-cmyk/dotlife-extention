import {
  acceptPush,
  keyOf,
  MAX_RECORD_BYTES,
  pullPage,
  supersedes,
  type Change,
  type Local as Held,
  type ServerChange,
} from "@dotlife/sync";
import { describe, expect, it } from "vitest";

import { batch, syncOnce, type Local, type Remote } from "../src/sync/engine";

/** The server's own rules, in memory. */
class Server {
  records = new Map<string, ServerChange>();
  rev = 0;
  // after every edit in these tests, so no stamp is pulled back to «now»
  now = new Date(Date.UTC(2026, 9, 13, 12, 0));
  remote(onPush?: () => void): Remote {
    return {
      push: (changes) => {
        onPush?.();
        const r = acceptPush(this.records, changes, this.rev, this.now);
        for (const w of r.write) this.records.set(keyOf(w), w);
        this.rev = r.rev;
        return Promise.resolve({ rev: r.rev, rejected: r.rejected });
      },
      pull: (since) => {
        const reset = since > this.rev;
        const p = pullPage([...this.records.values()], reset ? 0 : since, 3);
        return Promise.resolve(reset ? { ...p, reset: true } : p);
      },
    };
  }
}

/** A phone's tables, in memory. */
class Phone implements Local {
  rows = new Map<string, Change>();
  outbox = new Set<string>();
  rev = 0;
  edit(id: string, data: unknown, min: number, entity: Change["entity"] = "task"): void {
    const c: Change = {
      entity,
      id,
      data,
      changedAt: new Date(Date.UTC(2026, 9, 12, 10, min)).toISOString(),
    };
    this.rows.set(keyOf(c), c);
    this.outbox.add(keyOf(c));
  }
  dirty(limit: number) {
    return Promise.resolve(
      [...this.outbox].slice(0, limit).flatMap((k) => {
        const c = this.rows.get(k);
        return c === undefined ? [] : [c];
      }),
    );
  }
  get(entity: string, id: string): Promise<Held | undefined> {
    const k = `${entity}/${id}`;
    const c = this.rows.get(k);
    return Promise.resolve(c === undefined ? undefined : { change: c, dirty: this.outbox.has(k) });
  }
  adopt(changes: readonly Change[], settled: readonly string[]) {
    for (const k of settled) this.outbox.delete(k);
    for (const c of changes) this.rows.set(keyOf(c), c);
    return Promise.resolve();
  }
  settle(sent: readonly Change[]) {
    for (const c of sent) {
      if (this.rows.get(keyOf(c))?.changedAt === c.changedAt) this.outbox.delete(keyOf(c));
    }
    return Promise.resolve();
  }
  markAllDirty() {
    for (const k of this.rows.keys()) this.outbox.add(k);
    return Promise.resolve();
  }
  cursor() {
    return Promise.resolve(this.rev);
  }
  setCursor(rev: number) {
    this.rev = rev;
    return Promise.resolve();
  }
  view() {
    return new Map([...this.rows].map(([k, c]) => [k, c.data]));
  }
}

describe("syncOnce", () => {
  it("a phone's backup reaches a new phone (the returning user)", async () => {
    const server = new Server();
    const old = new Phone();
    old.edit("t1", { title: "خرید" }, 1);
    old.edit("n1", { text: "یادداشت" }, 2, "note");
    old.edit("personalization", { id: "personalization", value: "{}" }, 3, "setting");
    await syncOnce(old, server.remote());
    expect(old.outbox.size).toBe(0);

    const fresh = new Phone();
    const adopted = await syncOnce(fresh, server.remote());
    expect(adopted.map((c) => c.id).sort()).toEqual(["n1", "personalization", "t1"]);
    expect(fresh.view()).toEqual(old.view());
    expect(fresh.rev).toBe(server.rev);
  });

  it("one record over the server's size limit does not stop the others from going", async () => {
    const server = new Server();
    const plain = server.remote();
    // like the real server: one record over the limit and the whole push is refused
    const strict: Remote = {
      ...plain,
      push: (changes) =>
        changes.some((c) => JSON.stringify(c.data).length > MAX_RECORD_BYTES)
          ? Promise.reject(new Error("bad_request"))
          : plain.push(changes),
    };
    const phone = new Phone();
    phone.edit("huge", { text: "x".repeat(MAX_RECORD_BYTES + 1) }, 1, "note");
    phone.edit("t1", { title: "خرید" }, 2);
    await syncOnce(phone, strict);
    expect([...server.records.keys()]).toEqual(["task/t1"]);
    // still on the phone, waiting
    expect([...phone.outbox]).toEqual(["note/huge"]);
  });

  it("two phones end with each record's latest edit, deletions included", async () => {
    const server = new Server();
    const a = new Phone();
    const b = new Phone();
    a.edit("t1", { v: "a1" }, 1);
    a.edit("t2", { v: "a2" }, 1);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    a.edit("t1", { v: "a-later" }, 9);
    b.edit("t1", { v: "b-earlier" }, 5);
    b.edit("t2", null, 6);
    await syncOnce(b, server.remote());
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    expect(a.view()).toEqual(b.view());
    expect(a.view().get("task/t1")).toEqual({ v: "a-later" });
    expect(a.view().get("task/t2")).toBeNull();
  });

  it("a record edited while its push was on the way is sent again, in the same sync", async () => {
    const server = new Server();
    const p = new Phone();
    p.edit("t1", { v: 1 }, 1);
    let edits = 0;
    await syncOnce(
      p,
      server.remote(() => {
        // the person keeps typing during the first push only
        if (edits++ === 0) p.edit("t1", { v: 2 }, 2);
      }),
    );
    expect(server.records.get("task/t1")?.data).toEqual({ v: 2 });
    expect(p.outbox.size).toBe(0);
  });

  it("does not loop when a record keeps changing during every push", async () => {
    const server = new Server();
    const p = new Phone();
    p.edit("t1", { v: 0 }, 0);
    let n = 0;
    await syncOnce(
      p,
      server.remote(() => {
        n++;
        p.edit("t1", { v: n }, n);
      }),
    );
    expect(n).toBeLessThan(600);
    // the latest edit waits for the next sync
    expect(p.outbox.has("task/t1")).toBe(true);
  });

  it("sends everything again when the server went back to an older copy", async () => {
    const server = new Server();
    const p = new Phone();
    p.edit("t1", { v: 1 }, 1);
    p.edit("t2", { v: 2 }, 2);
    await syncOnce(p, server.remote());
    // the server restored from a backup taken before any of this
    server.records.clear();
    server.rev = 0;
    await syncOnce(p, server.remote());
    expect([...server.records.keys()].sort()).toEqual(["task/t1", "task/t2"]);
    expect(p.outbox.size).toBe(0);
  });

  it("splits a big backlog into several pushes", () => {
    const many: Change[] = Array.from({ length: 1200 }, (_, i) => ({
      entity: "note",
      id: String(i),
      data: { body: "x".repeat(4000) },
      changedAt: "2026-10-12T10:00:00.000Z",
    }));
    const first = batch(many);
    expect(first.length).toBeLessThanOrEqual(500);
    expect(JSON.stringify(first).length).toBeLessThan(2 * 1024 * 1024 + 4096);
    const huge: Change = {
      entity: "note",
      id: "big",
      changedAt: "2026-10-12T10:00:00.000Z",
      data: { body: "x".repeat(3 * 1024 * 1024) },
    };
    expect(batch([huge])).toHaveLength(1);
  });

  it("random edits on three phones settle on each record's latest edit", async () => {
    let seed = 42;
    const r = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let x = seed;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const server = new Server();
    const phones = [new Phone(), new Phone(), new Phone()];
    const edits: Change[] = [];
    for (let step = 1; step <= 300; step++) {
      const p = phones[Math.floor(r() * 3)];
      if (p === undefined) continue;
      if (r() < 0.7) {
        const id = `t${String(Math.floor(r() * 8))}`;
        p.edit(id, r() < 0.15 ? null : { v: step }, step);
        const made = p.rows.get(`task/${id}`);
        if (made !== undefined) edits.push(made);
      } else {
        await syncOnce(p, server.remote());
      }
    }
    for (let i = 0; i < 2; i++) for (const p of phones) await syncOnce(p, server.remote());
    const latest = new Map<string, Change>();
    for (const e of edits) {
      const h = latest.get(keyOf(e));
      if (h === undefined || supersedes(e, h)) latest.set(keyOf(e), e);
    }
    const truth = new Map([...latest].map(([k, c]) => [k, c.data]));
    for (const p of phones) expect(p.view()).toEqual(truth);
  });
});
