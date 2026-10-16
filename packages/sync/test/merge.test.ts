import { describe, expect, it } from "vitest";

import {
  acceptPush,
  applyPull,
  clampClock,
  ChangeSchema,
  keyOf,
  pullPage,
  PushRequestSchema,
  settlePush,
  supersedes,
  type Change,
  type ServerChange,
} from "../src";

const at = (min: number): string => new Date(Date.UTC(2026, 9, 11, 10, min)).toISOString();
const ch = (id: string, data: unknown, min: number): Change => ({
  entity: "task",
  id,
  data,
  changedAt: at(min),
});
const NOW = new Date(Date.UTC(2026, 9, 11, 12, 0));

describe("supersedes", () => {
  it("the later change wins", () => {
    expect(supersedes(ch("a", { t: 1 }, 2), ch("a", { t: 2 }, 1))).toBe(true);
    expect(supersedes(ch("a", { t: 1 }, 1), ch("a", { t: 2 }, 2))).toBe(false);
  });

  it("on a tie, a removal wins, then a fixed order — the same from both sides", () => {
    expect(supersedes(ch("a", null, 1), ch("a", { t: 1 }, 1))).toBe(true);
    expect(supersedes(ch("a", { t: 1 }, 1), ch("a", null, 1))).toBe(false);
    const x = ch("a", { t: "x" }, 1);
    const y = ch("a", { t: "y" }, 1);
    expect(supersedes(x, y)).not.toBe(supersedes(y, x));
    expect(supersedes(x, x)).toBe(false);
  });

  it("compares instants, not strings (offsets)", () => {
    const a = { ...ch("a", {}, 0), changedAt: "2026-10-11T13:30:00.000+03:30" };
    const b = { ...ch("a", {}, 0), changedAt: "2026-10-11T10:00:30.000Z" };
    expect(supersedes(b, a)).toBe(true);
  });
});

describe("clampClock", () => {
  it("leaves a stamp in the past or a little ahead, pulls a far-future one back to now", () => {
    const fine = { ...ch("a", {}, 0), changedAt: new Date(NOW.getTime() + 60_000).toISOString() };
    expect(clampClock(fine, NOW)).toBe(fine);
    const ahead = { ...ch("a", {}, 0), changedAt: "2027-01-01T00:00:00.000Z" };
    expect(clampClock(ahead, NOW).changedAt).toBe(NOW.toISOString());
  });
});

describe("acceptPush", () => {
  it("writes new and newer records with rising revs, rejects older ones with the stored version", () => {
    const stored = new Map<string, ServerChange>([
      [keyOf(ch("old", 0, 0)), { ...ch("old", { v: "server" }, 5), rev: 3 }],
      [keyOf(ch("mine", 0, 0)), { ...ch("mine", { v: "server" }, 1), rev: 2 }],
    ]);
    const r = acceptPush(
      stored,
      [ch("new", { v: 1 }, 2), ch("old", { v: "phone" }, 4), ch("mine", { v: "phone" }, 3)],
      3,
      NOW,
    );
    expect(r.write.map((w) => [w.id, w.rev])).toEqual([
      ["new", 4],
      ["mine", 5],
    ]);
    expect(r.rejected.map((w) => [w.id, w.data])).toEqual([["old", { v: "server" }]]);
    expect(r.rev).toBe(5);
  });

  it("a repeated push (the answer was lost) changes nothing", () => {
    const first = acceptPush(new Map(), [ch("a", { v: 1 }, 1)], 0, NOW);
    const stored = new Map(first.write.map((w) => [keyOf(w), w]));
    const again = acceptPush(stored, [ch("a", { v: 1 }, 1)], first.rev, NOW);
    expect(again.write).toEqual([]);
    expect(again.rev).toBe(first.rev);
  });
});

describe("pullPage", () => {
  const all: ServerChange[] = [1, 2, 3, 4, 5].map((rev) => ({
    ...ch(`r${String(rev)}`, {}, rev),
    rev,
  }));

  it("pages after the cursor in rev order", () => {
    const p1 = pullPage(all, 1, 2);
    expect(p1.changes.map((c) => c.rev)).toEqual([2, 3]);
    expect(p1).toMatchObject({ rev: 3, more: true });
    const p2 = pullPage(all, p1.rev, 2);
    expect(p2).toMatchObject({ rev: 5, more: false });
    expect(pullPage(all, 5, 2)).toEqual({ changes: [], rev: 5, more: false });
  });
});

describe("applyPull and settlePush", () => {
  it("keeps a newer unsent local change, takes the server's otherwise", () => {
    const local = new Map([
      ["task/a", { change: ch("a", { v: "phone" }, 5), dirty: true }],
      ["task/b", { change: ch("b", { v: "phone" }, 1), dirty: true }],
      ["task/c", { change: ch("c", { v: "phone" }, 9), dirty: false }],
    ]);
    const { adopt, settled } = applyPull(
      (k) => local.get(k),
      [
        { ...ch("a", { v: "server" }, 3), rev: 1 },
        { ...ch("b", { v: "server" }, 3), rev: 2 },
        { ...ch("c", { v: "server" }, 3), rev: 3 },
      ],
    );
    expect(adopt.map((c) => c.id)).toEqual(["b", "c"]);
    expect(settled).toEqual(["task/b"]);
  });

  it("leaves a record changed again during the push in the outbox", () => {
    const sent = [ch("a", { v: 1 }, 1), ch("b", { v: 1 }, 1)];
    const current = new Map([
      ["task/a", ch("a", { v: 1 }, 1)],
      ["task/b", ch("b", { v: 2 }, 2)],
    ]);
    expect(settlePush(sent, (k) => current.get(k))).toEqual(["task/a"]);
  });
});

describe("wire format", () => {
  it("accepts objects and removals, refuses arrays, unknown kinds and bad stamps", () => {
    expect(ChangeSchema.safeParse(ch("a", { t: 1 }, 1)).success).toBe(true);
    expect(ChangeSchema.safeParse(ch("a", null, 1)).success).toBe(true);
    expect(ChangeSchema.safeParse(ch("a", [1], 1)).success).toBe(false);
    expect(ChangeSchema.safeParse({ ...ch("a", {}, 1), entity: "wallet" }).success).toBe(false);
    expect(ChangeSchema.safeParse({ ...ch("a", {}, 1), changedAt: "yesterday" }).success).toBe(
      false,
    );
    const big = ch("a", { body: "x".repeat(300 * 1024) }, 1);
    expect(ChangeSchema.safeParse(big).success).toBe(false);
    expect(PushRequestSchema.safeParse({ changes: [] }).success).toBe(true);
  });
});
