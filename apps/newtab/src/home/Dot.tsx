import { useEffect, useRef } from "react";

/**
 * نقطه's dot: the app's own pen scribble (dotlife apps/mobile/src/ui/BrandMark.tsx) — one seeded
 * spiral of loops — drawn in the theme's tint. The pen draws it as the tab opens, and again on a
 * click.
 */

const SCRIBBLE = (() => {
  const loops = 46;
  const per = 40;
  const n = loops * per;
  let seed = 7;
  const rnd = (): number => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const knots = 2 * loops + 3;
  const table = (): number[] => Array.from({ length: knots }, () => rnd() * 2 - 1);
  const ch = { r: table(), e: table(), rot: table(), cx: table(), cy: table(), sp: table() };
  const noise = (k: readonly number[], x: number): number => {
    const i = Math.floor(x);
    const f0 = x - i;
    const f = f0 * f0 * (3 - 2 * f0);
    const a = k[i] ?? 0;
    return a + ((k[i + 1] ?? a) - a) * f;
  };
  let ang = 0;
  let d = "";
  let len = 0;
  let px = 0;
  let py = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const k = u * loops;
    ang += ((2 * Math.PI) / per) * (1 + 0.18 * noise(ch.sp, k));
    const env = 0.02 + 0.98 * Math.pow(u, 0.7);
    const r = 48 * env * (0.72 + 0.28 * noise(ch.r, k * 1.7));
    const ecc = 0.08 * noise(ch.e, k * 0.7);
    const rot = 1.1 * noise(ch.rot, k * 0.5);
    const cx = 50 + 2.4 * env * noise(ch.cx, k * 0.6);
    const cy = 50 + 2.4 * env * noise(ch.cy, k * 0.6);
    const ex = r * (1 + ecc) * Math.cos(-ang);
    const ey = r * (1 - ecc) * Math.sin(-ang);
    const tr = 0.25 * Math.sin(ang * 6.7 + 1.1);
    const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot) + tr;
    const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot) + tr * 0.7;
    if (i > 0) len += Math.hypot(x - px, y - py);
    d += `${i > 0 ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    px = x;
    py = y;
  }
  return { d, len };
})();

const reduced = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Dot({ drawAfter }: { drawAfter: number | null }) {
  const path = useRef<SVGPathElement>(null);

  const draw = (delay = 0): void => {
    const p = path.current;
    if (p === null || reduced()) return;
    for (const a of p.getAnimations()) a.cancel();
    p.animate([{ strokeDashoffset: SCRIBBLE.len }, { strokeDashoffset: 0 }], {
      duration: 900,
      delay,
      easing: "cubic-bezier(.4,0,.6,1)",
      fill: "both",
    });
  };

  useEffect(() => {
    if (drawAfter !== null) draw(drawAfter);
  }, [drawAfter]);

  return (
    <button
      type="button"
      className="dotlogo"
      aria-label="نقطه؛ برای کشیدن دوباره بزن"
      onClick={() => {
        draw();
      }}
    >
      <svg viewBox="-2 -2 104 104" aria-hidden="true">
        <path
          ref={path}
          d={SCRIBBLE.d}
          style={{ strokeDasharray: `${String(SCRIBBLE.len + 1)} ${String(SCRIBBLE.len + 1)}` }}
        />
      </svg>
    </button>
  );
}
