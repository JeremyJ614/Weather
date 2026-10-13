/**
 * Storm Timing Index (port of VIP's Severe Timing): hour-by-hour hazard chances from
 * the model profile, the worst stretch of the window, and whether it falls after dark.
 * Pure; shared by the API, the page and tests.
 */

export const HAZ = {
  tornado: { label: "Tornado", color: "#ef4444", trigger: 5 },
  wind: { label: "Wind", color: "#22d3ee", trigger: 10 },
  hail: { label: "Hail", color: "#a855f7", trigger: 8 },
} as const;
export type Haz = keyof typeof HAZ;
export const HAZARDS = Object.keys(HAZ) as Haz[];

/** The six SPC-style threat words, by SWTI score (VIP's bands). */
export const RISK = [
  { at: 80, label: "High", color: "#d946ef" },
  { at: 60, label: "Moderate", color: "#ef4444" },
  { at: 40, label: "Enhanced", color: "#f97316" },
  { at: 20, label: "Slight", color: "#eab308" },
  { at: 8, label: "Marginal", color: "#86efac" },
  { at: 0, label: "None", color: "#4ade80" },
] as const;
export const riskIndex = (score: number) =>
  RISK.findIndex((r) => score >= r.at);

/**
 * How much the instability lets the other ingredients matter: 0 with no CAPE, 1 from
 * 500 J/kg. VIP scored shear and helicity even with zero CAPE, which put 20% tornado
 * chances on a cold, stable night; without fuel there are no storms to organize.
 */
export const fuel = (cape: number) =>
  Math.min(1, Math.sqrt(Math.max(0, cape) / 500));

/** The hour's threat for timing: the SWTI, held back by the fuel available. */
export const threat = (swtiScore: number, cape: number) =>
  Math.round(swtiScore * fuel(cape));

/** Percent chances from CAPE (J/kg), 0–1 km-ish SRH (m²/s²), 0–6 km shear (kt) and LI. Ours, not the SPC's. */
export function hazardProbs(
  cape: number,
  srh: number,
  shear: number,
  li: number,
) {
  const tornado = Math.min(
    100,
    (cape > 0 ? (cape / 1500) ** 0.6 * 20 : 0) +
      (srh > 0 ? (srh / 300) ** 0.7 * 12 : 0) +
      (shear > 0 ? (shear / 60) * 8 : 0) +
      (li < -3 ? Math.min(10, Math.abs(li) * 2) : 0),
  );
  const wind = Math.min(
    100,
    (shear > 0 ? (shear / 80) * 25 : 0) +
      (cape > 500 ? (cape / 2000) * 15 : 0) +
      (srh > 100 ? (srh / 500) * 10 : 0),
  );
  const hail = Math.min(
    100,
    (cape > 0 ? (cape / 2000) ** 0.5 * 22 : 0) +
      (shear > 0 ? (shear / 70) * 18 : 0) +
      (li < -2 ? Math.min(8, Math.abs(li) * 1.5) : 0),
  );
  const g = fuel(cape);
  const r = (v: number) => Math.round(Math.max(0, v * g) * 10) / 10;
  return { tornado: r(tornado), wind: r(wind), hail: r(hail) };
}

/** Which hazard leads an hour, each measured against its own trigger. */
export function leader(p: Record<Haz, number>): Haz {
  return HAZARDS.reduce((a, b) =>
    p[b] / HAZ[b].trigger > p[a] / HAZ[a].trigger ? b : a,
  );
}

/** Local "YYYY-MM-DDTHH:MM" is after dark, given that day's sunrise and sunset. */
export function isNight(
  time: string,
  sun: { date: string; rise: string; set: string }[],
): boolean {
  const d = sun.find((x) => x.date === time.slice(0, 10));
  if (!d) {
    const h = Number(time.slice(11, 13));
    return h >= 20 || h < 6;
  }
  return time < d.rise || time > d.set;
}

/**
 * The dangerous stretch around the peak: consecutive hours that stay above a third
 * of it. Null when nothing reaches Marginal.
 */
export function worstWindow<T extends { swti: number }>(hours: T[]) {
  if (!hours.length) return null;
  let peak = 0;
  hours.forEach((h, i) => {
    if (h.swti > hours[peak].swti) peak = i;
  });
  if (hours[peak].swti < 8) return null;
  const floor = Math.max(8, hours[peak].swti * 0.34);
  let a = peak;
  let b = peak;
  while (a > 0 && hours[a - 1].swti >= floor) a--;
  while (b < hours.length - 1 && hours[b + 1].swti >= floor) b++;
  return { start: a, end: b, peak };
}

/** One line per day: its peak threat, the hour it peaks and its worst stretch. */
export function days<T extends { time: string; swti: number }>(hours: T[]) {
  const by = new Map<string, T[]>();
  for (const h of hours) {
    const k = h.time.slice(0, 10);
    by.set(k, [...(by.get(k) ?? []), h]);
  }
  return [...by.entries()].map(([date, list]) => ({
    date,
    hours: list,
    window: worstWindow(list),
    peak: Math.max(...list.map((h) => h.swti)),
  }));
}
