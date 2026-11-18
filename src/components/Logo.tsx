/** Flower mark from the design. */
export default function Logo({ size = 56, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse key={i} cx="32" cy="14" rx="5.2" ry="11" fill={color} transform={`rotate(${i * 45} 32 32)`} />
      ))}
    </svg>
  );
}
