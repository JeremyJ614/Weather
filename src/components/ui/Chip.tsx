import type { ButtonHTMLAttributes } from "react";
import { Beam } from "./Beam";

/** A toggle chip. `pressed` is announced to assistive tech; the pressed chip carries the beam. */
export function Chip({
  pressed = false,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  const chip = (
    <button
      aria-pressed={pressed}
      className={`min-h-8 rounded-full border px-3 text-xs font-semibold tracking-wide transition-colors ${
        pressed
          ? "btn-dark border-accent/50 text-accent"
          : "btn-dark border-line text-muted"
      } ${className}`}
      {...rest}
    />
  );
  return pressed ? (
    <Beam className="inline-flex rounded-full" strength={0.85}>
      {chip}
    </Beam>
  ) : (
    chip
  );
}
