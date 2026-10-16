/** Floor division, correct for negative numbers (unlike `Math.trunc`). */
export function div(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Modulo that is always in `[0, b)` for positive `b`, correct for negative `a`. */
export function mod(a: number, b: number): number {
  return a - div(a, b) * b;
}

/**
 * Truncating division (toward zero). The Borkowski / jalaali-js formulas were derived with this
 * semantics and break if floor division is used on their negative intermediates.
 */
export function tdiv(a: number, b: number): number {
  return Math.trunc(a / b);
}

/** Remainder with the sign of the dividend — the companion of {@link tdiv}. */
export function tmod(a: number, b: number): number {
  return a - tdiv(a, b) * b;
}
