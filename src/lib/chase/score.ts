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
  /** 700 mb humidity (%) and vertical motion (m/s, positive is rising); older days lack them. */
  rh700?: number;
  w700?: number;
  /** Upper-air temperatures (°C) and heights (m), the ground's height (m) and pressure (mb). Newer days only. */
  t850?: number;
  t700?: number;
  t500?: number;
  z850?: number;
  z700?: number;
  z500?: number;
  elev?: number;
  pres?: number;
  /** Boundary layer depth (m), 850/500 mb humidity (%). */
  pbl?: number;
  rh850?: number;
  rh500?: number;
  /** Lowest-layer shear (kt) and helicity (m²/s²). */
  shear01?: number;
  srh01?: number;
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
  { min: 70, label: "Worth going", color: "#ef4444" },
  { min: 85, label: "Big day", color: "#d946ef" },
];
/** The second target's color (editable). */
export const CHASE_ALT = "#a78bfa";
export const bandIndex = (score: number) =>
  BANDS.findLastIndex((b) => score >= b.min);

/** NWS hail size names. */
export function hailName(inches: number) {
  const names: [number, string][] = [
    [4, "softball"],
    [3, "teacup"],
    [2.75, "baseball"],
    [2.5, "tennis ball"],
    [2, "hen egg"],
    [1.75, "golf ball"],
    [1.5, "ping pong ball"],
    [1.25, "half dollar"],
    [1, "quarter"],
    [0.75, "penny"],
    [0.5, "marble"],
  ];
  return names.find(([s]) => inches >= s)?.[1] ?? "small";
}

/** What each storm mode and flavor looks like from the road. */
export function modeBlurb(m: Mode) {
  if (m.flavor === "Classic")
    return "Classic supercell. The rain-free base and the wall cloud sit out in the open, which is the structure everybody drives for.";
  if (m.flavor === "HP")
    return "High-precipitation supercells: heavy rain and hail wrap around the circulation, so the business end is hard to see.";
  if (m.flavor === "LP")
    return "Low-precipitation supercells: sculpted, photogenic updrafts with little rain, and fewer tornadoes.";
  if (m.mode.startsWith("Multicell"))
    return "Clusters and lines rather than lone storms: hail and wind more than tornadoes, and harder to pick a storm.";
  if (m.mode.startsWith("Pulse"))
    return "Short-lived single storms that go up and rain out within an hour.";
  return "Little organization: showers and the odd thunderstorm.";
}

export const BUST_STEPS = ["very low", "low", "real", "coin flip", "likely"];
export const bustStep = (pct: number) =>
  pct < 15 ? 0 : pct < 30 ? 1 : pct < 50 ? 2 : pct < 70 ? 3 : 4;

export type DeskNote = {
  desk: string;
  tornado: string;
  hail: string;
  wind: string;
  bust: string;
};

