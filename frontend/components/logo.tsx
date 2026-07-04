export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  // Ruled-surface triangle: straight lines from the right edge to the base sweep into a
  // parabolic envelope. Rendered in the brand gold (#D8B26A, the "verify" accent).
  const gold = "#D8B26A";
  const lines = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 1) / 10;
    const rx = 16 + 12 * t;
    const ry = 3 + 24 * t;
    const bx = 28 - 24 * t;
    return `M${rx.toFixed(1)} ${ry.toFixed(1)} L${bx.toFixed(1)} 27`;
  });
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="none">
      <path d="M16 3 L28 27 L4 27 Z" stroke={gold} strokeWidth="1.2" strokeLinejoin="round" />
      <g stroke={gold} strokeWidth="0.5" opacity="0.7">
        {lines.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
