/**
 * The badge plates' foil sheen (post-launch A5 "holo"), loaded on its own after the plate:
 * a soft highlight that slides with the pointer or the phone's tilt (transform only).
 */
export default function HoloSheen({
  id,
  x,
  on,
}: {
  id: string;
  /** -1 (left) to 1 (right). */
  x: number;
  on: boolean;
}) {
  return (
    <g mask={`url(#${id}m)`} style={{ mixBlendMode: "screen" }} aria-hidden>
      <defs>
        <radialGradient id={`${id}s`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse
        cx="130"
        cy="27"
        rx="70"
        ry="60"
        fill={`url(#${id}s)`}
        style={{
          transform: `translateX(${x * 120}px)`,
          transition: "transform 160ms ease-out, opacity 300ms",
          opacity: on ? 0.9 : 0,
        }}
      />
    </g>
  );
}
