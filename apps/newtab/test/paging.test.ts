import { describe, expect, it } from "vitest";

import { createWheelGate, wheelPixels, type WheelVerdict } from "../src/ui/paging";

/** A page turn takes this long in the real thing (ui/paging.ts, between 360 and 720 ms). */
const ANIM = 500;

type Ev = { t: number; dy: number; card?: boolean };

/** Plays events through the gate the way the paging does: a page turn makes the page "move" for ANIM ms. */
function play(events: readonly Ev[]): {
  turns: { t: number; dir: 1 | -1 }[];
  verdicts: WheelVerdict[];
} {
  const gate = createWheelGate();
  let movingUntil = -1;
  const turns: { t: number; dir: 1 | -1 }[] = [];
  const verdicts: WheelVerdict[] = [];
  for (const e of events) {
    const v = gate(e.dy, e.t, e.t < movingUntil, e.card ?? false);
    verdicts.push(v);
    if (v === 1 || v === -1) {
      turns.push({ t: e.t, dir: v });
      movingUntil = e.t + ANIM;
    }
  }
  return { turns, verdicts };
}

/** A trackpad flick: events every 16 ms, strong at first and fading like momentum. */
function flick(t0: number, ms: number, peak: number, dir: 1 | -1 = 1, jitter = 0): Ev[] {
  const out: Ev[] = [];
  for (let t = 0; t < ms; t += 16) {
    const k = Math.exp((-3 * t) / ms);
    const wobble = jitter === 0 ? 0 : ((t / 16) % 3) * jitter - jitter;
    out.push({ t: t0 + t, dy: dir * Math.max(1, Math.round(peak * k + wobble)) });
  }
  return out;
}

describe("the wheel gate", () => {
  it("turns one page for a whole trackpad flick, momentum and all", () => {
    for (const ms of [400, 800, 1200]) {
      expect(play(flick(0, ms, 90)).turns).toHaveLength(1);
    }
  });

  it("does not turn a second page on a noisy tail", () => {
    expect(play(flick(0, 1200, 90, 1, 6)).turns).toHaveLength(1);
    expect(play(flick(0, 1200, 60, -1, 8)).turns).toHaveLength(1);
  });

  it("turns another page for a flick after a pause", () => {
    const { turns } = play([...flick(0, 700, 90), ...flick(1400, 700, 90)]);
    expect(turns.map((x) => x.dir)).toEqual([1, 1]);
  });

  it("turns back at once when the direction changes after the page settled", () => {
    const { turns } = play([...flick(0, 900, 90), ...flick(900, 300, 70, -1)]);
    expect(turns.map((x) => x.dir)).toEqual([1, -1]);
  });

  it("takes a push stronger than the tail as a new flick", () => {
    const tail = flick(0, 900, 90);
    const again = flick(900, 500, 120).map((e) => e);
    // the tail's weakest point is a few pixels; this push is far above it
    const { turns } = play([...tail, ...again]);
    expect(turns).toHaveLength(2);
  });

  it("turns one page per notch of a mouse wheel, never inside a page turn", () => {
    const notches: Ev[] = Array.from({ length: 12 }, (_, i) => ({ t: i * 120, dy: 100 }));
    const { turns } = play(notches);
    expect(turns.length).toBeGreaterThanOrEqual(2);
    const times = turns.map((x) => x.t);
    times.slice(1).forEach((t, i) => {
      expect(t - (times[i] ?? 0)).toBeGreaterThanOrEqual(ANIM);
    });
  });

  it("collects a slow trackpad drag until it is far enough", () => {
    const slow: Ev[] = Array.from({ length: 20 }, (_, i) => ({ t: i * 16, dy: 3 }));
    const { turns } = play(slow);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.t).toBeLessThanOrEqual(16 * 8);
  });

  it("leaves a card that can still scroll to scroll, and never turns the page mid-gesture", () => {
    const events: Ev[] = [
      ...Array.from({ length: 10 }, (_, i): Ev => ({ t: i * 16, dy: 40, card: true })),
      // the card hits its edge in the middle of the gesture: the event is stopped, the page stays
      ...Array.from({ length: 20 }, (_, i): Ev => ({ t: 160 + i * 16, dy: 40, card: false })),
    ];
    const { turns, verdicts } = play(events);
    expect(turns).toHaveLength(0);
    expect(verdicts.slice(0, 10).every((v) => v === "native")).toBe(true);
    expect(verdicts.slice(10).every((v) => v === "hold")).toBe(true);
  });

  it("turns the page after a pause once the card is at its edge", () => {
    const { turns } = play([
      ...Array.from({ length: 5 }, (_, i): Ev => ({ t: i * 16, dy: 40, card: true })),
      { t: 400, dy: 40 },
    ]);
    expect(turns).toEqual([{ t: 400, dir: 1 }]);
  });

  it("holds every event while the page is moving, even over a scrolling card", () => {
    const { verdicts } = play([
      { t: 0, dy: 100 },
      { t: 60, dy: 100, card: true },
    ]);
    expect(verdicts).toEqual([1, "hold"]);
  });
});

describe("wheelPixels", () => {
  it("turns lines and pages into pixels", () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 900)).toBe(48);
    expect(wheelPixels({ deltaY: 1, deltaMode: 2 }, 900)).toBe(900);
    expect(wheelPixels({ deltaY: 57, deltaMode: 0 }, 900)).toBe(57);
  });
});
