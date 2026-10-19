import s from "./loading.module.css";

/** Shown the instant a page is tapped, while the server prepares it. */
export default function Loading() {
  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <span className={s.scope} aria-hidden>
        <i />
      </span>
      <span className={s.text}>Loading…</span>
    </div>
  );
}
