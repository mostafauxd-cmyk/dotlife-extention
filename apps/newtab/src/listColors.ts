/**
 * Colours for lists, the same fifteen as the app's list sheet (`apps/mobile/src/planner/palette.ts`):
 * soft, each plainly different from every other, around the colour wheel. Lists are colour codes, so a
 * colour another list uses is not offered again; when every one is taken, `freshListColor` makes a new
 * hue in the widest gap between the ones in use.
 */
export const LIST_COLORS: readonly string[] = [
  "#F07167", // coral
  "#F7B5A6", // blush
  "#F4A259", // tangerine
  "#F6D55C", // sunflower
  "#C5E17A", // lime
  "#5CC97A", // green
  "#3FBFC4", // teal
  "#BFEAF7", // ice
  "#6FB6F2", // sky
  "#5F79E8", // blue
  "#BDB2F5", // lavender
  "#A866E0", // purple
  "#F5B3D8", // pink
  "#E25C93", // raspberry
  "#B5A89A", // taupe
];

function hueOf(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number): number => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number): string =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`.toUpperCase();
}

/** A new hue sitting in the widest gap between the hues already in use. */
export function freshListColor(taken: readonly string[]): string {
  const hues = [...new Set(taken.map(hueOf))].sort((a, b) => a - b);
  if (hues.length === 0) return LIST_COLORS[0] ?? "#6FB6F2";
  let bestGap = -1;
  let bestHue = 0;
  for (let i = 0; i < hues.length; i++) {
    const a = hues[i] ?? 0;
    const b = i + 1 < hues.length ? (hues[i + 1] ?? 0) : (hues[0] ?? 0) + 360;
    if (b - a > bestGap) {
      bestGap = b - a;
      bestHue = (a + b) / 2;
    }
  }
  return hslToHex(bestHue % 360, 0.85, 0.75);
}

/** Colours not used by any of `taken`; never empty (a fresh hue is made when all are used). */
export function availableListColors(taken: readonly string[]): string[] {
  const used = new Set(taken.map((c) => c.toLowerCase()));
  const free = LIST_COLORS.filter((c) => !used.has(c.toLowerCase()));
  return free.length > 0 ? free : [freshListColor(taken)];
}
