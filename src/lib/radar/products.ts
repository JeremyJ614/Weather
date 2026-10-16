/** Radar, MRMS and satellite tile products for Radar & Model Runs (ported from VIP). */
export type Swatch = { color: string; label: string };
const REFL: Swatch[] = [
  { color: "#04e9e7", label: "Light" },
  { color: "#02fd02", label: "Moderate" },
  { color: "#fdf802", label: "Heavy" },
  { color: "#fd0000", label: "Intense" },
  { color: "#d400f9", label: "Hail / extreme" },
];
const HEIGHT: Swatch[] = [
  { color: "#1d4ed8", label: "Low" },
  { color: "#22c55e", label: "Moderate" },
  { color: "#facc15", label: "Tall" },
  { color: "#ef4444", label: "Towering" },
];
const CLASS: Swatch[] = [
  { color: "#22c55e", label: "Rain" },
  { color: "#38bdf8", label: "Snow / ice" },
  { color: "#f97316", label: "Mixed" },
  { color: "#ef4444", label: "Hail" },
];
const LIQUID: Swatch[] = [
  { color: "#7ec8e3", label: "A trace" },
  { color: "#2ecc71", label: "Under ½ inch" },
  { color: "#f1c40f", label: "An inch or so" },
  { color: "#e67e22", label: "Two to four" },
  { color: "#c0392b", label: "Flooding rain" },
];
const IR: Swatch[] = [
  { color: "#1e293b", label: "Warm / low cloud" },
  { color: "#f97316", label: "Cold tops" },
  { color: "#ffffff", label: "Coldest (severe)" },
];

export type Product = {
  id: string;
  label: string;
  group: "Radar" | "MRMS" | "Satellite";
  /** IEM codes support a 50-minute loop; RealEarth products show the latest image. */
  source: "iem" | "realearth";
  code: string;
  desc: string;
  legend: Swatch[];
};

export const PRODUCTS: Product[] = [
  {
    id: "n0q",
    label: "Base Reflectivity",
    group: "Radar",
    source: "iem",
    code: "nexrad-n0q-900913",
    desc: "Where it is raining and how hard: the national NEXRAD mosaic. Loops the last 50 minutes.",
    legend: REFL,
  },
  {
    id: "nexrdhr",
    label: "Hybrid-Scan",
    group: "Radar",
    source: "realearth",
    code: "nexrdhr",
    desc: "The lowest usable radar beam everywhere: closest to what reaches the ground.",
    legend: REFL,
  },
  {
    id: "nexreet",
    label: "Echo Tops",
    group: "Radar",
    source: "realearth",
    code: "nexreet",
    desc: "How tall storms are. Fast-rising tops mark strengthening updrafts.",
    legend: HEIGHT,
  },
  {
    id: "nexrhhc",
    label: "Hydrometeor Class",
    group: "Radar",
    source: "realearth",
    code: "nexrhhc",
    desc: "Dual-pol call on what the radar sees: rain, snow, mixed or hail.",
    legend: CLASS,
  },
  {
    id: "nexrcomp",
    label: "MRMS Composite",
    group: "MRMS",
    source: "realearth",
    code: "nexrcomp",
    desc: "Every radar merged into one seamless national mosaic.",
    legend: REFL,
  },
  {
    id: "nexrdvl",
    label: "VIL (hail)",
    group: "MRMS",
    source: "realearth",
    code: "nexrdvl",
    desc: "Water held aloft in storms. High VIL flags hail.",
    legend: LIQUID,
  },
  {
    id: "nexr1hpcp",
    label: "1-Hour Rain",
    group: "MRMS",
    source: "realearth",
    code: "nexr1hpcp",
    desc: "Radar-estimated rain over the past hour.",
    legend: LIQUID,
  },
  {
    id: "nexrphase",
    label: "Precip Type",
    group: "MRMS",
    source: "realearth",
    code: "nexrphase",
    desc: "Rain, freezing rain, sleet or snow across the country.",
    legend: CLASS,
  },
  {
    id: "band13",
    label: "Infrared",
    group: "Satellite",
    source: "realearth",
    code: "G19-ABI-CONUS-BAND13",
    desc: "Cloud-top temperature day and night; the coldest tops are the strongest storms.",
    legend: IR,
  },
  {
    id: "truecolor",
    label: "True Color",
    group: "Satellite",
    source: "realearth",
    code: "G19-ABI-CONUS-true-color",
    desc: "GOES-East natural color. Daytime only.",
    legend: [],
  },
  {
    id: "wv",
    label: "Water Vapor",
    group: "Satellite",
    source: "realearth",
    code: "G19-ABI-CONUS-BAND09-VAPR",
    desc: "Mid-level moisture: dry slots and moisture plumes that steer storms.",
    legend: [],
  },
];

