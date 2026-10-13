/** EPA AQI categories and the pollen dispersal model (ported from the VIP app). Pure; tested. */
export const AQI_BANDS = [
  {
    max: 50,
    label: "Good",
    color: "#5fd36b",
    advice: "Air quality is fine for everyone.",
  },
  {
    max: 100,
    label: "Moderate",
    color: "#f2e05a",
    advice:
      "Unusually sensitive people should limit long, hard outdoor effort.",
  },
  {
    max: 150,
    label: "Unhealthy for sensitive groups",
    color: "#f59b3d",
    advice:
      "Kids, older adults and people with heart or lung conditions should take it easier outside.",
  },
  {
    max: 200,
    label: "Unhealthy",
    color: "#e8463b",
    advice: "Everyone should cut back on long or heavy outdoor exertion.",
  },
  {
    max: 300,
    label: "Very unhealthy",
    color: "#9b4fc4",
    advice: "Avoid long or heavy outdoor exertion.",
  },
  {
    max: Infinity,
    label: "Hazardous",
    color: "#8a2a3a",
    advice: "Stay indoors and keep activity low.",
  },
] as const;

export const aqiBand = (aqi: number) => AQI_BANDS.find((b) => aqi <= b.max)!;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * How well conditions spread pollen (0–100). Multiplicative on purpose: rain shuts the whole
 * thing down rather than subtracting points. It is a dispersal reading, never a pollen count.
 */
export function dispersalScore(x: {
  temp: number;
  humidity: number;
  wind: number;
  gust: number;
  rainChance: number;
  hour: number;
}) {
  const warmth = clamp01((x.temp - 42) / 38);
  const diurnal =
    x.hour >= 5 && x.hour <= 11
      ? 1
      : x.hour >= 12 && x.hour <= 17
        ? 0.72
        : x.hour >= 18 && x.hour <= 21
          ? 0.4
          : 0.18;
  const dryness = clamp01((78 - x.humidity) / 42);
  const carry = clamp01(x.wind / 18) * 0.7 + clamp01(x.gust / 32) * 0.3;
  // NWS hourly gives rain chance, not amounts: likely rain washes the air out.
  const washout =
    x.rainChance >= 70
      ? 0.2
      : x.rainChance >= 50
        ? 0.45
        : x.rainChance >= 30
          ? 0.75
          : 1;
  return Math.round(
    clamp01(
      warmth *
        diurnal *
        (0.35 + 0.65 * dryness) *
        (0.3 + 0.7 * carry) *
        washout,
    ) * 100,
  );
}

export const DISPERSAL_BANDS = [
  { max: 15, label: "Minimal" },
  { max: 35, label: "Low" },
  { max: 60, label: "Moderate" },
  { max: 80, label: "High" },
  { max: 100, label: "Very high" },
] as const;
export const dispersalBand = (s: number) =>
  DISPERSAL_BANDS.find((b) => s <= b.max)!.label;

/** "S 10 to 15 mph" → 15 */
export const windMph = (s: string) =>
  Math.max(0, ...(s.match(/\d+/g) ?? ["0"]).map(Number));

/** Which pollens are typically in season (contiguous US climatology, not a measurement). */
export const POLLEN_SEASONS = [
  {
    label: "Tree",
    months: [2, 3, 4, 5],
    note: "Oak, birch, maple, cedar; heaviest on warm, dry spring mornings.",
  },
  {
    label: "Grass",
    months: [5, 6, 7],
    note: "Late spring into summer; afternoons can run high.",
  },
  {
    label: "Weed",
    months: [8, 9, 10],
    note: "Ragweed season; peaks late morning to midday.",
  },
  {
    label: "Mountain cedar (TX/OK)",
    months: [12, 1, 2],
    note: "Winter cedar fever in the southern Plains.",
  },
] as const;
export const inSeason = (month: number) =>
  POLLEN_SEASONS.filter((s) => (s.months as readonly number[]).includes(month));
