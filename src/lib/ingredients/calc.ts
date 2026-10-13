/**
 * Storm ingredients and the Severe Weather Threat Index (SWTI), ported from the
 * VIP app (thresholds, points and colors unchanged). Pure; the same inputs give
 * the same reading.
 */

/** VIP's pastel ramp, benign → violent, plus the wind and rotation hues. */
export const PASTEL = {
  mint: "#98f5c4",
  lime: "#b8f09e",
  yellow: "#ffe88a",
  peach: "#ffbf96",
  coral: "#ff9fa0",
  lavender: "#c8b4f8",
  sky: "#93d8f8",
  rose: "#f8a4c4",
} as const;
export type Pastel = keyof typeof PASTEL;

type Lv = { label: string; tone: Pastel };

export const capeLevel = (c: number): Lv =>
  c >= 4000
    ? { label: "Extreme", tone: "lavender" }
    : c >= 2500
      ? { label: "Very high", tone: "coral" }
      : c >= 1500
        ? { label: "High", tone: "peach" }
        : c >= 1000
          ? { label: "Moderate", tone: "yellow" }
          : c >= 500
            ? { label: "Low-moderate", tone: "lime" }
            : { label: "Minimal", tone: "mint" };

export const shearLevel = (k: number): Lv =>
  k >= 60
    ? { label: "Very high", tone: "coral" }
    : k >= 45
      ? { label: "High", tone: "peach" }
      : k >= 35
        ? { label: "Moderate", tone: "yellow" }
        : k >= 20
          ? { label: "Low-moderate", tone: "lime" }
          : { label: "Low", tone: "mint" };

export const srhLevel = (s: number): Lv =>
  s >= 400
    ? { label: "Extreme", tone: "lavender" }
    : s >= 300
      ? { label: "High", tone: "coral" }
      : s >= 150
        ? { label: "Moderate", tone: "peach" }
        : s >= 75
          ? { label: "Low-moderate", tone: "yellow" }
          : { label: "Low", tone: "mint" };

export const liLevel = (l: number): Lv =>
  l <= -8
    ? { label: "Extremely unstable", tone: "lavender" }
    : l <= -6
      ? { label: "Very unstable", tone: "coral" }
      : l <= -4
        ? { label: "Unstable", tone: "peach" }
        : l <= -2
          ? { label: "Slightly unstable", tone: "yellow" }
          : l <= 0
            ? { label: "Near neutral", tone: "lime" }
            : { label: "Stable", tone: "mint" };

export const stpLevel = (s: number): Lv =>
  s >= 3
    ? { label: "Extreme", tone: "lavender" }
    : s >= 2
      ? { label: "High", tone: "coral" }
      : s >= 1
        ? { label: "Elevated", tone: "peach" }
        : s >= 0.5
          ? { label: "Marginal", tone: "yellow" }
          : { label: "Low", tone: "mint" };

export const dewLevel = (d: number): Lv =>
  d >= 22
    ? { label: "Tropical", tone: "coral" }
    : d >= 19
      ? { label: "Very moist", tone: "peach" }
      : d >= 16
        ? { label: "Moist", tone: "yellow" }
        : d >= 13
          ? { label: "Marginal", tone: "lime" }
          : { label: "Dry", tone: "mint" };

/** VIP's simplified Significant Tornado Parameter. */
export function stp(cape: number, srh: number, shearKts: number, li: number) {
  const capeT = cape / 1500;
  const srhT = srh / 150;
  let shrT = shearKts / 20;
  if (shearKts < 12.5) shrT = 0;
  else if (shearKts > 30) shrT = 1.5;
  const liT = li <= -4 ? 1 : li <= -2 ? 0.85 : li <= 0 ? 0.6 : 0.3;
  return Math.max(0, Math.round(capeT * srhT * shrT * liT * 10) / 10);
}

const step = (v: number, cuts: [number, number][]) =>
  cuts.find(([at]) => v >= at)?.[1] ?? 0;

export type SwtiPart = {
  key: "cape" | "srh" | "shear" | "li" | "dew";
  label: string;
  score: number;
  max: number;
  value: number;
  unit: string;
};

