/**
 * The national static maps: which NOAA layer each one draws and how it is
 * colored. Vector products are projected on our server; rasters are exported
 * by NOAA in our projection and proxied so they can be downloaded.
 */
import { pick, type Colors } from "@/lib/colors/pick";
import { SPC_PALETTES } from "@/lib/colors/spc";

const V = "https://mapservices.weather.noaa.gov/vector/rest/services";

export type Swatch = { label: string; color: string };
export type VectorProduct = {
  id: string;
  label: string;
  title: string;
  url: string;
  kind: "qpf" | "ero" | "cpcTemp" | "cpcPrecip" | "drought" | "spcCat";
};

const qpf = (id: string, label: string, layer: number, title: string) => ({
  id,
  label,
  title,
  url: `${V}/precip/wpc_qpf/MapServer/${layer}`,
  kind: "qpf" as const,
});
const ero = (day: number) => ({
  id: `ero${day}`,
  label: `Day ${day}`,
  title: `Excessive rainfall risk · Day ${day}`,
  url: `${V}/hazards/wpc_precip_hazards/MapServer/${day - 1}`,
  kind: "ero" as const,
});
const cpc = (
  id: string,
  label: string,
  service: string,
  layer: number,
  kind: VectorProduct["kind"],
  title: string,
) => ({
  id,
  label,
  title,
  url: `${V}/outlooks/${service}/MapServer/${layer}`,
  kind,
});

export const QPF: VectorProduct[] = [
  qpf("d1", "Day 1", 1, "Rainfall forecast · Day 1"),
  qpf("d2", "Day 2", 2, "Rainfall forecast · Day 2"),
  qpf("d3", "Day 3", 3, "Rainfall forecast · Day 3"),
  qpf("d45", "Days 4–5", 4, "Rainfall forecast · Days 4–5"),
  qpf("d67", "Days 6–7", 5, "Rainfall forecast · Days 6–7"),
  qpf("t3", "3-day total", 9, "Rainfall total · Days 1–3"),
  qpf("t5", "5-day total", 10, "Rainfall total · Days 1–5"),
  qpf("t7", "7-day total", 11, "Rainfall total · Days 1–7"),
];
export const ERO: VectorProduct[] = [1, 2, 3, 4, 5].map(ero);
export const CPC: VectorProduct[] = [
  cpc(
    "610t",
    "6–10 day temp",
    "cpc_6_10_day_outlk",
    0,
    "cpcTemp",
    "6–10 day temperature outlook",
  ),
  cpc(
    "610p",
    "6–10 day precip",
    "cpc_6_10_day_outlk",
    1,
    "cpcPrecip",
    "6–10 day precipitation outlook",
  ),
  cpc(
    "814t",
    "8–14 day temp",
    "cpc_8_14_day_outlk",
    0,
    "cpcTemp",
    "8–14 day temperature outlook",
  ),
  cpc(
    "814p",
    "8–14 day precip",
    "cpc_8_14_day_outlk",
    1,
    "cpcPrecip",
    "8–14 day precipitation outlook",
  ),
  cpc(
    "mt",
    "Monthly temp",
    "cpc_mthly_temp_outlk",
    0,
    "cpcTemp",
    "Next month temperature outlook",
  ),
  cpc(
    "mp",
    "Monthly precip",
    "cpc_mthly_precip_outlk",
    0,
    "cpcPrecip",
    "Next month precipitation outlook",
  ),
  cpc(
    "st",
    "3-month temp",
    "cpc_sea_temp_outlk",
    0,
    "cpcTemp",
    "Next 3 months temperature outlook",
  ),
  cpc(
    "sp",
    "3-month precip",
    "cpc_sea_precip_outlk",
    0,
    "cpcPrecip",
    "Next 3 months precipitation outlook",
  ),
  cpc(
    "dm",
    "Drought (month)",
    "cpc_drought_outlk",
    1,
    "drought",
    "Monthly drought outlook",
  ),
  cpc(
    "ds",
    "Drought (season)",
    "cpc_drought_outlk",
    4,
    "drought",
    "Seasonal drought outlook",
  ),
];
export const SPC: VectorProduct[] = [
  {
    id: "spc1",
    label: "SPC Day 1",
    title: "SPC convective outlook · Day 1",
    url: "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
    kind: "spcCat",
  },
];
export const VECTOR = [...QPF, ...ERO, ...CPC, ...SPC];
// VIP's categorical palette and labels (lib/colors/spc), keyed by SPC label.
const SPC_CAT: Record<string, Swatch> = Object.fromEntries(
  ["TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"].map((k, i) => [
    k,
    { label: SPC_PALETTES.cat[i].label, color: SPC_PALETTES.cat[i].color },
  ]),
);
const SPC_ORDER = Object.keys(SPC_CAT);

