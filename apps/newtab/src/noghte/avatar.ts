import { records } from "./records";

/**
 * The user's face as the phone app draws it (main repo `apps/mobile/src/avatar/`): the face they
 * picked in «آواتار», or — none, or one that no longer fits «درباره‌ی شما» — the one the gender
 * suggests; on a disc in a deep tone of the app's «رنگ اصلی». All three come from the app's backed-up
 * settings (`setting` records, `{ id: <key>, value: <stored JSON> }`).
 */

// prettier-ignore
const MEN = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13"];
// prettier-ignore
const WOMEN = ["w1", "w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9", "w10", "w11", "w12", "w13"];

type Gender = "female" | "male" | "unspecified";

/** The app's accents (`apps/mobile/src/ui/accents.ts`): the dark skin's shade, and the light one's. */
const ACCENTS: Record<string, { dark: string; light: string }> = {
  indigo: { dark: "#8C9EFF", light: "#3646C9" },
  sky: { dark: "#6CB8FF", light: "#1666C2" },
  teal: { dark: "#4DD4C6", light: "#0A746C" },
  emerald: { dark: "#5ED39C", light: "#16784A" },
  amber: { dark: "#F4C35A", light: "#8A5F08" },
  rose: { dark: "#F592B8", light: "#B83A68" },
  violet: { dark: "#B9A0FF", light: "#6A4AD1" },
};
const DEFAULT_ACCENT = "sky";

export type MyAvatar = { art: string; tone: string };

function setting(key: string): Record<string, unknown> | null {
  const rec = records.all<{ id: string; value: unknown }>("setting").find((r) => r.id === key);
  if (rec === undefined || typeof rec.value !== "string") return null;
  try {
    const v: unknown = JSON.parse(rec.value);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const artsFor = (g: Gender): string[] => (g === "female" ? WOMEN : g === "male" ? MEN : []);

/** Null until the phone's settings have arrived (signed out, or before the first sync). */
export function myAvatar(): MyAvatar | null {
  const avatar = setting("avatar.v1");
  const person = setting("personalization.v1");
  const look = setting("appearance.v1");
  if (avatar === null && person === null && look === null) return null;

  const profile = person?.profile as { gender?: unknown } | undefined;
  const g = profile?.gender;
  const gender: Gender = g === "female" || g === "male" ? g : "unspecified";
  const picked = typeof avatar?.art === "string" ? avatar.art : null;
  const fits =
    picked !== null &&
    (picked === "classic" ? artsFor(gender).length === 0 : artsFor(gender).includes(picked));
  const art = fits ? picked : gender === "female" ? "w1" : gender === "male" ? "m1" : "classic";

  const accent =
    ACCENTS[typeof look?.accent === "string" ? look.accent : ""] ?? ACCENTS[DEFAULT_ACCENT];
  // the phone's «خودکار» can't be known here; this page is dark, so it reads as the dark skin
  const light = look?.mode === "light";
  const hex = accent === undefined ? "#6CB8FF" : light ? accent.light : accent.dark;
  return { art, tone: avatarTone(hex, light) };
}

/**
 * The disc's colour, as the app's `avatarTone` (`apps/mobile/src/avatar/Avatar.tsx`): the accent's
 * hue, deep and quiet — the drawing is *added* to it, so a bright tone burns the face white.
 */
function avatarTone(accent: string, light: boolean): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(accent.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h =
    d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return light ? hsl(h * 60, Math.min(s, 0.42), 0.6) : hsl(h * 60, Math.min(s, 0.45), 0.26);
}

function hsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const hex = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