/** VIP's Severe Weather Threat Index: 0–100 from five ingredients. */
export function swti(i: {
  cape: number;
  srh: number;
  shear: number;
  li: number;
  dew: number;
}) {
  const capeScore = step(i.cape, [
    [4000, 30],
    [3000, 24],
    [2000, 18],
    [1500, 14],
    [1000, 10],
    [500, 5],
  ]);
  const srhScore = step(i.srh, [
    [500, 30],
    [400, 25],
    [300, 20],
    [200, 14],
    [150, 10],
    [100, 6],
    [50, 3],
  ]);
  const shearScore = step(i.shear, [
    [60, 20],
    [50, 16],
    [40, 13],
    [30, 10],
    [20, 6],
    [10, 3],
  ]);
  const liScore =
    i.li <= -8
      ? 12
      : i.li <= -6
        ? 10
        : i.li <= -4
          ? 8
          : i.li <= -2
            ? 6
            : i.li <= 0
              ? 3
              : 0;
  const dewScore = step(i.dew, [
    [22, 8],
    [19, 6],
    [16, 4],
    [13, 2],
  ]);
  const score = Math.min(
    100,
    capeScore + srhScore + shearScore + liScore + dewScore,
  );
  const tornado =
    score >= 90 && i.srh >= 400 && i.cape >= 3000
      ? "violent"
      : score >= 70 && i.srh >= 300 && i.cape >= 2000
        ? "high"
        : score >= 50 && i.srh >= 200 && i.cape >= 1500
          ? "moderate"
          : score >= 35 && i.srh >= 100 && i.cape >= 1000
            ? "slight"
            : score >= 20 && (i.srh >= 50 || i.cape >= 500)
              ? "marginal"
              : "none";
  const hail =
    i.cape >= 4000 && i.shear >= 50
      ? "giant"
      : i.cape >= 2500 && i.shear >= 35
        ? "large"
        : i.cape >= 1000 && i.shear >= 20
          ? "small"
          : "none";
  const wind =
    i.cape >= 2000 && i.shear >= 40 && i.li <= -4
      ? "significant"
      : i.cape >= 1000 && i.shear >= 25
        ? "marginal"
        : "none";
  const parts: SwtiPart[] = [
    {
      key: "cape",
      label: "Instability",
      score: capeScore,
      max: 30,
      value: i.cape,
      unit: "J/kg",
    },
    {
      key: "srh",
      label: "Helicity",
      score: srhScore,
      max: 30,
      value: i.srh,
      unit: "m²/s²",
    },
    {
      key: "shear",
      label: "Shear",
      score: shearScore,
      max: 20,
      value: i.shear,
      unit: "kt",
    },
    {
      key: "li",
      label: "Lifted index",
      score: liScore,
      max: 12,
      value: i.li,
      unit: "°C",
    },
    {
      key: "dew",
      label: "Moisture",
      score: dewScore,
      max: 8,
      value: i.dew,
      unit: "°C",
    },
  ];
  return { score, parts, tornado, hail, wind };
}

/** VIP's threat levels for the SWTI score. */
export function threatLevel(score: number): {
  level: string;
  tone: Pastel;
  desc: string;
} {
  if (score >= 80)
    return {
      level: "Violent",
      tone: "lavender",
      desc: "Violent tornadoes, widespread significant severe weather",
    };
  if (score >= 65)
    return {
      level: "Extreme",
      tone: "coral",
      desc: "Tornadoes likely including strong/violent, large hail, extreme winds",
    };
  if (score >= 50)
    return {
      level: "Significant",
      tone: "peach",
      desc: "Significant severe weather, tornadoes and large hail possible",
    };
  if (score >= 35)
    return {
      level: "Elevated",
      tone: "yellow",
      desc: "Elevated severe weather risk, supercells possible",
    };
  if (score >= 15)
    return {
      level: "Marginal",
      tone: "lime",
      desc: "Marginal risk, isolated severe storms possible",
    };
  return {
    level: "Benign",
    tone: "mint",
    desc: "No meaningful convective threat",
  };
}
