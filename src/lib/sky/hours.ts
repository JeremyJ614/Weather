/** Open-Meteo hour handling, small enough to load with the Star Gazing page itself. */
type Series = { time: string[] };

/** An Open-Meteo hour ("2026-11-26T08:00", UTC) as a Date; tolerant of seconds or a zone. */
export const hourAt = (t: string) =>
  new Date(
    /[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t.length === 16 ? `${t}:00` : t}Z`,
  );

/**
 * Whether a forecast still reaches well into the future. A cached copy that has run out
 * (every hour already past) is what left the page blank and the hours "Invalid Date".
 */
export function fresh(h: Series | undefined, now = Date.now()) {
  const last = h?.time?.at(-1);
  return !!last && hourAt(last).getTime() >= now + 18 * 3600_000;
}