/** The numbers-only write-up, used when the forecast desk's AI notes aren't there. */
export function plainNote(t: {
  hour: Hour;
  spc: Spc;
  mode: Mode;
  bust: Bust;
  hoursToSunset: number;
}): DeskNote {
  const h = t.hour;
  const lcl = lclFt(h.temp, h.dew);
  const dir = "N NNE NE ENE E ESE SE SSE S SSW SW WSW W WNW NW NNW".split(" ")[
    Math.round(h.motionTo / 22.5) % 16
  ];
  return {
    desk: `Expected storm mode: ${t.mode.mode.toLowerCase()}, moving ${dir} at ${h.motionMph} mph. Peak heating brings ${h.cape.toLocaleString("en-US")} J/kg of instability under ${h.shear} kt of deep shear, with about ${Math.round(t.hoursToSunset * 10) / 10} hours of daylight left after the best hour.`,
    tornado:
      h.stp >= 1 || t.spc.torn >= 10
        ? `STP near ${h.stp} with ${h.srh} m²/s² of helicity and cloud bases near ${Math.round(lcl / 100) * 100} ft support a tornado threat.`
        : `Tornado potential is limited: ${h.srh} m²/s² of helicity and a ${t.spc.torn}% SPC tornado probability.`,
    hail: t.mode.hailIn
      ? `Hail to about ${t.mode.hailIn}" (${hailName(t.mode.hailIn)}) with ${h.cape.toLocaleString("en-US")} J/kg of CAPE and a freezing level near ${Math.round(h.freezingFt / 100) * 100} ft.`
      : "Little hail risk with storms this weak.",
    wind:
      t.spc.wind >= 15
        ? `A ${t.spc.wind}% SPC wind probability: damaging outflow gusts are possible.`
        : `Severe wind risk is low (${t.spc.wind}% SPC wind probability).`,
    bust: t.bust.reasons.length
      ? t.bust.reasons.join(" ")
      : "The ingredients line up; the main way this fails is storms not initiating where expected.",
  };
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const fin = (x: number | undefined): x is number =>
  typeof x === "number" && Number.isFinite(x);

/** Stull's wet-bulb temperature (°C) from temperature (°C) and humidity (%). */
export function wetBulb(t: number, rh: number) {
  const h = Math.max(5, Math.min(99, rh));
  return (
    t * Math.atan(0.151977 * Math.sqrt(h + 8.313659)) +
    Math.atan(t + h) -
    Math.atan(h - 1.676331) +
    0.00391838 * h ** 1.5 * Math.atan(0.023101 * h) -
    4.686035
  );
}

/** Humidity (%) from temperature and dew point (°C). */
const rhOf = (t: number, td: number) =>
  100 * Math.exp((17.625 * td) / (243.04 + td) - (17.625 * t) / (243.04 + t));

export type Derived = {
  lcl: number;
  /** 700–500 mb and surface–700 mb lapse rates (°C/km). */
  lapse75: number | null;
  lapse03: number | null;
  /** Surface mixing ratio (g/kg). */
  mix: number | null;
  scp: number;
  ehi: number;
  ship: number | null;
  /** Wet-bulb zero height above ground (ft). */
  wbzFt: number | null;
};

/** The composites VIP shows, worked out from one hour's model levels (null when a level is missing). */
export function derive(h: Hour): Derived {
  const tC = (h.temp - 32) / 1.8;
  const tdC = (h.dew - 32) / 1.8;
  const elev = h.elev ?? 0;
  const lapse75 =
    fin(h.t700) && fin(h.t500) && fin(h.z700) && fin(h.z500)
      ? r1(((h.t700 - h.t500) / (h.z500 - h.z700)) * 1000)
      : null;
  const lapse03 =
    fin(h.t700) && fin(h.z700) && h.z700 - elev > 500
      ? r1(((tC - h.t700) / (h.z700 - elev)) * 1000)
      : null;
  const e = 6.112 * Math.exp((17.67 * tdC) / (tdC + 243.5));
  const mix = fin(h.pres) ? r1((621.97 * e) / (h.pres - e)) : null;
  const shearMs = h.shear / 1.94384;
  const shearTerm = shearMs < 10 ? 0 : Math.min(1, shearMs / 20);
  const scp = r1(Math.max(0, (h.cape / 1000) * (h.srh / 50) * shearTerm));
  const ehi = r1(Math.max(0, (h.cape * h.srh) / 160000));
  let ship: number | null = null;
  if (mix != null && lapse75 != null && fin(h.t500)) {
    const sh = Math.max(7, Math.min(27, shearMs));
    const mr = Math.max(11, Math.min(13.6, mix));
    const t5 = Math.min(-5.5, h.t500);
    let v = (h.cape * mr * lapse75 * -t5 * sh) / 42_000_000;
    if (h.cape < 1300) v *= h.cape / 1300;
    if (lapse75 < 5.8) v *= lapse75 / 5.8;
    const fz = h.freezingFt / 3.281 - elev;
    if (fz < 2400) v *= Math.max(0, fz) / 2400;
    ship = Math.round(Math.max(0, v) * 100) / 100;
  }
  // Wet-bulb zero: walk up from the ground through 850, 700 and 500 mb to where it crosses 0 °C.
  let wbzFt: number | null = null;
  const levels: [number, number][] = [[0, wetBulb(tC, rhOf(tC, tdC))]];
  for (const [t, z, rh] of [
    [h.t850, h.z850, h.rh850],
    [h.t700, h.z700, h.rh700],
    [h.t500, h.z500, h.rh500],
  ] as const)
    if (fin(t) && fin(z) && fin(rh) && z - elev > 50)
      levels.push([z - elev, wetBulb(t, rh)]);
  if (levels.length > 1) {
    if (levels[0][1] <= 0) wbzFt = 0;
    for (let i = 1; i < levels.length && wbzFt == null; i++) {
      const [z0, w0] = levels[i - 1];
      const [z1, w1] = levels[i];
      if (w0 > 0 && w1 <= 0)
        wbzFt =
          Math.round(((z0 + ((z1 - z0) * w0) / (w0 - w1)) * 3.281) / 100) * 100;
    }
  }
  return {
    lcl: lclFt(h.temp, h.dew),
    lapse75,
    lapse03,
    mix,
    scp,
    ehi,
    ship,
    wbzFt,
  };
}

/** Where today sits in the year (1–5): VIP's "chance this is the year's best". */
export function yearRank(score: number, year: number[]): number {
  if (score < 30 || !year.length) return 1;
  const best = Math.max(...year);
  const pct = percentile(score, year);
  if (score >= best * 0.95 && score >= 50) return 5;
  if (pct >= 90) return 4;
  if (pct >= 75) return 3;
  if (pct >= 50) return 2;
  return 1;
}

export const YEARLY_MEANING: Record<number, { title: string; body: string }> = {
  1: {
    title: "No chance of being the year's best",
    body: "A day you chase because you're already out, not one you drive for.",
  },
  2: {
    title: "Very little chance",
    body: "A real setup with a real ceiling. Worth going if it's close to you.",
  },
  3: {
    title: "Has a chance",
    body: "The kind of day that turns into the year's best about as often as it doesn't.",
  },
  4: {
    title: "Good chance",
    body: "Clear your calendar. Days like this are why the season exists.",
  },
  5: {
    title: "Very high chance this is the year's best",
    body: "Go. You'll remember where you were on this one.",
  },
};
