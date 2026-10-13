import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-lit text-accent border-accent",
  secondary: "bg-surface2 text-text border-line",
  ghost: "bg-transparent text-text border-transparent",
};

export function Button({
  variant = "secondary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-transform duration-[var(--t-fast)] ease-[var(--spring)] active:scale-95 disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  );
}
