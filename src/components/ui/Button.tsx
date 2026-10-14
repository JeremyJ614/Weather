import type { ButtonHTMLAttributes } from "react";
import { Beam, type Still } from "./Beam";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "btn-dark text-accent border-accent/40",
  secondary: "btn-dark text-text border-line",
  ghost: "bg-transparent text-text border-transparent",
};

// Layout classes belong on the beam wrapper so the outline follows the button.
const LAYOUT =
  /^(w-|flex-|grow|shrink|absolute|fixed|top-|right-|bottom-|left-|inset|justify-self|self-|m[trblxy]?-|ml-auto|mr-auto|col-|row-|order-)/;

export function Button({
  variant = "secondary",
  className = "",
  live = false,
  still,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** The moving multicolor beam: only for the few buttons that matter most on a screen. */
  live?: boolean;
  /** Which static outline to use otherwise (primary: full ring; others: fading half ring). */
  still?: Still;
}) {
  const cls = className.split(/\s+/).filter(Boolean);
  const outer = cls.filter((c) => LAYOUT.test(c)).join(" ");
  const inner = cls.filter((c) => !LAYOUT.test(c)).join(" ");
  const button = (
    <button
      className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-semibold tracking-wide transition-transform duration-[var(--t-fast)] ease-[var(--spring)] active:scale-95 disabled:opacity-50 ${styles[variant]} ${inner}`}
      {...rest}
    />
  );
  if (variant === "ghost")
    return outer ? (
      <span className={`inline-flex ${outer}`}>{button}</span>
    ) : (
      button
    );
  return (
    <Beam
      className={`inline-flex rounded-xl ${outer}`}
      strength={variant === "primary" ? 1 : 0.7}
      still={
        live ? undefined : (still ?? (variant === "primary" ? "ring" : "fade"))
      }
    >
      {button}
    </Beam>
  );
}