export const QPF_SCALE: { at: number; color: string }[] = [
  { at: 0.01, color: "#1f6f3a" },
  { at: 0.1, color: "#2f9e44" },
  { at: 0.25, color: "#51cf66" },
  { at: 0.5, color: "#a9e34b" },
  { at: 0.75, color: "#ffd43b" },
  { at: 1, color: "#fcc419" },
  { at: 1.25, color: "#ff922b" },
  { at: 1.5, color: "#fd7e14" },
  { at: 1.75, color: "#fa5252" },
  { at: 2, color: "#e03131" },
  { at: 2.5, color: "#e64980" },
  { at: 3, color: "#be4bdb" },
  { at: 4, color: "#9c36b5" },
  { at: 5, color: "#7048e8" },
  { at: 7, color: "#4c6ef5" },
  { at: 10, color: "#74c0fc" },
  { at: 15, color: "#e7f5ff" },
];
export const ERO_COLORS: Swatch[] = [
  { label: "Marginal (≥5%)", color: "#7bd389" },
  { label: "Slight (≥15%)", color: "#ffe066" },
  { label: "Moderate (≥40%)", color: "#ff6b6b" },
  { label: "High (≥70%)", color: "#f783ac" },
];
const PROBS = [33, 40, 50, 60, 70, 80, 90];
export const RAMP = {
  above: [
    "#ffd8a8",
    "#ffa94d",
    "#ff8787",
    "#fa5252",
    "#e03131",
    "#c92a2a",
    "#8b1a1a",
  ],
  below: [
    "#a5d8ff",
    "#74c0fc",
    "#4dabf7",
    "#339af0",
    "#1c7ed6",
    "#1864ab",
    "#0b3d78",
  ],
  wet: [
    "#b2f2bb",
    "#8ce99a",
    "#51cf66",
    "#37b24d",
    "#2b8a3e",
    "#1f6f30",
    "#124d21",
  ],
  dry: [
    "#ffe8cc",
    "#f4c58a",
    "#e0a35e",
    "#c98a46",
    "#a86b2d",
    "#82511f",
    "#5c3815",
  ],
};
export const DROUGHT: Record<string, Swatch> = {
  Persistence: { label: "Drought persists", color: "#a0782c" },
  Improvement: { label: "Drought improves", color: "#e3d3b0" },
  Removal: { label: "Drought ends", color: "#9bc26b" },
  Development: { label: "Drought develops", color: "#ffd43b" },
};

const step = (p: number) =>
  Math.max(
    0,
    PROBS.findLastIndex((x) => p >= x),
  );

