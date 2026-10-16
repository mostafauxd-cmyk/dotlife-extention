import { describe, expect, it } from "vitest";

import { cleanPixels } from "../src/home/iconClean";

const S = 64;
type RGBA = [number, number, number, number];

function paint(f: (x: number, y: number) => RGBA): Uint8ClampedArray {
  const d = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) d.set(f(x, y), (y * S + x) * 4);
  return d;
}
const px = (d: Uint8ClampedArray, x: number, y: number): number[] =>
  Array.from(d.slice((y * S + x) * 4, (y * S + x) * 4 + 4));
const inCircle = (x: number, y: number, r: number): boolean => Math.hypot(x - 32, y - 32) < r;

describe("cleanPixels", () => {
  it("takes off a white rounded plate and turns the black logo white", () => {
    const d = paint((x, y) => {
      const corner = Math.hypot(Math.max(10 - x, x - 53, 0), Math.max(10 - y, y - 53, 0)) > 10;
      if (corner) return [0, 0, 0, 0];
      return inCircle(x, y, 18) ? [20, 20, 20, 255] : [255, 255, 255, 255];
    });
    expect(cleanPixels(d, S)).toBe(true);
    expect(px(d, 6, 32)[3]).toBe(0); // the plate is gone
    expect(px(d, 32, 32)).toEqual([235, 235, 235, 255]); // the logo is light
  });

  it("keeps a white mark inside the logo, which the flood from the edge never reaches", () => {
    const d = paint((x, y) => {
      if (inCircle(x, y, 4)) return [255, 255, 255, 255];
      return inCircle(x, y, 18) ? [20, 20, 20, 255] : [255, 255, 255, 255];
    });
    cleanPixels(d, S);
    expect(px(d, 32, 32)[3]).toBe(255);
  });

  it("flips a dark disc filling the square, its plate only in the corners", () => {
    const d = paint((x, y) => {
      if (!inCircle(x, y, 31)) return [255, 255, 255, 255];
      return inCircle(x, y, 10) ? [255, 255, 255, 255] : [36, 41, 46, 255];
    });
    expect(cleanPixels(d, S)).toBe(true);
    expect(px(d, 0, 0)[3]).toBe(0); // the white corners are gone
    expect(px(d, 32, 5)[0]).toBeGreaterThan(200); // the disc is light now
    expect(px(d, 32, 32)[0]).toBe(0); // and the mark inside it dark
  });

  it("leaves a coloured logo on transparency alone", () => {
    const d = paint((x, y) => (inCircle(x, y, 20) ? [230, 30, 40, 255] : [0, 0, 0, 0]));
    const before = d.slice();
    expect(cleanPixels(d, S)).toBe(false);
    expect(d).toEqual(before);
  });

  it("keeps a coloured plate, which is part of the logo", () => {
    const d = paint((x, y) => {
      if (x < 4 || x > 59 || y < 12 || y > 51) return [0, 0, 0, 0];
      return inCircle(x, y, 8) ? [255, 255, 255, 255] : [255, 0, 0, 255];
    });
    const before = d.slice();
    expect(cleanPixels(d, S)).toBe(false);
    expect(d).toEqual(before);
  });

  it("turns a black logo on transparency white", () => {
    const d = paint((x, y) => (inCircle(x, y, 20) ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    expect(cleanPixels(d, S)).toBe(true);
    expect(px(d, 32, 32)).toEqual([255, 255, 255, 255]);
  });
});
