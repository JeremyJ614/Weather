import type { ReactNode } from "react";
import s from "./Section.module.css";

/** A titled outlook section: eyebrow, title, a plain-language note, then its map. */
export function Section({
  icon,
  eyebrow,
  title,
  note,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={s.sec}>
      <header className={s.head}>
        <span className={s.icon}>{icon}</span>
        <div>
          <p className={s.eyebrow}>{eyebrow}</p>
          <h2 className={s.title}>{title}</h2>
        </div>
      </header>
      <p className={s.note}>{note}</p>
      {children}
    </section>
  );
}

/** A row of product chips that scrolls sideways on phones. */
export function Picker({ children }: { children: ReactNode }) {
  return <div className={s.picker}>{children}</div>;
}
