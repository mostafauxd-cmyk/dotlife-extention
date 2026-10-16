/**
 * Readers for the fields of the server's settings file, shared by its parts (`appConfig.ts`,
 * `promo.ts`). Each takes untrusted JSON and gives the value, or null for anything wrong.
 */

/** A picture the server serves itself, from the `media` folder beside the settings file. */
export const MEDIA_PATH = "/config/media/";
export const MEDIA_FILE = /^[a-z0-9][a-z0-9._-]{0,80}\.(jpg|jpeg|png|webp)$/;

/** A picture with its size, so whatever holds it keeps its place while it loads. */
export type SizedImage = {
  /** `https://…`, or `/config/media/<file>` — a file in the `media` folder beside the settings file. */
  url: string;
  width: number;
  height: number;
};

/** Text on one line, spaces folded, cut to `max`; empty = null. */
export const text = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t === "" ? null : t.slice(0, max);
};

const isImageUrl = (v: unknown): v is string =>
  typeof v === "string" &&
  v.length <= 500 &&
  (/^https:\/\/[^\s]+$/.test(v) ||
    (v.startsWith(MEDIA_PATH) && MEDIA_FILE.test(v.slice(MEDIA_PATH.length))));

const isSide = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0 && v <= 10_000;

/** A picture from a safe address and with its size; without its size it would jump on arrival. */
export function parseImage(input: unknown): SizedImage | null {
  if (typeof input !== "object" || input === null) return null;
  const img = input as Record<string, unknown>;
  return isImageUrl(img.url) && isSide(img.width) && isSide(img.height)
    ? { url: img.url, width: img.width, height: img.height }
    : null;
}

export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
