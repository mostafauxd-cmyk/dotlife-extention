import { encode } from "uqr";

/** A QR code for a link, drawn as one path so it stays sharp at any size. */
export function Qr({ text, label }: { text: string; label: string }) {
  const { data, size } = encode(text, { border: 1 });
  let d = "";
  data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${String(x)} ${String(y)}h1v1h-1z`;
    });
  });
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      role="img"
      aria-label={label}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
