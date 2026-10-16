/**
 * A site icon made to sit on a dark tile: a plain white, grey or black plate behind the logo
 * (GitHub's white rounded square) is taken off, and a logo left black or dark grey turns white. Coloured logos keep their
 * colours.
 */

const near = (d: Uint8ClampedArray, i: number, c: readonly number[], tol: number): number =>
  Math.hypot(
    (d[i] ?? 0) - (c[0] ?? 0),
    (d[i + 1] ?? 0) - (c[1] ?? 0),
    (d[i + 2] ?? 0) - (c[2] ?? 0),
  ) / tol;

/** Changes `d` (RGBA, `size`×`size`) in place; true when anything changed. */
export function cleanPixels(d: Uint8ClampedArray, size: number): boolean {
  const at = (x: number, y: number): number => (y * size + x) * 4;
  const opaque = (i: number): boolean => (d[i + 3] ?? 0) > 200;
  let changed = false;

  // the plate: the colour met first from every side, if nearly all sides meet the same one
  const edge: number[] = [];
  for (let k = 0; k < size; k++) {
    for (const [sx, sy, dx, dy] of [
      [k, 0, 0, 1],
      [k, size - 1, 0, -1],
      [0, k, 1, 0],
      [size - 1, k, -1, 0],
    ] as const) {
      for (let x = sx, y = sy; x >= 0 && y >= 0 && x < size && y < size; x += dx, y += dy) {
        const i = at(x, y);
        if (opaque(i)) {
          edge.push(i);
          break;
        }
        if ((d[i + 3] ?? 0) > 40) break;
      }
    }
  }
  // or the four corners, when they agree: a round logo filling the square (GitHub's dark disc) shows
  // its plate only there
  const corners = [at(0, 0), at(size - 1, 0), at(0, size - 1), at(size - 1, size - 1)];
  const c0 = corners[0] ?? 0;
  const fromCorners = corners.every(
    (i) => opaque(i) && near(d, i, [d[c0] ?? 0, d[c0 + 1] ?? 0, d[c0 + 2] ?? 0], 40) < 1,
  );
  let plate: number[] | null = null;
  let seeds: number[] = [];
  if (edge.length > size * 3) {
    const avg = [0, 1, 2].map((c) => edge.reduce((s, i) => s + (d[i + c] ?? 0), 0) / edge.length);
    if (edge.filter((i) => near(d, i, avg, 40) < 1).length / edge.length > 0.85) {
      plate = avg;
      seeds = edge;
    }
  }
  if (plate === null && fromCorners) {
    plate = [d[c0] ?? 0, d[c0 + 1] ?? 0, d[c0 + 2] ?? 0];
    seeds = corners;
  }
  // only a white, grey or black plate: a coloured one (YouTube's red) is the logo itself
  if (plate !== null && Math.max(...plate) - Math.min(...plate) < 25) {
    const avg = plate;
    // flood in from the edge, so the same colour inside the logo stays
    const seen = new Uint8Array(size * size);
    const stack = seeds.map((i) => i / 4);
    while (stack.length > 0) {
      const p = stack.pop() ?? 0;
      if (seen[p] === 1) continue;
      seen[p] = 1;
      const i = p * 4;
      const n = near(d, i, avg, 60);
      if (n >= 2) continue;
      // soft at the logo's outline: further from the plate's colour keeps more of the pixel
      d[i + 3] = n < 1 ? 0 : Math.round((d[i + 3] ?? 0) * (n - 1));
      changed = true;
      if (n >= 1) continue;
      const x = p % size;
      const y = (p - x) / size;
      if (x > 0) stack.push(p - 1);
      if (x < size - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - size);
      if (y < size - 1) stack.push(p + size);
    }
  }

  // what is left: a grey or black logo flips to light, a coloured one stays. Marks of the plate's
  // colour inside the logo (GitHub's white cat) do not count, they flip with it.
  const removed = changed ? plate : null;
  let lum = 0;
  let sat = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if ((d[i + 3] ?? 0) < 128) continue;
    if (removed !== null && near(d, i, removed, 60) < 2) continue;
    const r = d[i] ?? 0;
    const g = d[i + 1] ?? 0;
    const b = d[i + 2] ?? 0;
    lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sat += Math.max(r, g, b) - Math.min(r, g, b);
    n++;
  }
  if (n > 0 && sat / n < 30 && lum / n < 110) {
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * (d[i] ?? 0) + 0.7152 * (d[i + 1] ?? 0) + 0.0722 * (d[i + 2] ?? 0);
      const v = 255 - Math.round(l);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    changed = true;
  }
  return changed;
}

const done = new Map<string, Promise<string | null>>();

/** The cleaned icon as an image URL, or null when it needs nothing or cannot be read. */
export function cleanIcon(src: string): Promise<string | null> {
  let p = done.get(src);
  if (p === undefined) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const size = 64;
          const c = document.createElement("canvas");
          c.width = size;
          c.height = size;
          const g = c.getContext("2d", { willReadFrequently: true });
          if (g === null) {
            resolve(null);
            return;
          }
          g.drawImage(img, 0, 0, size, size);
          const data = g.getImageData(0, 0, size, size);
          if (!cleanPixels(data.data, size)) {
            resolve(null);
            return;
          }
          g.putImageData(data, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = src;
    });
    done.set(src, p);
  }
  return p;
}
