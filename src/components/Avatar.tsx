// Deterministic colored-initials avatar — the app has no photo uploads, so
// every "person" reference (employee, PIC, requester, ...) gets one of
// these instead, colored consistently per name across the whole app.

const PALETTE = [
  "oklch(62% 0.14 30)",  // warm red
  "oklch(60% 0.13 90)",  // olive
  "oklch(58% 0.13 150)", // green
  "oklch(58% 0.12 195)", // teal
  "oklch(56% 0.15 255)", // blue
  "oklch(55% 0.15 300)", // purple
  "oklch(58% 0.16 340)", // pink
];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: colorForName(name) }}
      title={name}
    >
      {initialsForName(name)}
    </span>
  );
}
