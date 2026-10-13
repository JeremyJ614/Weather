import type { CSSProperties } from "react";
import s from "./Burger.module.css";

/** The three-line button shared by drawer and overlay menus; morphs to an X. */
export function Burger({
  open,
  onClick,
  style,
}: {
  open: boolean;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      className={s.trig}
      data-open={open}
      style={style}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      onClick={onClick}
    >
      <span />
      <span />
      <span />
    </button>
  );
}
