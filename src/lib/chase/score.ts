/**
 * Storm Chasing Outlook scoring: one afternoon hour of ingredients at one point, plus SPC's
 * odds there, into a 0–100 chase score, a storm mode, and the ways the day could bust.
 * Pure functions so the engine and the tests agree.
 */
export type Hour = {
  time: string;
  cape: number;
  cin: number;
  li: number;
  temp: number;
  dew: number;
  /** Bulk 0–6 km shear (kt), 0–3 km storm-relative helicity (m²/s²). */
  shear: number;
  srh: number;
  stp: number;
  swti: number;
  pop: number;
  lowCloud: number;
  /** Storm motion: speed (mph) and the direction storms move toward (°). */
  motionMph: number;
  motionTo: number;
  freezingFt: number;
};
export type Spc = { cat: number; torn: number; hail: number; wind: number };

export const CAT_NAMES = [
  "None",
  "Thunder",
  "Marginal",
  "Slight",
  "Enhanced",
  "Moderate",
  "High",
];
export const CAT_CODES = ["", "TSTM", "MRGL", "SLGT", "ENH", "MDT", "HIGH"];

/** Lifted condensation level above ground, from the temperature–dew point spread (°F). */
export const lclFt = (tempF: number, dewF: number) =>
  Math.max(0, Math.round(((tempF - dewF) / 1.8) * 125 * 3.281));

/** The chase score (0–100): ingredients, SPC's own odds, and whether storms beat sunset. */
export function chaseScore(h: Hour, spc: Spc, hoursToSunset: number): number {
  const ingredients = h.swti * 0.45; // up to 45
  const odds = Math.min(
    30,
    spc.torn * 1.2 + spc.cat * 2.5 + Math.max(spc.hail, spc.wind) * 0.15,
  ); // up to 30
  const daylight =
    hoursToSunset >= 3
      ? 10
      : hoursToSunset >= 1.5
        ? 6
        : hoursToSunset > 0
          ? 2
          : 0;
  const lcl = lclFt(h.temp, h.dew);
  const penalty =
    (h.cin < -150 ? 12 : h.cin < -75 ? 6 : 0) +
    (lcl > 6500 ? 8 : lcl > 4500 ? 4 : 0) +
    (h.lowCloud > 85 && h.cape < 1500 ? 4 : 0);
  const structure = Math.min(15, h.stp * 4 + (h.shear >= 35 ? 4 : 0)); // up to 15
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(ingredients + odds + daylight + structure - penalty),
    ),
  );
}

export type Mode = {
  mode: string;
  flavor: "HP" | "Classic" | "LP" | "n/a";
  hailIn: number;
  notes: string[];
};

/** What kind of storms the air favors, and roughly how big the hail gets. */
export function stormMode(h: Hour): Mode {
  const notes: string[] = [];
  let mode = "Showers, little organization";
  if (h.cape >= 500 && h.shear >= 40) mode = "Discrete supercells";
  else if (h.cape >= 500 && h.shear >= 30)
    mode = "Supercells mixed with clusters";
  else if (h.cape >= 500 && h.shear >= 20)
    mode = "Multicell clusters and lines";
  else if (h.cape >= 250) mode = "Pulse storms";
  const flavor: Mode["flavor"] = !mode.includes("upercell")
    ? "n/a"
    : h.dew >= 66 && h.pop >= 50
      ? "HP"
      : h.dew < 55
        ? "LP"
        : "Classic";
  // A rough hail size: instability and shear grow stones; a high freezing level melts them.
  const melt = h.freezingFt > 14000 ? 0.75 : 1;
  const hailIn =
    mode.includes("upercell") || mode.includes("Multicell")
      ? Math.round(
          Math.min(
            4,
            (0.4 + (h.cape / 2500) * (Math.min(h.shear, 60) / 40)) * melt,
          ) * 4,
        ) / 4
      : 0;
  if (h.motionMph >= 40)
    notes.push(`Fast storms (${h.motionMph} mph): hard to keep up with.`);
  if (h.srh >= 250 && h.shear >= 35)
    notes.push("Strong low-level spin: the tornado ingredient is there.");
  if (flavor === "HP")
    notes.push("High-precipitation storms: tornadoes can hide in rain.");
  if (flavor === "LP")
    notes.push("Drier storms: great structure, fewer tornadoes.");
  return { mode, flavor, hailIn, notes };
}

export type Bust = { pct: number; reasons: string[] };

/** How the day fails: a cap that holds, high cloud bases, weak shear, too much rain early. */
export function bust(h: Hour, spc: Spc): Bust {
  const lcl = lclFt(h.temp, h.dew);
  const checks: [boolean, number, string][] = [
    [h.cin < -150, 30, "A strong cap may stop storms from forming at all."],
    [
      h.cin >= -150 && h.cin < -75,
      15,
      "A moderate cap could delay storms until late.",
    ],
    [h.cape < 500, 20, "Too little instability for strong storms."],
    [
      h.shear < 25,
      12,
      "Weak wind shear: storms struggle to organize and rotate.",
    ],
    [
      lcl > 4500,
      10,
      `High cloud bases (~${Math.round(lcl / 100) * 100} ft) make tornadoes less likely.`,
    ],
    [h.lowCloud > 80, 6, "Thick low clouds may keep the ground from heating."],
    [h.dew < 55, 8, "Dry air near the ground limits the fuel."],
  ];
  const hit = checks.filter((c) => c[0]);
  const p =
    30 +
    hit.reduce((a, c) => a + c[1], 0) -
    (spc.cat >= 4 ? 15 : spc.cat >= 3 ? 8 : 0) -
    (h.stp >= 1 ? 10 : 0);
  return { pct: Math.max(5, Math.min(95, p)), reasons: hit.map((c) => c[2]) };
}

/** Where the chase day sits against the year so far (percentile 0–100). */
export function percentile(score: number, all: number[]): number {
  if (!all.length) return 0;
  return Math.round((all.filter((x) => x <= score).length / all.length) * 100);
}

/** Score bands (editable colors). */
export const BANDS = [
  { min: 0, label: "Stay home", color: "#8f92a8" },
  { min: 30, label: "Long shot", color: "#facc15" },
  { min: 50, label: "Worth a look", color: "#fb923c" },
  { min: 70, label: "Chase day", color: "#ef4444" },
  { min: 85, label: "Big day", color: "#d946ef" },
];
export const bandIndex = (score: number) =>
  BANDS.findLastIndex((b) => score >= b.min);
