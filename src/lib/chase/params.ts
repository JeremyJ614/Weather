import { derive, type Derived, type Hour } from "./score";

/**
 * The Parameters tab, grouped the way a chaser reads a sounding (VIP's groups): what the air
 * is made of, whether it rises, whether it turns, what the composites say, and the sky.
 * Every row says where its value sits and what that does to a storm.
 */
export type ParamRow = {
  id: string;
  label: string;
  unit: string;
  /** Higher is better for chasing, lower is better, or neither. */
  sense: "up" | "down" | "flat";
  /** Value at which the bar reads full. */
  full: number;
  get: (h: Hour, d: Derived) => number | null | undefined;
  read: (v: number) => string;
  effect: (v: number) => string;
};
export type ParamGroup = { title: string; blurb: string; rows: ParamRow[] };

export const PARAM_GROUPS: ParamGroup[] = [
  {
    title: "Fuel",
    blurb: "How much energy the atmosphere has to give a storm.",
    rows: [
      {
        id: "cape",
        label: "CAPE",
        unit: "J/kg",
        sense: "up",
        full: 4000,
        get: (h) => h.cape,
        read: (v) =>
          v >= 3500
            ? "Loaded"
            : v >= 2000
              ? "Plenty"
              : v >= 1000
                ? "Workable"
                : v >= 400
                  ? "Thin"
                  : "Not much",
        effect: (v) =>
          v >= 3500
            ? "Updrafts go up hard and fast. Hail gets time to grow, and anything rotating does it violently."
            : v >= 2000
              ? "Enough energy for strong updrafts and severe hail once storms get going."
              : v >= 1000
                ? "Storms will go up, but they'll need help to get severe."
                : v >= 400
                  ? "Weak updrafts. Showers and the odd rumble rather than a chase."
                  : "Not enough to lift air anywhere. Nothing gets off the ground.",
      },
      {
        id: "li",
        label: "Lifted index",
        unit: "",
        sense: "down",
        full: -10,
        get: (h) => h.li,
        read: (v) =>
          v <= -8
            ? "Very unstable"
            : v <= -5
              ? "Unstable"
              : v <= -2
                ? "Mildly unstable"
                : "Stable",
        effect: (v) =>
          v <= -8
            ? "Air released at the ground accelerates the whole way up. Explosive growth once the cap breaks."
            : v <= -5
              ? "Air rises freely. Storms build quickly through the afternoon."
              : v <= -2
                ? "Storms are possible but slow to build and easy to kill."
                : "Air near the ground is heavier than its surroundings. It won't rise on its own.",
      },
      {
        id: "dew",
        label: "Surface dew point",
        unit: "°F",
        sense: "up",
        full: 78,
        get: (h) => h.dew,
        read: (v) =>
          v >= 72
            ? "Tropical"
            : v >= 65
              ? "Good moisture"
              : v >= 58
                ? "Adequate"
                : "Dry",
        effect: (v) =>
          v >= 72
            ? "Gulf-quality moisture. Bases sit low, inflow is dense, and rain-wrapping becomes the problem."
            : v >= 65
              ? "Enough moisture for low bases and a real tornado threat under a rotating storm."
              : v >= 58
                ? "Workable. Bases will be higher and the storm has to work for its moisture."
                : "Too dry. Cloud bases end up thousands of feet up and any spin stays off the ground.",
      },
      {
        id: "mix",
        label: "Mixing ratio",
        unit: "g/kg",
        sense: "up",
        full: 18,
        get: (_, d) => d.mix,
        read: (v) =>
          v >= 15
            ? "Very moist"
            : v >= 12
              ? "Moist"
              : v >= 9
                ? "Modest"
                : "Dry",
        effect: (v) =>
          v >= 15
            ? "A very wet low level. Heavy rain loading, and rain-wrapped storms are likely."
            : v >= 12
              ? "Good low-level moisture feeding the updraft."
              : v >= 9
                ? "Enough to work with, but the storm won't be efficient with it."
                : "A dry inflow. Downdrafts will be cold and undercut the updraft.",
      },
      {
        id: "temp",
        label: "Surface temperature",
        unit: "°F",
        sense: "flat",
        full: 100,
        get: (h) => h.temp,
        read: () => "",
        effect: () => "",
      },
      {
        id: "cin",
        label: "Cap (CIN)",
        unit: "J/kg",
        sense: "down",
        full: 300,
        get: (h) => Math.abs(h.cin),
        read: (v) =>
          v >= 250
            ? "Hard cap"
            : v >= 150
              ? "Strong cap"
              : v >= 60
                ? "Cap in place"
                : v >= 20
                  ? "Weak cap"
                  : "Uncapped",
        effect: (v) =>
          v >= 250
            ? "The cap holds. Nothing breaks it without serious lift, and the sky most likely stays blue."
            : v >= 150
              ? "A strong cap keeps storms few and spaced out if something breaks it, and kills the day if nothing does."
              : v >= 60
                ? "A useful cap: it stops early junk and lets one or two storms have the whole airmass."
                : v >= 20
                  ? "Barely holding. Expect early storms and more of them than you want."
                  : "Nothing holds anything back. Storms go up everywhere at once and fight over the inflow.",
      },
    ],
  },
  {
    title: "Lift and lapse",
    blurb: "Whether the air gets moving, and how fast it cools with height.",
    rows: [
      {
        id: "lapse75",
        label: "700–500 mb lapse rate",
        unit: "°C/km",
        sense: "up",
        full: 9,
        get: (_, d) => d.lapse75,
        read: (v) =>
          v >= 8 ? "Steep" : v >= 7 ? "Good" : v >= 6 ? "Modest" : "Poor",
        effect: (v) =>
          v >= 8
            ? "Steep mid-level lapse rates: strong updrafts and large hail. The profile that makes Plains storms hit hard."
            : v >= 7
              ? "Good lapse rates. The updraft keeps speeding up through the hail-growth zone."
              : v >= 6
                ? "Modest. Updrafts will be adequate rather than impressive."
                : "Too gentle. Updrafts stay weak whatever the CAPE says.",
      },
      {
        id: "lapse03",
        label: "Low-level lapse rate",
        unit: "°C/km",
        sense: "up",
        full: 9.8,
        get: (_, d) => d.lapse03,
        read: (v) => (v >= 8.5 ? "Well mixed" : v >= 7 ? "Mixing" : "Shallow"),
        effect: (v) =>
          v >= 8.5
            ? "A well-mixed low level, which feeds strong outflow and damaging gusts."
            : v >= 7
              ? "Mixing is happening. Reasonable ground-based storms."
              : "A stable low level. Storms will struggle to stay rooted at the ground.",
      },
      {
        id: "w700",
        label: "700 mb vertical motion",
        unit: "m/s",
        sense: "up",
        full: 0.6,
        get: (h) => h.w700,
        read: (v) =>
          v >= 0.3
            ? "Strong ascent"
            : v >= 0.1
              ? "Ascent"
              : v >= 0
                ? "Weak ascent"
                : "Sinking",
        effect: (v) =>
          v >= 0.3
            ? "Strong large-scale lift. The cap gets broken for you and storms fire on time."
            : v >= 0.1
              ? "Enough lift to get storms going along a boundary."
              : v >= 0
                ? "Only weak lift. Storms will depend on a local boundary rather than the big pattern."
                : "The air is sinking. Anything that tries to go up gets pushed back down.",
      },
      {
        id: "pbl",
        label: "Boundary layer depth",
        unit: "m",
        sense: "flat",
        full: 3000,
        get: (h) => h.pbl,
        read: (v) => (v >= 2000 ? "Deep" : v >= 1000 ? "Normal" : "Shallow"),
        effect: (v) =>
          v >= 2000
            ? "A deep mixed layer: high bases and strong outflow. Good for wind, harder for tornadoes."
            : v >= 1000
              ? "A normal afternoon mixed layer. Nothing working against you."
              : "Shallow mixing. Bases stay low, which helps rotation reach the ground.",
      },
      {
        id: "t500",
        label: "500 mb temperature",
        unit: "°C",
        sense: "down",
        full: -20,
        get: (h) => h.t500,
        read: (v) =>
          v <= -16 ? "Cold aloft" : v <= -10 ? "Cool aloft" : "Warm aloft",
        effect: (v) =>
          v <= -16
            ? "Cold air aloft over a warm surface. That contrast is where the instability comes from."
            : v <= -10
              ? "Cool enough aloft for decent updrafts."
              : "Too warm aloft. The atmosphere can't build much instability whatever the surface does.",
      },
      {
        id: "t850",
        label: "850 mb temperature",
        unit: "°C",
        sense: "flat",
        full: 30,
        get: (h) => h.t850,
        read: (v) =>
          v >= 16 ? "Capping warmth" : v >= 12 ? "Some warmth" : "Cool",
        effect: (v) =>
          v >= 16
            ? "Warm air at 850 mb is the cap. It holds storms off until late, then lets one or two go."
            : v >= 12
              ? "Some warmth aloft: a soft cap that breaks by mid-afternoon."
              : "No warm layer to hold anything back. Expect early, numerous, messy storms.",
      },
    ],
  },
  {
    title: "Rotation",
    blurb: "Whether a storm can turn, and how low its base will sit.",
    rows: [
      {
        id: "shear",
        label: "0–6 km shear",
        unit: "kt",
        sense: "up",
        full: 70,
        get: (h) => h.shear,
        read: (v) =>
          v >= 50
            ? "Supercell shear"
            : v >= 35
              ? "Organized"
              : v >= 25
                ? "Marginal"
                : "Weak",
        effect: (v) =>
          v >= 50
            ? "Updraft and downdraft separate cleanly, so a storm can hold together for hours."
            : v >= 35
              ? "Enough to organize storms into supercells and keep them alive."
              : v >= 25
                ? "Marginal. Storms organize briefly, then collapse into a cluster."
                : "The storm rains into its own inflow and dies within the hour.",
      },
      {
        id: "shear01",
        label: "0–1 km shear",
        unit: "kt",
        sense: "up",
        full: 35,
        get: (h) => h.shear01,
        read: (v) => (v >= 25 ? "Strong" : v >= 15 ? "Useful" : "Weak"),
        effect: (v) =>
          v >= 25
            ? "Strong low-level shear. Rotation reaches close to the ground, which is where tornadoes come from."
            : v >= 15
              ? "Useful. A rotating storm has something to work with near the ground."
              : "Rotation stays up in the cloud and never tightens near the ground.",
      },
      {
        id: "srh",
        label: "0–3 km helicity",
        unit: "m²/s²",
        sense: "up",
        full: 500,
        get: (h) => h.srh,
        read: (v) =>
          v >= 300
            ? "Very high"
            : v >= 150
              ? "Supportive"
              : v >= 75
                ? "Modest"
                : "Low",
        effect: (v) =>
          v >= 300
            ? "Plenty of spin for the updraft to tilt. Rotation forms early and holds."
            : v >= 150
              ? "Enough helicity to support a rotating updraft."
              : v >= 75
                ? "Modest. Rotation will be broad and slow to organize."
                : "Not enough turning in the inflow for a storm to start rotating.",
      },
      {
        id: "srh01",
        label: "0–1 km helicity",
        unit: "m²/s²",
        sense: "up",
        full: 350,
        get: (h) => h.srh01,
        read: (v) =>
          v >= 200 ? "Tornadic range" : v >= 100 ? "Supportive" : "Low",
        effect: (v) =>
          v >= 200
            ? "The lowest kilometer is doing the work: the range tied to strong tornadoes."
            : v >= 100
              ? "Supports low-level rotation once a storm matures."
              : "Rotation will stay aloft: wall clouds without much underneath.",
      },
      {
        id: "lcl",
        label: "Cloud base (LCL)",
        unit: "ft",
        sense: "down",
        full: 5000,
        get: (_, d) => d.lcl,
        read: (v) =>
          v <= 1200
            ? "Very low"
            : v <= 2500
              ? "Low"
              : v <= 4000
                ? "Moderate"
                : "High",
        effect: (v) =>
          v <= 1200
            ? "A very low base. The air behind the storm stays warm, which lets a circulation reach the ground."
            : v <= 2500
              ? "Low enough for tornadoes if everything else lines up."
              : v <= 4000
                ? "Bases are getting high. Outflow will be cold and undercut the updraft."
                : "Bases far too high: a pretty storm with very little at ground level.",
      },
      {
        id: "rh700",
        label: "700 mb humidity",
        unit: "%",
        sense: "flat",
        full: 100,
        get: (h) => h.rh700,
        read: (v) =>
          v >= 72
            ? "Moist, HP look"
            : v <= 42
              ? "Dry, LP look"
              : "Classic range",
        effect: (v) =>
          v >= 72
            ? "Moist mid-levels wrap the rotation in rain. A tornado can be hidden until it's close."
            : v <= 42
              ? "Dry mid-levels keep rain off the updraft: sculpted structure, big hail, fewer tornadoes."
              : "Dry enough to keep rain off the business end without starving the storm.",
      },
    ],
  },
  {
    title: "Composites and hail",
    blurb: "The indices forecasters quote, plus what they mean for hail.",
    rows: [
      {
        id: "stp",
        label: "Significant tornado",
        unit: "",
        sense: "up",
        full: 6,
        get: (h) => h.stp,
        read: (v) =>
          v >= 3
            ? "Strongly supportive"
            : v >= 1
              ? "Supportive"
              : v > 0
                ? "Marginal"
                : "Not supportive",
        effect: (v) =>
          v >= 3
            ? "In the range where significant tornadoes happen when a storm goes up."
            : v >= 1
              ? "Supports tornadoes. Most tornado days sit here."
              : v > 0
                ? "Marginal. A tornado would be brief and lucky."
                : "The ingredients don't line up for a tornado, whatever else the storm does.",
      },
      {
        id: "scp",
        label: "Supercell composite",
        unit: "",
        sense: "up",
        full: 12,
        get: (_, d) => d.scp,
        read: (v) =>
          v >= 6
            ? "Strongly supportive"
            : v >= 2
              ? "Supportive"
              : v >= 1
                ? "Marginal"
                : "Low",
        effect: (v) =>
          v >= 6
            ? "Strongly supercellular. Any storm that goes up should rotate."
            : v >= 2
              ? "Supports supercells."
              : v >= 1
                ? "Marginal. Brief rotation at best."
                : "Not a supercell setup: clusters and lines.",
      },
      {
        id: "ship",
        label: "Significant hail",
        unit: "",
        sense: "up",
        full: 4,
        get: (_, d) => d.ship,
        read: (v) =>
          v >= 2
            ? "Big hail likely"
            : v >= 1
              ? "Severe hail"
              : v >= 0.5
                ? "Marginal hail"
                : "Small hail",
        effect: (v) =>
          v >= 2
            ? "Two inches and up, the kind that breaks glass. Keep the car pointed away."
            : v >= 1
              ? "Severe hail, an inch or larger."
              : v >= 0.5
                ? "Marginal hail: unpleasant, not dangerous."
                : "Small hail at most.",
      },
      {
        id: "ehi",
        label: "Energy-helicity index",
        unit: "",
        sense: "up",
        full: 4,
        get: (_, d) => d.ehi,
        read: (v) =>
          v >= 2 ? "Strongly supportive" : v >= 1 ? "Supportive" : "Low",
        effect: (v) =>
          v >= 2
            ? "Instability and spin are both there and working together: what tornado days are made of."
            : v >= 1
              ? "Supportive. Both ingredients are present without being remarkable."
              : "One of the two is missing. Spin and energy aren't lining up.",
      },
      {
        id: "freezing",
        label: "Freezing level",
        unit: "ft",
        sense: "down",
        full: 16000,
        get: (h) => h.freezingFt,
        read: (v) =>
          v <= 10000
            ? "Low, hail survives"
            : v <= 13000
              ? "Moderate"
              : "High, hail melts",
        effect: (v) =>
          v <= 10000
            ? "Hail falls through less warm air and reaches the ground still large."
            : v <= 13000
              ? "Hail shrinks on the way down but should still reach severe size."
              : "Anything but the biggest stones melts before it lands.",
      },
      {
        id: "wbz",
        label: "Wet-bulb zero",
        unit: "ft",
        sense: "down",
        full: 16000,
        get: (_, d) => d.wbzFt,
        read: (v) =>
          v <= 8000
            ? "Ideal for hail"
            : v <= 10500
              ? "Favorable"
              : "Too high for big hail",
        effect: (v) =>
          v <= 8000
            ? "Ideal for hail reaching the ground intact."
            : v <= 10500
              ? "Favorable for severe hail."
              : "The melting layer is deep enough to take the edge off anything falling through it.",
      },
    ],
  },
  {
    title: "Timing and sky",
    blurb:
      "The practical things that decide whether you actually see anything.",
    rows: [
      {
        id: "pop",
        label: "Precipitation chance",
        unit: "%",
        sense: "up",
        full: 100,
        get: (h) => h.pop,
        read: (v) =>
          v >= 60
            ? "Storms expected"
            : v >= 30
              ? "Scattered"
              : "Isolated at best",
        effect: (v) =>
          v >= 60
            ? "Storms are expected here rather than merely possible."
            : v >= 30
              ? "Scattered coverage. Pick the right storm and commit early."
              : "Isolated at best: a day you can drive all afternoon and see nothing.",
      },
      {
        id: "lowCloud",
        label: "Low cloud",
        unit: "%",
        sense: "down",
        full: 100,
        get: (h) => h.lowCloud,
        read: (v) =>
          v >= 80 ? "Overcast" : v >= 40 ? "Partly cloudy" : "Clear",
        effect: (v) =>
          v >= 80
            ? "Overcast. Heating is cut off, the air struggles to destabilize, and you won't see structure anyway."
            : v >= 40
              ? "Broken cloud. Some heating gets through; structure is partly visible."
              : "Clear skies: full heating, and the storm is visible from miles away.",
      },
      {
        id: "pres",
        label: "Surface pressure",
        unit: "mb",
        sense: "flat",
        full: 1040,
        get: (h) => h.pres,
        read: () => "",
        effect: () => "",
      },
    ],
  },
];

/** Bar fill (0–1) for a value, honoring which direction is better. */
export function fillFor(row: ParamRow, v: number): number {
  const c = (x: number) => Math.max(0, Math.min(1, x));
  if (row.sense === "down" && row.full > 0) return c(1 - v / row.full);
  return c(v / row.full);
}

/** Which of two targets wins a row: 0, 1, or -1 for neither. */
export function betterOf(row: ParamRow, a: number, b: number): 0 | 1 | -1 {
  if (row.sense === "flat" || a === b) return -1;
  const aWins = row.sense === "up" ? a > b : a < b;
  return aWins ? 0 : 1;
}

/** One row's value at a target's peak hour, or null when that run didn't carry it. */
export function valueOf(row: ParamRow, h: Hour, d = derive(h)) {
  const v = row.get(h, d);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
