import type { ButtonHTMLAttributes } from "react";

/** A toggle chip. `pressed` is announced to assistive tech. */
export function Chip({
  pressed = false,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      aria-pressed={pressed}
      className={`min-h-9 rounded-full border px-3 text-[13px] font-bold transition-colors ${
        pressed
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-surface2 text-muted"
      } ${className}`}
      {...rest}
    />
  );
}