/** Fill color for one feature, or null to leave it undrawn (admin overrides applied). */
export function colorFor(
  kind: VectorProduct["kind"],
  props: Record<string, unknown>,
  colors: Colors = {},
): string | null {
  if (kind === "qpf") {
    const v = Number(props.qpf);
    const i = QPF_SCALE.findLastIndex((s) => v >= s.at);
    return i < 0 ? null : pick(colors, `qpf:${i}`, QPF_SCALE[i].color);
  }
  if (kind === "ero") {
    const i = Number(props.dn) - 1;
    return ERO_COLORS[i] ? pick(colors, `ero:${i}`, ERO_COLORS[i].color) : null;
  }
  if (kind === "drought") {
    const k = String(props.outlook);
    return DROUGHT[k] ? pick(colors, `drought:${k}`, DROUGHT[k].color) : null;
  }
  if (kind === "spcCat") {
    const k = String(props.LABEL);
    const i = SPC_ORDER.indexOf(k);
    return i < 0 ? null : pick(colors, `spc:cat:${i}`, SPC_CAT[k].color);
  }
  const cat = String(props.cat);
  const p = Number(props.prob);
  if (cat === "Normal") return pick(colors, "cpc:normal", "#adb5bd");
  if (cat !== "Above" && cat !== "Below") return null;
  const name =
    kind === "cpcTemp"
      ? cat === "Above"
        ? "above"
        : "below"
      : cat === "Above"
        ? "wet"
        : "dry";
  const i = step(p);
  return pick(colors, `cpc:${name}:${i}`, RAMP[name][i]);
}

export function legendFor(
  kind: VectorProduct["kind"],
  colors: Colors = {},
): Swatch[] {
  if (kind === "qpf")
    return QPF_SCALE.map((s, i) => ({
      label: `${s.at}"`,
      color: pick(colors, `qpf:${i}`, s.color),
    }));
  if (kind === "ero")
    return ERO_COLORS.map((s, i) => ({
      ...s,
      color: pick(colors, `ero:${i}`, s.color),
    }));
  if (kind === "drought")
    return Object.entries(DROUGHT).map(([k, s]) => ({
      ...s,
      color: pick(colors, `drought:${k}`, s.color),
    }));
  if (kind === "spcCat")
    return Object.values(SPC_CAT).map((s, i) => ({
      ...s,
      color: pick(colors, `spc:cat:${i}`, s.color),
    }));
  const [a, b] = kind === "cpcTemp" ? ["above", "below"] : ["wet", "dry"];
  const c = (n: string, i: number) =>
    pick(colors, `cpc:${n}:${i}`, RAMP[n as keyof typeof RAMP][i]);
  const word = kind === "cpcTemp" ? ["Warmer", "Colder"] : ["Wetter", "Drier"];
  return [
    { label: `${word[0]} 33–40%`, color: c(a, 0) },
    { label: `${word[0]} 50%+`, color: c(a, 2) },
    { label: `${word[0]} 70%+`, color: c(a, 4) },
    { label: "Near normal", color: pick(colors, "cpc:normal", "#adb5bd") },
    { label: `${word[1]} 33–40%`, color: c(b, 0) },
    { label: `${word[1]} 50%+`, color: c(b, 2) },
    { label: `${word[1]} 70%+`, color: c(b, 4) },
  ];
}

/** Draw order: weaker categories first so the strongest sit on top. */
export function rank(
  kind: VectorProduct["kind"],
  props: Record<string, unknown>,
): number {
  if (kind === "qpf") return Number(props.qpf) || 0;
  if (kind === "ero") return Number(props.dn) || 0;
  if (kind === "drought") return 0;
  if (kind === "spcCat") return SPC_ORDER.indexOf(String(props.LABEL));
  return Number(props.prob) || 0;
}

export const RASTERS = {
  heat: {
    title: "NWS HeatRisk",
    url: "https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer/exportImage",
    extra:
      "&renderingRule=%7B%22rasterFunction%22%3A%22heatrisk.rft%22%7D&format=png32",
  },
  eddi: {
    title: "Rapid drought onset (EDDI, 2 weeks)",
    url: "https://mapservices.weather.noaa.gov/experimental/rest/services/eddi_monitoring/MapServer/export",
    extra: "&layers=show:11&format=png32",
  },
} as const;
