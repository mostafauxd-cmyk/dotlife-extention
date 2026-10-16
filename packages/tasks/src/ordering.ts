/**
 * Fractional indexing for manual ordering: `orderBetween(a, b)` returns a string that sorts strictly
 * between `a` and `b` (either may be undefined for "before everything" / "after everything").
 * Plain lexicographic comparison, so SQLite `ORDER BY "order"` works without extra logic.
 */

const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;
const MID = DIGITS.charAt(Math.floor(BASE / 2));

export function orderBetween(a?: string, b?: string): string {
  if (a !== undefined && b !== undefined && a >= b)
    throw new RangeError(`orderBetween: ${a} >= ${b}`);
  const lo = a ?? "";
  const hi = b ?? "";
  let out = "";
  for (let i = 0; ; i++) {
    const l = i < lo.length ? DIGITS.indexOf(lo[i] as string) : 0;
    const h = i < hi.length ? DIGITS.indexOf(hi[i] as string) : BASE;
    if (h - l > 1) {
      out += DIGITS.charAt(Math.floor((l + h) / 2));
      return out;
    }
    // adjacent (or equal) digits: copy the low digit and keep going deeper
    out += DIGITS.charAt(l);
    if (i >= lo.length && h === BASE && i >= hi.length) {
      // both exhausted with no gap — append a middle digit
      return out + MID;
    }
    if (h - l === 1) {
      // from here on only the low bound constrains us
      return out + tailAbove(lo.slice(i + 1));
    }
  }
}

/** Smallest-ish string strictly greater than `rest` in the open interval (rest, next-digit). */
function tailAbove(rest: string): string {
  let out = "";
  for (let i = 0; i < rest.length; i++) {
    const d = DIGITS.indexOf(rest[i] as string);
    if (d < BASE - 1) return out + DIGITS.charAt(Math.floor((d + BASE) / 2));
    out += rest.charAt(i);
  }
  return out + MID;
}

/** Initial order for the first item. */
export const FIRST_ORDER = MID;
