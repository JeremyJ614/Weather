import { moonIllumination, moonPosition, sunPosition } from "./astro";

/**
 * The stargazing score (0–100), ported from VIP's Star Gazing module and sharpened:
 * darkness × cloud × moon × air, where cloud now weighs the layers (thin high cirrus
 * costs less than a low deck) and air folds in visibility as well as humidity and rain.
 * The national map, the hourly outlook and the best-window finder all read this one
 * function, so they can never disagree about the same hour.
 */
export type SkyInputs = {
  at: Date;
  lat: number;
  lon: number;
  /** Total cloud cover %. */
  cloud: number;
  low?: number | null;
  mid?: number | null;
  high?: number | null;
  rh: number;
  /** Precipitation in the hour (mm). */
  precip: number;
  /** Visibility (m). */
  vis?: number | null;
};

export type SkyFactor = {
  key: "darkness" | "cloud" | "moon" | "air";
  label: string;
  value: number;
  detail: string;
};

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

export function darkness(sunAlt: number) {
  if (sunAlt >= -6) return 0;
  if (sunAlt <= -18) return 1;
  return (-sunAlt - 6) / 12;
}

/** Effective cloud (0–1): layers overlap at random; high cloud blocks about 60%. */
export function cloudCover(
  i: Pick<SkyInputs, "cloud" | "low" | "mid" | "high">,
) {
  if (i.low == null || i.mid == null || i.high == null)
    return clamp(i.cloud / 100);
  const layered =
    1 - (1 - i.low / 100) * (1 - i.mid / 100) * (1 - (0.6 * i.high) / 100);
  return clamp(Math.min(layered, i.cloud / 100 + 0.05));
}

export function moonCost(moonAlt: number, illum: number) {
  if (moonAlt <= -3) return 1;
  return 1 - 0.85 * illum * Math.min(1, (moonAlt + 3) / 33);
}

export function air(rh: number, precip: number, vis?: number | null) {
  if (precip > 0.05) return 0.15;
  const hum = Math.max(0.4, 1 - Math.max(0, rh - 50) / 120);
  const v = vis == null ? 1 : clamp(vis / 15000, 0.3, 1);
  return hum * v;
}

export function skyScore(i: SkyInputs) {
  const sun = sunPosition(i.at, i.lat, i.lon).altitude;
  const moon = moonPosition(i.at, i.lat, i.lon);
  const illum = moonIllumination(i.at).fraction;
  const eff = cloudCover(i);
  const factors: SkyFactor[] = [
    {
      key: "darkness",
      label: "Darkness",
      value: darkness(sun),
      detail:
        sun >= 0
          ? "daylight"
          : sun > -6
            ? "civil twilight, still too bright"
            : sun > -12
              ? "nautical twilight"
              : sun > -18
                ? "astronomical twilight"
                : "full darkness",
    },
    {
      key: "cloud",
      label: "Cloud",
      value: (1 - eff) ** 1.2,
      detail:
        i.low != null &&
        i.high != null &&
        i.high > 40 &&
        (i.low ?? 0) < 20 &&
        (i.mid ?? 0) < 20
          ? `${Math.round(i.high)}% thin high cloud`
          : `${Math.round(eff * 100)}% cover`,
    },
    {
      key: "moon",
      label: "Moon",
      value: moonCost(moon.altitude, illum),
      detail:
        moon.altitude <= -3
          ? `down (${Math.round(illum * 100)}% lit)`
          : `${Math.round(illum * 100)}% lit, ${Math.round(moon.altitude)}° up`,
    },
    {
      key: "air",
      label: "Air",
      value: air(i.rh, i.precip, i.vis),
      detail:
        i.precip > 0.05
          ? "rain"
          : i.vis != null && i.vis < 8000
            ? `haze, ${Math.round(i.vis / 1609)} mi visibility`
            : `${Math.round(i.rh)}% humidity`,
    },
  ];
  const score = Math.round(factors.reduce((a, f) => a * f.value, 1) * 100);
  const worst = factors.reduce((lo, f) => (f.value < lo.value ? f : lo));
  return { score, factors, limiting: worst.value < 0.95 ? worst : null };
}

export type SkyHour = { at: Date; score: number };

/** The best two dark hours in a list (average score), or null when it never gets dark. */
export function bestPair(hours: SkyHour[], dark: (at: Date) => boolean) {
  let best: { start: Date; score: number } | null = null;
  for (let i = 0; i + 1 < hours.length; i++) {
    if (!dark(hours[i].at) || !dark(hours[i + 1].at)) continue;
    const s = Math.round((hours[i].score + hours[i + 1].score) / 2);
    if (!best || s > best.score) best = { start: hours[i].at, score: s };
  }
  return best;
}

/** The longest run of hours scoring at least `min`, ties broken by the higher peak. */
export type Run = { start: Date; end: Date; peak: number; hours: number };

export function bestRun(hours: SkyHour[], min = 60): Run | null {
  let best = null as Run | null;
  let run: SkyHour[] = [];
  const close = () => {
    if (run.length) {
      const peak = Math.max(...run.map((h) => h.score));
      if (
        !best ||
        run.length > best.hours ||
        (run.length === best.hours && peak > best.peak)
      )
        best = {
          start: run[0].at,
          end: new Date(run[run.length - 1].at.getTime() + 3600_000),
          peak,
          hours: run.length,
        };
    }
    run = [];
  };
  for (const h of hours) {
    if (h.score >= min) run.push(h);
    else close();
  }
  close();
  return best;
}

/** One scale for every view; colors are editable in admin (`sky:<key>`). */
export const SKY_BANDS = [
  { key: "pristine", min: 80, label: "Pristine", color: "#67e8f9" },
  { key: "excellent", min: 60, label: "Excellent", color: "#3b82f6" },
  { key: "good", min: 40, label: "Good", color: "#4f46b8" },
  { key: "poor", min: 20, label: "Poor", color: "#30287a" },
  { key: "washed", min: 5, label: "Washed out", color: "#1c1848" },
  { key: "none", min: 0, label: "No viewing", color: "#0b0a1f" },
] as const;

/** Target dots on the Star Gazing sky chart, by what you need to see them (`sky:<key>`). */
export const SKY_APERTURE = [
  { key: "eye", label: "Naked eye", color: "#fde047" },
  { key: "binoculars", label: "Binoculars", color: "#e879f9" },
  { key: "telescope", label: "Telescope", color: "#818cf8" },
] as const;

export const bandOf = (score: number) =>
  SKY_BANDS.find((b) => score >= b.min) ?? SKY_BANDS[SKY_BANDS.length - 1];
