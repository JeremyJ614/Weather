import s from "./Engines.module.css";

export type HitStats = {
  days: number;
  checked: number;
  hits: number;
  last?: { at: string; label: string } | null;
} | null;

/**
 * An engine's report card (post-launch A1 "skill-scores"): how often the weather followed its
 * flags over the last 30 days, from the hourly engine-verify job, and its latest hit. Below
 * ten checks it says how far along the card is instead of a shaky percentage.
 */
export function HitCard({ stats, what }: { stats: HitStats; what: string }) {
  if (!stats) return null;
  const ready = stats.checked >= 10;
  const pct = ready ? Math.round((100 * stats.hits) / stats.checked) : 0;
  const r = 15.9155;
  return (
    <section className={s.hit} aria-label="Report card">
      <svg viewBox="0 0 36 36" className={s.hitRing} aria-hidden>
        <circle cx="18" cy="18" r={r} className={s.hitTrack} />
        {ready && (
          <circle
            cx="18"
            cy="18"
            r={r}
            className={s.hitArc}
            strokeDasharray={`${pct} ${100 - pct}`}
          />
        )}
      </svg>
      <div className={s.hitText}>
        <small>Report card · last {stats.days} days</small>
        {ready ? (
          <b>
            {pct}% hit rate <span>of {stats.checked} checked</span>
          </b>
        ) : (
          <b>
            Building <span>{stats.checked} of 10 checks so far</span>
          </b>
        )}
        <p>{what}</p>
        {stats.last && (
          <p className={s.hitLast}>
            Latest hit:{" "}
            {new Date(stats.last.at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            , {stats.last.label}
          </p>
        )}
      </div>
      {ready && <strong className={s.hitPct}>{pct}%</strong>}
    </section>
  );
}

/** What a hit means for each checked engine, in plain words. */
export const HIT_MEANS: Record<string, string> = {
  tor: "A hit is a tornado report within 15 miles in the 45 minutes after a storm reached 40%.",
  surge:
    "A hit is a severe storm report within 15 miles in the 45 minutes after a jump.",
  first: "A hit is a storm on radar near a flagged place inside its window.",
  bound: "A hit is a storm on radar where boundaries were set to meet.",
  blizz:
    "A hit is a blizzard report, or an airport at a quarter mile in 35 mph wind, in the window.",
  stp: "A hit is a tornado report within 50 miles of a top spot that evening.",
  scp: "A hit is a tornado or 1-inch hail report within 50 miles of a top spot that evening.",
  dcp: "A hit is a damaging wind report within 60 miles of a top spot that evening.",
  nst: "A hit is a tornado, funnel or waterspout report within 40 miles of a top spot.",
  tctor: "A hit is a tornado report within 50 miles of a top spot.",
};
