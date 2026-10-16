/**
 * UUID v7 (time-ordered) generated offline. `randomBytes` is injectable for deterministic tests.
 */
export function uuidv7(
  nowMs: number = Date.now(),
  randomBytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const bytes = new Uint8Array(16);
  const ts = BigInt(nowMs);
  for (let i = 0; i < 6; i++) bytes[5 - i] = Number((ts >> BigInt(8 * i)) & 0xffn);
  bytes.set(randomBytes(10), 6);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80; // variant
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
