import s from "./BB8Toggle.module.css";

/**
 * A switch drawn as BB-8 on Tatooine (owner's follow-up #4): day when off, night when on.
 * A real checkbox underneath (role="switch"), so it reads and works like any switch.
 */
export function BB8Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <label className={s.toggle}>
      <input
        type="checkbox"
        role="switch"
        className={s.checkbox}
        checked={checked}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={s.box} aria-hidden>
        <span className={s.sky}>
          <i className={s.day} />
          <i className={s.night} />
          <span className={s.layer}>
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} className={s.star} />
            ))}
          </span>
          <i className={s.sun1} />
          <i className={s.sun2} />
          <i className={s.moon} />
          <i className={s.moon2} />
          <i className={s.moon3} />
          <span className={s.layer}>
            <i className={s.cloud} />
            <i className={s.cloud} />
            <i className={s.cloud} />
          </span>
        </span>
        <span className={s.bb8}>
          <span className={s.head}>
            <i className={s.antenna} />
            <i className={s.antenna} />
            <i className={s.dome} />
          </span>
          <i className={s.body} />
        </span>
        <span className={s.ground}>
          <i className={s.shadow} />
        </span>
      </span>
    </label>
  );
}