/** IEM's 50-minute reflectivity loop, oldest first ("" is now). */
export const LOOP = [
  "-m50m",
  "-m45m",
  "-m40m",
  "-m35m",
  "-m30m",
  "-m25m",
  "-m20m",
  "-m15m",
  "-m10m",
  "-m05m",
  "",
];

export function tileUrl(p: Product, bust: number, suffix = ""): string {
  return p.source === "iem"
    ? `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/${p.code}${suffix}/{z}/{x}/{y}.png?_=${bust}`
    : `https://realearth.ssec.wisc.edu/tiles/${p.code}/{z}/{x}/{y}.png?_=${bust}`;
}

/** NOAA model maps (NCEP MAG): which fields each model publishes and its frame hours. */
export const MODEL_MAPS = {
  gfs: {
    label: "GFS",
    hours: Array.from({ length: 40 }, (_, i) => (i + 1) * 6),
    fields: {
      sim_radar_comp: "Simulated radar",
      "10m_wnd_2m_temp": "Temperature & wind",
      precip_p03: "3-hour precipitation",
      precip_ptot: "Total precipitation",
      "850_temp_mslp_precip": "Pressure & precip",
      "500_vort_ht": "500 mb vorticity",
    } as Record<string, string>,
  },
  nam: {
    label: "NAM",
    hours: Array.from({ length: 28 }, (_, i) => (i + 1) * 3),
    fields: {
      "10m_wnd_2m_temp": "Temperature & wind",
      precip_p03: "3-hour precipitation",
      precip_ptot: "Total precipitation",
      "850_temp_mslp_precip": "Pressure & precip",
      "500_vort_ht": "500 mb vorticity",
    } as Record<string, string>,
  },
} as const;
export type ModelId = keyof typeof MODEL_MAPS;

/** The image URL for one model frame (GFS uses nested folders, NAM a flat one). */
export function magUrl(
  model: ModelId,
  cycle: string,
  field: string,
  hour: number,
): string {
  const h = String(hour).padStart(3, "0");
  return model === "gfs"
    ? `https://mag.ncep.noaa.gov/data/gfs/${cycle}/namer/${field}/gfs_namer_${h}_${field}.gif`
    : `https://mag.ncep.noaa.gov/data/nam/${cycle}/nam_namer_${h}_${field}.gif`;
}

/** Models compared at your location (Open-Meteo ids) with their default line colors. */
export const COMPARE = [
  { id: "ncep_hrrr_conus", key: "hrrr", label: "HRRR", color: "#f472b6" },
  { id: "ncep_nam_conus", key: "nam", label: "NAM", color: "#fbbf24" },
  { id: "gfs_seamless", key: "gfs", label: "GFS", color: "#f97316" },
  { id: "ecmwf_ifs025", key: "ecmwf", label: "ECMWF", color: "#4cc9f0" },
  { id: "icon_seamless", key: "icon", label: "ICON", color: "#a78bfa" },
  { id: "gem_seamless", key: "gem", label: "GEM", color: "#6ee7a8" },
];
