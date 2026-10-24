"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GeoJSONSource,
  Map as MaplibreMap,
  MapMouseEvent,
} from "maplibre-gl";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CloudLightning,
  Fish,
  Flame,
  FlaskConical,
  GitMerge,
  History,
  Radar,
  Rainbow,
  Snowflake,
  Sprout,
  Sunset,
  Tornado,
  Trees,
  Umbrella,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { WeatherMap, type ReadyMap } from "@/features/map/WeatherMap";
import { pick, type Colors } from "@/lib/colors/pick";
import { stateOf, type ExtrasStates } from "@/lib/extras/items";
import {
  ANALOG_BANDS,
  ANALOG_DOTS,
  BLIND_BANDS,
  BOUND_POINTS,
  FIELD_BANDS,
  FIRST_TIME_BANDS,
  OUTDOOR_BANDS,
  PYRO_BINS,
  SURGE_BANDS,
  TOR_BINS,
  pyroBin,
  torBin,
  type FieldId,
  type OutdoorId,
} from "@/lib/engines/colors";
import type { SpeciesId } from "@/lib/engines/outdoor";
import { read as readPlaces } from "@/features/location/store";
import {
  PlacePanel,
  ReportBox,
  ReportSummary,
  SpeciesPicker,
  type PlaceData,
  type Summary,
} from "./OutdoorPanel";
import type { EngineStorm, WrapStorm } from "@/lib/engines/probsevere";
import type { SurgeStorm } from "@/lib/engines/surge";
import type { Areas } from "@/lib/engines/areas";
import radars from "@/lib/engines/radars.json";
import s from "./Engines.module.css";

type Engine = "tor" | "surge" | "analog" | "blind" | FieldId | OutdoorId;
const FIELDS: FieldId[] = [
  "llj",
  "nst",
  "pyro",
  "tctor",
  "stp",
  "scp",
  "dcp",
  "ltg",
  "rwrap",
  "blizz",
  "first",
  "sunset",
  "bound",
];
const isField = (e: Engine): e is FieldId => FIELDS.includes(e as FieldId);
const isPlace = (e: Engine): e is OutdoorId =>
  e === "rainbow" || e === "deer" || e === "fish";
const bandsOf = (e: FieldId | OutdoorId) =>
  isPlace(e) ? OUTDOOR_BANDS[e] : FIELD_BANDS[e];
/** The map's second and third views, by engine. */
const VIEWS: Partial<Record<Engine, string[]>> = {
  first: ["Chance", "Timing"],
  sunset: ["Sunset", "Sunrise"],
  rainbow: ["Now", "+30 min", "+60 min"],
  analog: ["Today", "Tomorrow"],
  bound: ["Now", "In 3 hours"],
};
type Collision = {
  lat: number;
  lon: number;
  place: string;
  at: number;
  spread: number;
  kinds: string;
  score: number;
  evidence: string[];
};
type AnalogData = {
  day: string;
  ready: boolean;
  made_at?: string;
  cycle?: string;
  p10?: number;
  p25?: number;
  p50?: number;
  torn?: number;
  analogs?: { day: string; dist: number; n: number; torn: number }[];
  areas?: Areas;
  used?: number;
  score: {
    days: number;
    scored: number;
    brier: number | null;
    low: { n: number; hit: number };
    mid: { n: number; hit: number };
    high: { n: number; hit: number };
  } | null;
};
type RainbowData = {
  at: string;
  maps: Areas[];
  spots: {
    lat: number;
    lon: number;
    value: number;
    place: string;
    look: string;
    top: number;
  }[][];
  lowSun: boolean[];
  reports: Summary;
};
type PlaceMap = {
  areas: Areas;
  spots: Spot[];
  reports: Summary;
};
type Spot = {
  lat: number;
  lon: number;
  value: number;
  place: string;
  water?: boolean;
  note?: string;
  at?: number;
};
type Fire = {
  name: string;
  state: string;
  acres: number;
  contained: number | null;
  lat: number;
  lon: number;
  hdwi: number;
  lapse: number;
  chance: number;
  blowup: string;
};
type FieldData = {
  cycle: string;
  fh: number;
  valid: string;
  bounds: number[];
  areas: Areas;
  alt?: Areas | null;
  spots: Spot[];
  fires?: Fire[];
  storms?: { name: string; lat: number; lon: number; mph: number }[];
  note: string | null;
  stats?: { days: number; checked: number; hits: number } | null;
  altSpots?: Spot[] | null;
  points?: Collision[];
  reports?: Summary;
};
type Data = {
  at: string;
  total: number;
  storms: EngineStorm[];
  tor: GeoJSON.FeatureCollection;
  torAreas: Areas;
};
type SurgeData = {
  at: string;
  total: number;
  minutes: number;
  storms: SurgeStorm[];
  polys: GeoJSON.FeatureCollection;
  stats: { days: number; checked: number; hits: number } | null;
};
const EMPTY: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

/** The picker's sections, in order. */
const SECTIONS: { name: string; ids: Engine[] }[] = [
  { name: "Storms now", ids: ["tor", "surge", "bound", "first"] },
  {
    name: "Forecast",
    ids: [
      "analog",
      "stp",
      "scp",
      "rwrap",
      "dcp",
      "ltg",
      "llj",
      "nst",
      "blizz",
      "pyro",
      "tctor",
    ],
  },
  { name: "Outdoors", ids: ["sunset", "rainbow", "deer", "fish"] },
  { name: "Tools", ids: ["blind"] },
];

const ENGINES: {
  id: Engine;
  name: string;
  sub: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "tor",
    name: "ProbTor",
    sub: "Tornado chance, next hour",
    icon: <Tornado aria-hidden />,
  },
  {
    id: "surge",
    name: "Lightning Surge",
    sub: "Lightning jumps, now",
    icon: <Activity aria-hidden />,
  },
  {
    id: "bound",
    name: "Boundary Collisions",
    sub: "Where boundaries meet, 3 h",
    icon: <GitMerge aria-hidden />,
  },
  {
    id: "first",
    name: "First Storms",
    sub: "Where storms start, 6 h",
    icon: <Sprout aria-hidden />,
  },
  {
    id: "analog",
    name: "Severe Analogs",
    sub: "Past days like today",
    icon: <History aria-hidden />,
  },
  {
    id: "stp",
    name: "Significant Tornado",
    sub: "STP, this evening",
    icon: <Tornado aria-hidden />,
  },
  {
    id: "scp",
    name: "Supercell Composite",
    sub: "SCP, this evening",
    icon: <CloudLightning aria-hidden />,
  },
  {
    id: "dcp",
    name: "Derecho Composite",
    sub: "Long-lived wind storms",
    icon: <Wind aria-hidden />,
  },
  {
    id: "ltg",
    name: "Lightning Threat",
    sub: "Next 3 hours",
    icon: <Zap aria-hidden />,
  },
  {
    id: "llj",
    name: "Nocturnal LLJ",
    sub: "Low-level jet ramp-up tonight",
    icon: <Wind aria-hidden />,
  },
  {
    id: "nst",
    name: "Landspouts & Waterspouts",
    sub: "Non-supercell tornadoes",
    icon: <Waves aria-hidden />,
  },
  {
    id: "pyro",
    name: "Wildfire & PyroCb",
    sub: "Blowups and fire storms",
    icon: <Flame aria-hidden />,
  },
  {
    id: "rwrap",
    name: "Rain-Wrap Index",
    sub: "Will tornadoes hide in rain?",
    icon: <Umbrella aria-hidden />,
  },
  {
    id: "blizz",
    name: "Blizzard Composite",
    sub: "Hours of whiteout, 2 days",
    icon: <Snowflake aria-hidden />,
  },
  {
    id: "sunset",
    name: "Sunset & Sunrise",
    sub: "How colorful, tonight",
    icon: <Sunset aria-hidden />,
  },
  {
    id: "rainbow",
    name: "Rainbow Chance",
    sub: "Now and next hour",
    icon: <Rainbow aria-hidden />,
  },
  {
    id: "deer",
    name: "Deer Activity",
    sub: "Ohio and nearby, 3 days",
    icon: <Trees aria-hidden />,
  },
  {
    id: "fish",
    name: "Fishing Bite",
    sub: "Ohio and nearby, 3 days",
    icon: <Fish aria-hidden />,
  },
  {
    id: "tctor",
    name: "Hurricane Tornadoes",
    sub: "Landfalling storm risk",
    icon: <Tornado aria-hidden />,
  },
  {
    id: "blind",
    name: "Radar Blind Spot",
    sub: "How low the radar sees",
    icon: <Radar aria-hidden />,
  },
];

const HOW: Record<Engine, { lead: string; body: string[] }> = {
  tor: {
    lead: "Good for the next 20 minutes, weak beyond 30.",
    body: [
      "Every storm comes from NOAA and the University of Wisconsin's ProbSevere v3, which blends radar, satellite, lightning and the HRRR model into a tornado chance for each storm, updated every two minutes.",
      "ProbTor carries that chance 20 minutes forward and nudges it by what the storm is doing right now: whether its low-level rotation (radar azimuthal shear) has grown or weakened over the last 10 minutes, and whether its lightning has suddenly jumped, which often comes 10 to 20 minutes before severe weather.",
      "Each storm is projected along its own motion for 0–20, 20–40 and 40–60 minutes, and the map draws the chances the way SPC draws an outlook: nested, outlined areas around each path that fade with distance, merging where storms run together. Zoom in to see each storm's own 20-minute cones. The later chances only fade: past half an hour nobody can say much more.",
      "This is an experimental guide, never a warning. Act on National Weather Service warnings.",
    ],
  },
  surge: {
    lead: "A 10 to 20 minute heads-up, with false alarms.",
    body: [
      "A storm's lightning often jumps just before it turns severe, as a strengthening updraft lofts more ice and charges the cloud faster. This engine follows each storm NOAA and the University of Wisconsin's ProbSevere is tracking, reading its total flash rate from every new file (one every 2 minutes) for the last 20 minutes.",
      'It uses the "2σ" lightning jump from research by Schultz and others: the change in flash rate over each 2 minutes is compared with how much it varied over the 10 minutes before. A rise more than two standard deviations above that, in a storm flashing at least 10 times a minute, is a jump, and the storm stays flagged for 10 minutes. A jump of three or more, or one the radar backs up with tightening low-level rotation or a hail core growing by a quarter inch, is a strong jump.',
      "In research with ground-based lightning networks about 4 in 5 severe storms jumped first, with roughly a third of jumps never followed by severe weather. Ordinary storms jump too, and reports are missed where few people live. The hit rate below is this engine's own, checked every hour against the Weather Service's storm reports.",
      "This is an experimental guide, never a warning. Act on National Weather Service warnings.",
    ],
  },
  bound: {
    lead: "Fronts and drylines good; outflow fair; timing ±30–90 minutes.",
    body: [
      "Storms and tornadoes favor the places where two boundaries meet: a front and a dryline (the triple point), an outflow boundary running into a front or a sea breeze. This engine follows your ten-step design.",
      "It reads the newest HRRR run hour by hour for the next three, and marks boundaries where the surface wind converges along a sharp change in temperature (fronts, outflow) or dew point (drylines). Stretches at least 50 km long are followed from hour to hour, which gives their movement; where two join, or a temperature boundary runs into a moisture boundary, is a collision, timed with an uncertainty that grows with lead time.",
      "Each collision is checked against what is there now: airport winds converging (a least-squares fit of every station within 50 miles), dew points or temperatures splitting across it, the Weather Prediction Center's analyzed fronts, and the HRRR's CAPE, inhibition, low-level spin and shear. The score weighs that evidence; the list says which sources agree.",
      "Strong collisions are checked afterwards against radar (did storms form within 25 miles?) and the hit rate shows below. Station spacing means a boundary can't be placed closer than 15–25 miles.",
    ],
  },
  analog: {
    lead: "Moderate skill: better than the date's averages, checked every day.",
    body: [
      "Forecasters have long asked what happened on days that looked like this one. After Saint Louis University's CIPS analogs, this compares today's and tomorrow's weather from the newest GFS run (daily means of 500 mb height, 850 mb temperature, 850 and 500 mb winds, precipitable water and the lifted index, on a 2.5° grid over the Lower 48) with every day since 2004 within six weeks of the same date, from NOAA's NCEP/NCAR reanalysis.",
      "Each past day is boiled down to a 40-number fingerprint (principal components, weighted toward instability and moisture), and the 15 closest days are the analogs. The chances are the share of them that had 10, 25 or 50 or more severe reports (tornadoes, 1-inch hail, 58 mph wind or damage) in SPC's database; the map is the share with a report within 25 miles of each spot.",
      "It runs four times a day after each GFS run. Once a day is over, it is scored against that day's real reports; the score below is the last 90 days. The reanalysis is coarse, so analogs catch the pattern, not where a storm will be.",
      "Tap a past day to see its reports on the map.",
    ],
  },
  blind: {
    lead: "Precise: it is geometry.",
    body: [
      "Radar beams travel in a straight line while the Earth curves away underneath, so the farther a spot is from a radar, the higher the lowest beam passes over it.",
      "This shows the center of the lowest (0.5°) beam from the nearest of the 159 NWS radars, using the standard 4/3-Earth model, measured above the radar. Terrain is not included, so in the West mountains block more than this shows.",
      "Where the beam is thousands of feet up, a tornado's rotation near the ground can hide under it. Tap anywhere to see the beam height there.",
    ],
  },
  llj: {
    lead: "Good for tonight's pattern; placement within about 100 miles.",
    body: [
      "After sunset the ground cools, friction drops away and the wind a few thousand feet up speeds into a nocturnal low-level jet, which feeds overnight storms and can turn them severe after dark.",
      "From the latest HRRR run, this compares the 850 and 925 mb wind at about 1 a.m. Central with six hours earlier, then weighs in 0–1 km storm-relative helicity and most-unstable CAPE. 0–100: the higher, the stronger and faster the ramp-up where storms could use it.",
      "Mountains are left blank where those pressure levels are underground, and the open ocean is skipped.",
    ],
  },
  nst: {
    lead: "Fair: these tornadoes are hard to forecast.",
    body: [
      "Landspouts and waterspouts don't come from rotating supercells. They form when a growing storm stretches spin that already sits along a wind boundary at the ground.",
      "This is the Storm Prediction Center's Non-Supercell Tornado parameter from the HRRR for the next hour: steep low-level lapse rates, CAPE in the lowest 3 km, little inhibition, weak deep-layer shear and spin in the 10 m wind. 1 and up is favorable.",
      "Over water it is a waterspout index, counted only within about 40 miles of land. A storm still has to form on the boundary for anything to happen.",
    ],
  },
  pyro: {
    lead: "Fair, and experimental.",
    body: [
      "The map is the Hot-Dry-Windy Index at the afternoon peak (about 4 p.m. Central) from the HRRR: how dry the air is (vapor pressure deficit) times the 80 m wind. Around 100 and up, fires can blow up.",
      "Each large active fire (100 acres and up, from the national incident feed) gets a pyrocumulonimbus chance: the HDWI there, a steep 700–500 mb lapse rate, enough mid-level moisture for the smoke plume to build into its own thunderstorm, the fire's size, and how much of it is still uncontained.",
    ],
  },
  stp: {
    lead: "Good for where the setup is; storms still have to form.",
    body: [
      "The Significant Tornado Parameter is the Storm Prediction Center's go-to ingredient blend for tornadoes rated EF2 and up. This is the fixed-layer version from the HRRR at this evening's peak (7 p.m. Central), or as far ahead as the latest run reaches: surface-based CAPE, how low the cloud base (LCL) is, 0–1 km storm-relative helicity, 0–6 km shear and how much the cap is holding storms back.",
      "1 and up marks the environments most significant tornadoes form in; values over 4 are rare and come with the big days. A high number with no storms means nothing happens, so pair it with SPC's outlook.",
    ],
  },
  scp: {
    lead: "Good for where supercells could thrive.",
    body: [
      "The Supercell Composite Parameter weighs whether a storm would rotate as a supercell: most-unstable CAPE, 0–3 km storm-relative helicity and 0–6 km shear, cut down where the cap is strong. From the HRRR at this evening's peak (or as far ahead as the latest run reaches).",
      "1 and up favors supercells, which bring most large hail and strong tornadoes; above 8 is a classic supercell day. Left-moving storms are left off.",
    ],
  },
  dcp: {
    lead: "Fair: derechos need storms to organize first.",
    body: [
      "The Derecho Composite Parameter (Evans and Doswell) looks for long-lived, damaging wind storms: downdraft CAPE (how hard cold air can crash down out of a storm), most-unstable CAPE, 0–6 km shear and a fast 0–6 km mean wind to carry the line along. From the HRRR at this evening's peak (or as far ahead as the latest run reaches).",
      "The HRRR doesn't carry downdraft CAPE, so it is worked out here: a parcel let down from the drier of 700 and 500 mb at its wet-bulb temperature to the ground. 2 and up favors derecho-producing systems once a line of storms gets going.",
    ],
  },
  ltg: {
    lead: "Good for the next few hours.",
    body: [
      "The HRRR forecasts lightning itself: flashes per square kilometer every five minutes, from the ice and graupel moving up and down inside its storms. This is the most each spot gets over the next three hours.",
      "Isolated means the odd strike; frequent and up means lightning every few seconds nearby. Any thunder you hear means you are close enough to be struck, so head indoors.",
    ],
  },
  first: {
    lead: "Placement within about 50 miles half the time; timing within 1–2 hours.",
    body: [
      "Where the first storms of the day break through the cap is one of the hardest things to forecast, and one of the most useful for chasing. This engine asks the last four HRRR runs together (a time-lagged ensemble): in each, a new storm is an echo of 35 dBZ or more with none within 25 miles the hour before. The chance is the share of runs that start a storm within 25 miles of a spot in the next 6 hours.",
      "That share is weighed by the newest run's support: whether the cap (the inhibition, CIN) is weakening over the next three hours, and whether the surface winds are converging, which gives the air its push. Places without the instability to use (most-unstable CAPE under 100 J/kg) are left out, so winter rain bands don't count as storms.",
      "Switch to Timing to see when the first storms start, soonest on top. Each listed spot gives the time, how many runs agree and why.",
      "Every spot of 35% or more is checked once its 6 hours are over against radar (any storm NOAA's ProbSevere tracked within 25 miles), and the hit rate shows below.",
    ],
  },
  rwrap: {
    lead: "Fair to good: storm type is forecast right about two times in three.",
    body: [
      "Some supercells drop their rain far from the tornado, so it stands out against clear sky (low-precipitation, LP). Others wrap it in curtains of heavy rain, where it can't be seen coming (heavy-precipitation, HP), the most dangerous kind for anyone on the road or chasing.",
      "Research by Rasmussen and Straka (1998) found the difference is mostly the wind at anvil level relative to the storm: weak flow (under about 18 m/s) lets the rain fall back around the updraft; strong flow (over about 28 m/s) carries it away. From this evening's HRRR (about 7 p.m. Central) the index weighs that wind between 250 and 300 mb against the model's own storm motion (Bunkers right mover) for 60%, deep moisture (precipitable water) for 30% and a low cloud base for 10%, from 1 (visible) to 100 (rain-wrapped).",
      "It is shown only where supercells are possible (Supercell Composite 1 or more). Storms that merge or run into each other often turn HP whatever the forecast said.",
      "The live list scores the rotating storms ProbSevere is tracking right now the same way, from the 4–6 km storm-relative wind and moisture ProbSevere attaches to each (Brooks and others, 1994).",
    ],
  },
  blizz: {
    lead: "Wind good, snowfall fair, visibility fair to poor.",
    body: [
      "The National Weather Service calls it a blizzard when gusts reach 35 mph with snow, falling or blowing, cutting visibility to a quarter mile or less for three hours or more.",
      "This counts the hours each place meets that test over the next two days: the newest HRRR run every 2 hours out to 18, then the newest 48-hour run (from 00, 06, 12 or 18Z) every 3 hours. Falling snow counts where the model snows with visibility under half a mile; blowing snow counts where at least 2 inches of snow already lie, it is −5 °C (23 °F) or colder so the snow is dry and loose, and gusts reach 40 mph, even with no snow falling.",
      "The model's visibility in snow is its weakest part, and it can't know how crusted the snow on the ground is, so marginal places get false alarms. Interstates are drawn bright so you can see which ones cross the whiteout areas.",
      "Each place with 3 or more hours is checked while it happens against airport reports (a quarter mile or less with 30 kt winds) and afterwards against Weather Service blizzard reports, and the hit rate shows below.",
    ],
  },
  sunset: {
    lead: "Right about two times in three on good vs. poor; less a day out.",
    body: [
      "A colorful sunset needs clouds to catch the light, but not in the way: high and middle clouds overhead (best near half cover), little low cloud, and a clear horizon toward the sun so its last light can get under them.",
      "At each place's own next sunset (and sunrise) this reads the HRRR's low, middle and high cloud there and along the line toward the sun 60 to 400 km out, the haze and smoke (aerosol optical thickness: a little smoke deepens the reds, heavy smoke dims them), the humidity, and whether rain fell in the two hours before, which leaves the air clean.",
      "The model is weakest at thin high clouds, which make the best sunsets, and \"good\" is a matter of taste. Rate tonight's sunset below: members' stars are compared with the score and tune how much each part counts.",
    ],
  },
  rainbow: {
    lead: "About 50–70% right with live radar; poor more than an hour ahead.",
    body: [
      "The physics is exact: a rainbow forms 42° around the point straight opposite the sun, so you need the sun behind you and lower than 42°, rain in front of you, and sunlight reaching that rain.",
      "For each place this checks NOAA's national radar 5 to 20 km opposite the sun, GOES satellite for open sky toward the sun, and the sun's height. For +30 and +60 minutes the rain and cloud are carried forward on the HRRR's 700 mb wind and the sun moves on. The list says which way to look and how high the top of the bow will stand.",
      "Showers are small and short-lived, and satellite can't always tell thin cloud from clear sky. Seen one? Tell us below; members' sightings are how this engine is checked.",
    ],
  },
  deer: {
    lead: "Points the right way; the effects are modest.",
    body: [
      "Deer move most at dawn and dusk, more after a cold snap, more as pressure rises behind a front, and less in strong wind or heavy rain. Studies that GPS-collared deer find these effects are real but modest; a sharp drop below recent temperatures is the best supported. The moon matters little, so it is left out.",
      "From Open-Meteo's hourly forecast with the past week to compare, each hour gets a score: light 35%, colder than the past week 25%, pressure change 15%, wind 15%, rain 10%. The rut lifts the whole day (Ohio's runs late October to early December, peaking about November 5–20); outside it the best hour tops out at 80.",
      "Tap the map (or use your place) for the next three days, legal shooting hours, today's season and where to sit with the wind. Season dates are kept in admin; always check the state's regulations. Log deer you see: reports tune the weights.",
    ],
  },
  fish: {
    lead: "A conditions guide built on anglers' wisdom; reports make it better.",
    body: [
      "The science is thin: solunar theory has little evidence and the pressure effect is mostly anglers' rule of thumb. This scores what anglers swear by, hour by hour: low light at dawn and dusk (20%), the moon's major periods (overhead and underfoot) and minor ones (rise and set) (20%), pressure (25%: slowly falling ahead of a front is best, a fast rise behind one is worst), a light chop (10%) and clouds (10%) for the species that like them, and water in the species' comfortable range (15%).",
      "Water temperature comes from the nearest USGS gauge that measures it, or is estimated from the past week's air. Pick a species; tap the map or use your place for three days, the best times and when the next front passes.",
      "Log your catches: they are compared with the score and tune the weights over time.",
    ],
  },
  tctor: {
    lead: "Good for the broad zone; band tornadoes are brief.",
    body: [
      "Landfalling tropical storms and hurricanes spawn quick tornadoes in their outer rain bands, mostly on the right side of the track and 50 to 400 miles from the center.",
      "This multiplies 0–1 km storm-relative helicity by 0–3 km CAPE from the HRRR a few hours ahead, only in that right-side zone around each active storm near the U.S. When no storm is close, the map stays empty.",
    ],
  },
};

/** Height (ft) of the lowest radar beam over a point, and which radar, or null if none reaches. */
function beamAt(lat: number, lon: number) {
  const Re = (4 / 3) * 6371;
  const sinT = Math.sin((0.5 * Math.PI) / 180);
  let best: { ft: number; id: string; mi: number } | null = null;
  for (const r of radars.radars) {
    const dlat = ((r.lat - lat) * Math.PI) / 180;
    const dlon = ((r.lon - lon) * Math.PI) / 180;
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((r.lat * Math.PI) / 180) *
        Math.sin(dlon / 2) ** 2;
    const km = 12742 * Math.asin(Math.sqrt(a));
    if (km > radars.maxKm) continue;
    const ft =
      (Math.sqrt(km * km + Re * Re + 2 * km * Re * sinT) - Re) * 3280.84;
    if (!best || ft < best.ft) best = { ft, id: r.id, mi: km * 0.621 };
  }
  return best;
}

/** Decodes the blind-spot grid and paints it in the (editable) band colors. */
async function blindImage(colors: Colors) {
  const buf = new Uint8Array(
    await (await fetch("/extras/blindspot.bin")).arrayBuffer(),
  );
  const { width, height } = radars;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  const rgb = BLIND_BANDS.map((b, i) => {
    const hex = pick(colors, `engine:blind:${i}`, b.color).replace("#", "");
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, "$&$&") : hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, i === 0 ? 90 : 150];
  });
  for (let i = 0, k = 0; i < buf.length; i += 2) {
    const col = rgb[buf[i]] ?? rgb[0];
    for (let n = 0; n < buf[i + 1]; n++, k++) img.data.set(col, k * 4);
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/** What a listed spot's time means, by engine and view. */
const whenLabel = (e: Engine, view: number) =>
  e === "first"
    ? "First storms around"
    : e === "sunset"
      ? view === 1
        ? "Sunrise"
        : "Sunset"
      : "Best around";
const when = (t: number) =>
  new Date(t).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export function EnginesTab({
  colors,
  items = {},
}: {
  colors: Colors;
  /** The owner's switches (admin → Extras): hidden engines are left out, off ones greyed. */
  items?: ExtrasStates;
}) {
  const shown = ENGINES.filter((e) => stateOf(items, e.id) !== "hidden");
  const usable = shown.filter((e) => stateOf(items, e.id) === "on");
  const [engine, setEngine] = useState<Engine>(usable[0]?.id ?? "tor");
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [surge, setSurge] = useState<SurgeData | "error" | null>(null);
  const [view, setView] = useState(0);
  const timing = engine === "first" && view === 1;
  const [rainbow, setRainbow] = useState<RainbowData | "error" | null>(null);
  const [analogs, setAnalogs] = useState<Record<number, AnalogData | "error">>(
    {},
  );
  const [pastDay, setPastDay] = useState<string | null>(null);
  const [pastReports, setPastReports] = useState<
    Record<string, { kind: string; lat: number; lon: number }[] | "error">
  >({});
  const [species, setSpecies] = useState<SpeciesId>("bass");
  const [placeMaps, setPlaceMaps] = useState<
    Record<string, PlaceMap | "error">
  >({});
  const [spot, setSpot] = useState<{
    lat: number;
    lon: number;
    label: string;
  } | null>(() => {
    try {
      const p = readPlaces();
      const a = p.list.find((x) => x.id === p.active) ?? p.list[0];
      return a ? { lat: a.lat, lon: a.lon, label: a.label } : null;
    } catch {
      return null;
    }
  });
  const [detail, setDetail] = useState<Record<string, PlaceData | "error">>({});
  const [wraps, setWraps] = useState<
    { at: string; storms: WrapStorm[] } | "error" | null
  >(null);
  const [beam, setBeam] = useState<ReturnType<typeof beamAt> | "none" | null>(
    null,
  );
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [fields, setFields] = useState<
    Partial<Record<FieldId, FieldData | "error">>
  >({});
  const engineRef = useRef(engine);
  useEffect(() => {
    engineRef.current = engine;
  });

  const torColor = (i: number) =>
    pick(colors, `engine:tor:${i}`, TOR_BINS[i].color);
  const blindColor = (i: number) =>
    pick(colors, `engine:blind:${i}`, BLIND_BANDS[i].color);
  const fieldColor = (id: FieldId | OutdoorId, i: number) =>
    pick(colors, `engine:${id}:${i}`, bandsOf(id).colors[i]);
  const bandColor = (id: FieldId | OutdoorId, v: number) =>
    fieldColor(
      id,
      Math.max(
        0,
        bandsOf(id).levels.findLastIndex((l) => v >= l),
      ),
    );
  const surgeColor = (i: number) =>
    pick(colors, `engine:surge:${i}`, SURGE_BANDS[i].color);
  const timeColor = (i: number) =>
    pick(colors, `engine:firstT:${i}`, FIRST_TIME_BANDS[i].color);
  const pyroColor = (i: number) =>
    pick(colors, `engine:pyrocb:${i}`, PYRO_BINS[i].color);

  // A model engine's map is read once per visit (the server keeps it 30 minutes).
  const want = isField(engine) && !fields[engine] ? engine : null;
  useEffect(() => {
    if (!want) return;
    let live = true;
    fetch(`/api/engines/field?e=${want}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: FieldData) => live && setFields((f) => ({ ...f, [want]: d })))
      .catch(() => live && setFields((f) => ({ ...f, [want]: "error" })));
    return () => {
      live = false;
    };
  }, [want]);

  // Lightning surges every two minutes while that engine is open and the page is visible.
  useEffect(() => {
    if (engine !== "surge") return;
    let live = true;
    const load = () =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/surge")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: SurgeData) => live && setSurge(d))
        .catch(() => live && setSurge((x) => x ?? "error"));
    load();
    const t = setInterval(load, 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine]);

  // The rotating storms' rain-wrap, every two minutes while that engine is open.
  useEffect(() => {
    if (engine !== "rwrap") return;
    let live = true;
    const load = () =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/rainwrap")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => live && setWraps(d))
        .catch(() => live && setWraps((x) => x ?? "error"));
    load();
    const t = setInterval(load, 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine]);

  // Severe Analogs: today's or tomorrow's matches once per visit, and a picked day's reports.
  const wantAnalog = engine === "analog" && !analogs[view] ? view : null;
  useEffect(() => {
    if (wantAnalog == null) return;
    let live = true;
    fetch(`/api/engines/analogs?d=${wantAnalog + 1}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: AnalogData) =>
          live && setAnalogs((m) => ({ ...m, [wantAnalog]: d })),
      )
      .catch(
        () => live && setAnalogs((m) => ({ ...m, [wantAnalog]: "error" })),
      );
    return () => {
      live = false;
    };
  }, [wantAnalog]);
  const wantPast = pastDay && !pastReports[pastDay] ? pastDay : null;
  useEffect(() => {
    if (!wantPast) return;
    let live = true;
    fetch(`/api/engines/analogs?a=${wantPast}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: { reports: { kind: string; lat: number; lon: number }[] }) =>
          live && setPastReports((m) => ({ ...m, [wantPast]: d.reports })),
      )
      .catch(
        () => live && setPastReports((m) => ({ ...m, [wantPast]: "error" })),
      );
    return () => {
      live = false;
    };
  }, [wantPast]);

  // Rainbow chances every five minutes while that engine is open.
  useEffect(() => {
    if (engine !== "rainbow") return;
    let live = true;
    const load = () =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/rainbow")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: RainbowData) => live && setRainbow(d))
        .catch(() => live && setRainbow((x) => x ?? "error"));
    load();
    const t = setInterval(load, 300_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine]);

  // Deer and fishing maps once per visit (per species), and the chosen place's three days.
  const mapKey =
    engine === "deer" ? "deer" : engine === "fish" ? `fish:${species}` : null;
  const needMap = mapKey && !placeMaps[mapKey] ? mapKey : null;
  useEffect(() => {
    if (!needMap) return;
    let live = true;
    const [e, sp] = needMap.split(":");
    fetch(`/api/engines/place?e=${e}${sp ? `&sp=${sp}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: PlaceMap) => live && setPlaceMaps((m) => ({ ...m, [needMap]: d })),
      )
      .catch(() => live && setPlaceMaps((m) => ({ ...m, [needMap]: "error" })));
    return () => {
      live = false;
    };
  }, [needMap]);
  const detailKey =
    mapKey && spot
      ? `${mapKey}@${spot.lat.toFixed(2)},${spot.lon.toFixed(2)}`
      : null;
  const needDetail = detailKey && !detail[detailKey] ? detailKey : null;
  useEffect(() => {
    if (!needDetail || !spot) return;
    let live = true;
    const [e, sp] = needDetail.split("@")[0].split(":");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(
      `/api/engines/place?e=${e}${sp ? `&sp=${sp}` : ""}&lat=${spot.lat.toFixed(3)}&lon=${spot.lon.toFixed(3)}&tz=${encodeURIComponent(tz)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: PlaceData) => live && setDetail((m) => ({ ...m, [needDetail]: d })),
      )
      .catch(() => live && setDetail((m) => ({ ...m, [needDetail]: "error" })));
    return () => {
      live = false;
    };
  }, [needDetail, spot]);

  // ProbSevere every two minutes while ProbTor is open and the page is visible.
  useEffect(() => {
    if (engine !== "tor") return;
    let live = true;
    const load = () =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/probsevere")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Data) => {
          if (!live) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    load();
    const t = setInterval(load, 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine]);

  const onReady = ({ map: any }: ReadyMap) => {
    const m = any as unknown as MaplibreMap;
    // SPC-style areas: nested, filled and outlined per band.
    const byBand = (color: (i: number) => string, n: number) =>
      [
        "match",
        ["get", "band"],
        ...Array.from({ length: n }, (_, i) => [i, color(i)]).flat(),
        color(0),
      ] as never;
    for (const [id, color, n] of [
      ["torA", torColor, TOR_BINS.length],
      ["fieldA", (i: number) => fieldColor("llj", i), 5],
    ] as const) {
      m.addSource(id, { type: "geojson", data: EMPTY });
      m.addLayer({
        id: `${id}-fill`,
        type: "fill",
        source: id,
        paint: { "fill-color": byBand(color, n), "fill-opacity": 0.45 },
      });
      m.addLayer({
        id: `${id}-line`,
        type: "line",
        source: id,
        paint: {
          "line-color": byBand(color, n),
          "line-width": 1.6,
          "line-opacity": 0.95,
        },
      });
    }
    m.addSource("surge", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "surge-fill",
      type: "fill",
      source: "surge",
      paint: {
        "fill-color": byBand(surgeColor, SURGE_BANDS.length),
        "fill-opacity": 0.4,
      },
    });
    m.addLayer({
      id: "surge-line",
      type: "line",
      source: "surge",
      paint: {
        "line-color": byBand(surgeColor, SURGE_BANDS.length),
        "line-width": 2,
      },
    });
    m.addSource("tor", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "tor-fill",
      minzoom: 6.5,
      type: "fill",
      source: "tor",
      paint: {
        "fill-color": [
          "step",
          ["get", "p"],
          torColor(0),
          10,
          torColor(1),
          30,
          torColor(2),
          60,
          torColor(3),
        ],
        "fill-opacity": ["match", ["get", "step"], 0, 0.5, 1, 0.3, 0.16],
      },
    });
    m.addLayer({
      id: "tor-line",
      minzoom: 6.5,
      type: "line",
      source: "tor",
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.35,
        "line-width": 0.8,
      },
    });
    // Interstates over the Blizzard areas, from whichever base map loaded.
    const roads = m.getSource("composite")
      ? { source: "composite", "source-layer": "road" }
      : m.getSource("openmaptiles")
        ? { source: "openmaptiles", "source-layer": "transportation" }
        : null;
    if (roads)
      m.addLayer({
        id: "roads-hi",
        type: "line",
        ...roads,
        filter: ["==", ["get", "class"], "motorway"],
        layout: { visibility: "none" },
        paint: {
          "line-color": pick(colors, "engine:roads", "#e2e8f0"),
          "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 9, 2.4],
          "line-opacity": 0.85,
        },
      });
    m.addSource("collide", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "collide",
      type: "circle",
      source: "collide",
      paint: {
        "circle-color": [
          "step",
          ["get", "score"],
          ...BOUND_POINTS.flatMap((b, i) =>
            i === 0
              ? [pick(colors, "engine:boundpt:0", b.color)]
              : [b.min, pick(colors, `engine:boundpt:${i}`, b.color)],
          ),
        ] as never,
        "circle-radius": 9,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1.5,
      },
    });
    m.addSource("pastday", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "pastday",
      type: "circle",
      source: "pastday",
      paint: {
        "circle-color": [
          "match",
          ["get", "kind"],
          "torn",
          pick(colors, "engine:analogdot:torn", ANALOG_DOTS.torn.color),
          "hail",
          pick(colors, "engine:analogdot:hail", ANALOG_DOTS.hail.color),
          pick(colors, "engine:analogdot:wind", ANALOG_DOTS.wind.color),
        ],
        "circle-radius": 3.5,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 0.8,
      },
    });
    m.addSource("fires", { type: "geojson", data: EMPTY });
    m.addLayer({
      id: "fires",
      type: "circle",
      source: "fires",
      paint: {
        "circle-color": [
          "step",
          ["get", "chance"],
          pyroColor(0),
          PYRO_BINS[1].min,
          pyroColor(1),
          PYRO_BINS[2].min,
          pyroColor(2),
          PYRO_BINS[3].min,
          pyroColor(3),
        ],
        "circle-radius": 6,
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1.2,
      },
    });
    m.addSource("radars", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: radars.radars.map((r) => ({
          type: "Feature",
          properties: { id: r.id },
          geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        })),
      },
    });
    m.addLayer({
      id: "radars",
      type: "circle",
      source: "radars",
      paint: {
        "circle-radius": 3,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#000000",
        "circle-stroke-width": 1,
      },
    });
    blindImage(colors).then((url) => {
      const [W, S, E, N] = radars.bounds;
      m.addSource("blind", {
        type: "image",
        url,
        coordinates: [
          [W, N],
          [E, N],
          [E, S],
          [W, S],
        ],
      });
      m.addLayer({ id: "blind", type: "raster", source: "blind" }, "radars");
      show(m, engineRef.current);
    });
    m.on("click", (e: MapMouseEvent) => {
      if (engineRef.current === "blind") {
        setBeam(beamAt(e.lngLat.lat, e.lngLat.lng) ?? "none");
        return;
      }
      if (engineRef.current === "deer" || engineRef.current === "fish")
        setSpot({
          lat: e.lngLat.lat,
          lon: e.lngLat.lng,
          label: "the spot you tapped",
        });
    });
    show(m, engineRef.current);
    setMap(m);
  };

  const show = (m: MaplibreMap, e: Engine) => {
    const vis = (id: string, on: boolean) =>
      m.getLayer(id) &&
      m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    vis("torA-fill", e === "tor");
    vis("torA-line", e === "tor");
    vis("fieldA-fill", isField(e) || isPlace(e) || e === "analog");
    vis("fieldA-line", isField(e) || isPlace(e) || e === "analog");
    vis("pastday", e === "analog");
    vis("collide", e === "bound");
    vis("tor-fill", e === "tor");
    vis("tor-line", e === "tor");
    vis("surge-fill", e === "surge");
    vis("surge-line", e === "surge");
    vis("blind", e === "blind");
    vis("radars", e === "blind");
    vis("fires", e === "pyro");
    vis("roads-hi", e === "blizz");
  };

  useEffect(() => {
    if (!map) return;
    const f = isField(engine) ? fields[engine] : undefined;
    const placeAreas =
      engine === "rainbow" && rainbow && rainbow !== "error"
        ? rainbow.maps[view]
        : mapKey && placeMaps[mapKey] && placeMaps[mapKey] !== "error"
          ? (placeMaps[mapKey] as PlaceMap).areas
          : null;
    const an = engine === "analog" ? analogs[view] : undefined;
    if (engine === "analog") {
      const a = an && an !== "error" && an.areas ? an.areas : EMPTY;
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(a);
      const expr = [
        "match",
        ["get", "band"],
        ...ANALOG_BANDS.map((b, i) => [
          i,
          pick(colors, `engine:analog:${i}`, b.color),
        ]).flat(),
        pick(colors, "engine:analog:0", ANALOG_BANDS[0].color),
      ] as never;
      map.setPaintProperty("fieldA-fill", "fill-color", expr);
      map.setPaintProperty("fieldA-line", "line-color", expr);
      const pr = pastDay ? pastReports[pastDay] : undefined;
      (map.getSource("pastday") as GeoJSONSource | undefined)?.setData(
        pr && pr !== "error"
          ? {
              type: "FeatureCollection",
              features: pr.map((r) => ({
                type: "Feature",
                properties: { kind: r.kind },
                geometry: { type: "Point", coordinates: [r.lon, r.lat] },
              })),
            }
          : EMPTY,
      );
    }
    if (isPlace(engine) && placeAreas) {
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(
        placeAreas,
      );
      const n = OUTDOOR_BANDS[engine].levels.length;
      const expr = [
        "match",
        ["get", "band"],
        ...Array.from({ length: n }, (_, i) => [
          i,
          fieldColor(engine, i),
        ]).flat(),
        fieldColor(engine, 0),
      ] as never;
      map.setPaintProperty("fieldA-fill", "fill-color", expr);
      map.setPaintProperty("fieldA-line", "line-color", expr);
    } else if (isPlace(engine))
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(EMPTY);
    if (f && f !== "error" && engine === "bound")
      (map.getSource("collide") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: (f.points ?? []).map((p) => ({
          type: "Feature",
          properties: { score: p.score },
          geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        })),
      });
    if (f && f !== "error" && isField(engine)) {
      const alt = view === 1 && f.alt;
      const timeBands = engine === "first" && alt;
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(
        alt ? f.alt! : f.areas,
      );
      const n = timeBands
        ? FIRST_TIME_BANDS.length
        : FIELD_BANDS[engine].levels.length;
      const color = (i: number) =>
        timeBands ? timeColor(i) : fieldColor(engine, i);
      const expr = [
        "match",
        ["get", "band"],
        ...Array.from({ length: n }, (_, i) => [i, color(i)]).flat(),
        color(0),
      ] as never;
      map.setPaintProperty("fieldA-fill", "fill-color", expr);
      map.setPaintProperty("fieldA-line", "line-color", expr);
      (map.getSource("fires") as GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: (f.fires ?? []).map((x) => ({
          type: "Feature",
          properties: { chance: x.chance },
          geometry: { type: "Point", coordinates: [x.lon, x.lat] },
        })),
      });
    }
    show(map, engine);
    if (surge && surge !== "error")
      (map.getSource("surge") as GeoJSONSource | undefined)?.setData(
        surge.polys,
      );
    if (data) {
      (map.getSource("tor") as GeoJSONSource | undefined)?.setData(data.tor);
      (map.getSource("torA") as GeoJSONSource | undefined)?.setData(
        data.torAreas,
      );
    }
    // The color helpers derive from colors, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    engine,
    data,
    surge,
    fields,
    view,
    rainbow,
    placeMaps,
    mapKey,
    analogs,
    pastDay,
    pastReports,
    colors,
  ]);

  const storms = data?.storms ?? [];
  const how = HOW[engine];
  const legend: [string, string][] =
    engine === "tor"
      ? TOR_BINS.map((b, i) => [b.label, torColor(i)])
      : engine === "surge"
        ? SURGE_BANDS.map((b, i) => [b.label, surgeColor(i)])
        : engine === "analog"
          ? [
              ...ANALOG_BANDS.map((b, i): [string, string] => [
                b.label,
                pick(colors, `engine:analog:${i}`, b.color),
              ]),
              ...(pastDay
                ? (
                    Object.keys(ANALOG_DOTS) as (keyof typeof ANALOG_DOTS)[]
                  ).map((k): [string, string] => [
                    ANALOG_DOTS[k].label,
                    pick(colors, `engine:analogdot:${k}`, ANALOG_DOTS[k].color),
                  ])
                : []),
            ]
          : engine === "first" && timing
            ? FIRST_TIME_BANDS.map((b, i) => [b.label, timeColor(i)])
            : engine === "blind"
              ? BLIND_BANDS.map((b, i) => [b.label, blindColor(i)])
              : bandsOf(engine).labels.map((l, i) => [
                  l,
                  fieldColor(engine, i),
                ]);
  const field = isField(engine) ? fields[engine] : undefined;
  const valid = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  const focus = (x: { lat: number; lon: number }) =>
    map?.flyTo({ center: [x.lon, x.lat], zoom: 8, duration: 1200 });

  if (!usable.length)
    return (
      <p className="text-sm text-muted">
        The Weather Engines are switched off for now. Check back soon.
      </p>
    );

  return (
    <div className="grid gap-3">
      <div className={s.sections} role="tablist" aria-label="Weather engines">
        {SECTIONS.map((sec) => {
          const list = sec.ids
            .map((id) => shown.find((e) => e.id === id))
            .filter((e): e is (typeof shown)[number] => Boolean(e));
          if (!list.length) return null;
          return (
            <div key={sec.name} className="grid gap-1.5">
              <p className="eyebrow">{sec.name}</p>
              <div className={s.picker}>
                {list.map((e) => {
                  const off = stateOf(items, e.id) === "off";
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="tab"
                      aria-selected={engine === e.id}
                      disabled={off}
                      onClick={() => {
                        setEngine(e.id);
                        setView(0);
                        setBeam(null);
                      }}
                    >
                      {e.icon}
                      <b>{e.name}</b>
                      <small>{off ? "Off for now" : e.sub}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className={s.mapBox}>
        <WeatherMap
          center={[-96, 38.5]}
          zoom={3.2}
          label="Weather engines map"
          className={s.map}
          onReady={onReady}
        />
        <span className={s.badge}>
          <FlaskConical aria-hidden /> Experimental
        </span>
      </div>
      <div className={s.legend}>
        {legend.map(([label, color]) => (
          <span key={label}>
            <i style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
      {VIEWS[engine] && (
        <div className={s.windows} role="group" aria-label="Map shows">
          {VIEWS[engine]!.map((label, v) => (
            <button
              key={label}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {engine === "fish" && (
        <SpeciesPicker value={species} onChange={setSpecies} />
      )}
      {engine === "tor" && (
        <p className={s.small}>
          Areas: the chance within about 25 miles over the next hour. Zoomed in,
          each storm&apos;s cones show its next 20, 40 and 60 minutes.
        </p>
      )}

      {engine === "tor" && (
        <section className={s.card}>
          <header>
            <h3>Storms with tornado potential</h3>
            {data && <small>ProbSevere scan {time(data.at)}</small>}
          </header>
          {failed && !data && (
            <p className={s.small}>
              ProbSevere isn&apos;t answering right now. Trying again in two
              minutes.
            </p>
          )}
          {!data && !failed && (
            <p className={s.small}>Reading the latest scan…</p>
          )}
          {data && storms.length === 0 && (
            <p className={s.small}>
              No storm is showing tornado potential right now. ProbSevere is
              tracking {data.total} storm{data.total === 1 ? "" : "s"} across
              the country.
            </p>
          )}
          <ul className={s.storms}>
            {storms.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => focus(x)}>
                  <span className={s.where}>
                    <b>{x.place}</b>
                    <small>
                      <ArrowRight aria-hidden /> {x.toward} at {x.mph} mph
                    </small>
                  </span>
                  <span className={s.odds}>
                    {(
                      [
                        ["Now", x.tor],
                        ["20 min", x.p20],
                        ["40", x.p40],
                        ["60", x.p60],
                      ] as const
                    ).map(([k, v]) => (
                      <span key={k}>
                        <i
                          style={{
                            background: torColor(torBin(v)),
                            transform: `scaleY(${Math.max(0.06, v / 100)})`,
                          }}
                        />
                        <b>{v}%</b>
                        <small>{k}</small>
                      </span>
                    ))}
                  </span>
                </button>
                <p className={s.flags}>
                  {x.trend === "rising" && (
                    <span data-k="up">
                      <ArrowUpRight aria-hidden /> Rotation tightening
                    </span>
                  )}
                  {x.trend === "falling" && (
                    <span>
                      <ArrowDownRight aria-hidden /> Rotation weakening
                    </span>
                  )}
                  {x.jump && (
                    <span data-k="up">
                      <Zap aria-hidden /> Lightning jump
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {engine === "surge" && (
        <section className={s.card}>
          <header>
            <h3>Storms with surging lightning</h3>
            {surge && surge !== "error" && (
              <small>ProbSevere scan {time(surge.at)}</small>
            )}
          </header>
          {surge === null && (
            <p className={s.small}>Reading the last 20 minutes of scans…</p>
          )}
          {surge === "error" && (
            <p className={s.small}>
              ProbSevere isn&apos;t answering right now. Trying again in two
              minutes.
            </p>
          )}
          {surge && surge !== "error" && surge.storms.length === 0 && (
            <p className={s.small}>
              No storm&apos;s lightning is rising or jumping right now.
              ProbSevere is tracking {surge.total} storm
              {surge.total === 1 ? "" : "s"}.
            </p>
          )}
          {surge && surge !== "error" && (
            <ul className={s.storms}>
              {surge.storms.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => focus(x)}>
                    <span className={s.where}>
                      <b>{x.place}</b>
                      <small>
                        <ArrowRight aria-hidden /> {x.toward} at {x.mph} mph
                        {x.severe ? ` · ${x.severe}% severe` : ""}
                      </small>
                    </span>
                    <span className={s.hail}>
                      <svg viewBox="0 0 60 20" className={s.spark} aria-hidden>
                        <polyline
                          points={x.rates
                            .map(
                              (v, i) =>
                                `${(i / Math.max(1, x.rates.length - 1)) * 60},${19 - (v / Math.max(10, ...x.rates)) * 17}`,
                            )
                            .join(" ")}
                          fill="none"
                          stroke={surgeColor(x.band)}
                          strokeWidth={1.8}
                          strokeLinejoin="round"
                        />
                      </svg>
                      <b>{x.rate}</b>
                      <small>flashes/min</small>
                    </span>
                  </button>
                  <p className={s.flags}>
                    {x.since != null && x.since <= 10 && (
                      <span data-k="up">
                        <Zap aria-hidden />{" "}
                        {x.band === 2 ? "Strong jump" : "Jump"}{" "}
                        {x.since === 0 ? "just now" : `${x.since} min ago`} (
                        {x.peak}σ)
                      </span>
                    )}
                    {x.band === 0 && (
                      <span>
                        <ArrowUpRight aria-hidden /> Rising ({x.sigma}σ)
                      </span>
                    )}
                    {x.rotation && (
                      <span data-k="up">
                        <ArrowUpRight aria-hidden /> Rotation tightening
                      </span>
                    )}
                    {x.hail && (
                      <span data-k="up">
                        <ArrowUpRight aria-hidden /> Hail core growing
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {surge && surge !== "error" && surge.stats && (
            <p className={s.small}>
              {surge.stats.checked >= 10
                ? `Hit rate, last ${surge.stats.days} days: ${Math.round((100 * surge.stats.hits) / surge.stats.checked)}% of ${surge.stats.checked} jumps were followed by a severe storm report within 45 minutes and 15 miles.`
                : `The hit rate shows once 10 jumps have been checked against storm reports (${surge.stats.checked} so far).`}
            </p>
          )}
        </section>
      )}

      {isField(engine) && (
        <section className={s.card}>
          <header>
            <h3>
              {engine === "pyro"
                ? "Large fires, blowup and PyroCb"
                : engine === "bound"
                  ? "Where boundaries meet"
                  : engine === "tctor" &&
                      field &&
                      field !== "error" &&
                      field.storms?.length
                    ? "Highest risk near the storm"
                    : "Strongest spots"}
            </h3>
            {field && field !== "error" && (
              <small>
                HRRR {field.cycle.slice(8)}Z run, valid {valid(field.valid)}
              </small>
            )}
          </header>
          {!field && <p className={s.small}>Running the engine…</p>}
          {field === "error" && (
            <p className={s.small}>
              The model data isn&apos;t answering right now. Try again in a few
              minutes.
            </p>
          )}
          {field && field !== "error" && field.note && (
            <p className={s.small}>{field.note}</p>
          )}
          {field && field !== "error" && engine === "bound" && (
            <>
              {!field.points?.length && (
                <p className={s.small}>
                  No two boundaries meet in the next three hours with enough
                  length to follow.
                </p>
              )}
              <ul className={s.storms}>
                {(field.points ?? []).map((p) => (
                  <li key={`${p.lat},${p.lon}`}>
                    <button type="button" onClick={() => focus(p)}>
                      <span className={s.where}>
                        <b>{p.place}</b>
                        <small>
                          {p.kinds}, around {when(p.at)} (±{p.spread} min)
                        </small>
                      </span>
                      <span className={s.hail}>
                        <i
                          style={{
                            background: pick(
                              colors,
                              `engine:boundpt:${Math.max(
                                0,
                                BOUND_POINTS.findLastIndex(
                                  (b) => p.score >= b.min,
                                ),
                              )}`,
                              BOUND_POINTS[
                                Math.max(
                                  0,
                                  BOUND_POINTS.findLastIndex(
                                    (b) => p.score >= b.min,
                                  ),
                                )
                              ].color,
                            ),
                          }}
                        />
                        <b>{p.score}</b>
                        <small>score</small>
                      </span>
                    </button>
                    <ul className={s.facts}>
                      {p.evidence.map((e) => (
                        <li key={e} className={s.fine}>
                          {e}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
          {field &&
            field !== "error" &&
            engine !== "pyro" &&
            engine !== "bound" &&
            !field.note &&
            field.spots.length === 0 && (
              <p className={s.small}>
                Nothing reaches the first band anywhere in the lower 48 right
                now.
              </p>
            )}
          {field && field !== "error" && engine !== "pyro" && (
            <ul className={s.storms}>
              {(view === 1 && field.altSpots
                ? field.altSpots
                : field.spots
              ).map((x) => (
                <li key={`${x.lat},${x.lon}`}>
                  <button
                    type="button"
                    onClick={() =>
                      map?.flyTo({
                        center: [x.lon, x.lat],
                        zoom: 6.5,
                        duration: 1200,
                      })
                    }
                  >
                    <span className={s.where}>
                      <b>{x.place}</b>
                      {engine === "nst" && (
                        <small>{x.water ? "Waterspout" : "Landspout"}</small>
                      )}
                      {x.at && (
                        <small>
                          {whenLabel(engine, view)} {when(x.at)}
                        </small>
                      )}
                      {x.note && <small>{x.note}</small>}
                    </span>
                    <span className={s.hail}>
                      <i style={{ background: bandColor(engine, x.value) }} />
                      <b>{x.value}</b>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {field && field !== "error" && engine === "pyro" && (
            <>
              {!field.fires?.length && (
                <p className={s.small}>
                  No large uncontained fire is burning right now.
                </p>
              )}
              <ul className={s.storms}>
                {(field.fires ?? []).map((f) => (
                  <li key={`${f.name}${f.lat}`}>
                    <button
                      type="button"
                      onClick={() =>
                        map?.flyTo({
                          center: [f.lon, f.lat],
                          zoom: 8,
                          duration: 1200,
                        })
                      }
                    >
                      <span className={s.where}>
                        <b>
                          {f.name}, {f.state}
                        </b>
                        <small>
                          {f.acres.toLocaleString("en-US")} acres
                          {f.contained !== null
                            ? ` · ${f.contained}% contained`
                            : ""}{" "}
                          · blowup {f.blowup.toLowerCase()} (HDWI {f.hdwi})
                        </small>
                      </span>
                      <span className={s.hail}>
                        <i
                          style={{ background: pyroColor(pyroBin(f.chance)) }}
                        />
                        <b>{f.chance}%</b>
                        <small>PyroCb</small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {isField(engine) && field && field !== "error" && field.stats && (
        <p className={s.small}>
          {field.stats.checked >= 10
            ? `Hit rate, last ${field.stats.days} days: ${Math.round((100 * field.stats.hits) / field.stats.checked)}% of ${field.stats.checked} flagged places saw it happen.`
            : `The hit rate shows once 10 flagged places have been checked against what happened (${field.stats.checked} so far).`}
        </p>
      )}

      {engine === "analog" && (
        <section className={s.card}>
          <header>
            <h3>{view ? "Tomorrow" : "Today"}, by days like it</h3>
            {(() => {
              const a = analogs[view];
              return a && a !== "error" && a.ready ? (
                <small>GFS {a.cycle!.slice(8)}Z run</small>
              ) : null;
            })()}
          </header>
          {(() => {
            const a = analogs[view];
            if (!a) return <p className={s.small}>Finding the closest days…</p>;
            if (a === "error")
              return (
                <p className={s.small}>
                  The analogs aren&apos;t answering right now. Try again in a
                  few minutes.
                </p>
              );
            if (!a.ready)
              return (
                <p className={s.small}>
                  This day&apos;s match is made after the next GFS run (four
                  times a day). Check back shortly.
                </p>
              );
            const pct = (x: number) => `${Math.round(x * 100)}%`;
            return (
              <>
                <p className={s.small}>
                  Chance of this many severe reports across the country:
                </p>
                <div className={s.odds}>
                  {(
                    [
                      ["10+", a.p10!],
                      ["25+", a.p25!],
                      ["50+", a.p50!],
                    ] as const
                  ).map(([k, v]) => (
                    <span key={k}>
                      <i
                        style={{
                          background: pick(
                            colors,
                            `engine:analog:${Math.max(
                              0,
                              ANALOG_BANDS.findLastIndex(
                                (b) => v * 100 >= b.min,
                              ),
                            )}`,
                            ANALOG_BANDS[
                              Math.max(
                                0,
                                ANALOG_BANDS.findLastIndex(
                                  (b) => v * 100 >= b.min,
                                ),
                              )
                            ].color,
                          ),
                          transform: `scaleY(${Math.max(0.06, v)})`,
                        }}
                      />
                      <b>{pct(v)}</b>
                      <small>{k}</small>
                    </span>
                  ))}
                </div>
                <p className={s.small}>
                  The 15 closest days averaged {a.torn} tornado
                  {a.torn === 1 ? "" : "es"}.{" "}
                  {a.used! < 15
                    ? `Report maps were found for ${a.used} of them.`
                    : ""}
                </p>
                <ul className={s.storms}>
                  {a.analogs!.map((x, i) => (
                    <li key={x.day}>
                      <button
                        type="button"
                        aria-pressed={pastDay === x.day}
                        onClick={() =>
                          setPastDay((d) => (d === x.day ? null : x.day))
                        }
                      >
                        <span className={s.where}>
                          <b>
                            {new Date(`${x.day}T12:00:00Z`).toLocaleDateString(
                              "en-US",
                              {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                timeZone: "UTC",
                              },
                            )}
                          </b>
                          <small>
                            Match #{i + 1} · {x.torn} tornado
                            {x.torn === 1 ? "" : "es"}
                            {pastDay === x.day
                              ? pastReports[x.day] === "error"
                                ? " · no report file"
                                : pastReports[x.day]
                                  ? " · on the map"
                                  : " · loading…"
                              : ""}
                          </small>
                        </span>
                        <span className={s.hail}>
                          <b>{x.n}</b>
                          <small>reports</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {a.score && a.score.scored >= 10 ? (
                  <p className={s.small}>
                    Last {a.score.days} days ({a.score.scored} scored): when we
                    gave 50%+ for 10+ reports it happened {a.score.high.hit} of{" "}
                    {a.score.high.n} times; under 20%, {a.score.low.hit} of{" "}
                    {a.score.low.n}. Brier score {a.score.brier} (lower is
                    better).
                  </p>
                ) : (
                  <p className={s.small}>
                    The score shows once 10 days have been checked against their
                    reports ({a.score?.scored ?? 0} so far).
                  </p>
                )}
              </>
            );
          })()}
        </section>
      )}

      {engine === "sunset" && (
        <>
          <ReportBox kind="sunset" />
          {field && field !== "error" && (
            <ReportSummary kind="sunset" sum={field.reports ?? null} />
          )}
        </>
      )}

      {engine === "rainbow" && (
        <section className={s.card}>
          <header>
            <h3>
              Best places to look {["now", "in 30 minutes", "in an hour"][view]}
            </h3>
            {rainbow && rainbow !== "error" && (
              <small>Radar and satellite {time(rainbow.at)}</small>
            )}
          </header>
          {rainbow === null && (
            <p className={s.small}>Reading radar and satellite…</p>
          )}
          {rainbow === "error" && (
            <p className={s.small}>
              Radar or satellite isn&apos;t answering right now. Trying again in
              five minutes.
            </p>
          )}
          {rainbow && rainbow !== "error" && !rainbow.lowSun[view] && (
            <p className={s.small}>
              The sun is down, or too high everywhere, for a rainbow. They come
              in the early morning and late afternoon.
            </p>
          )}
          {rainbow &&
            rainbow !== "error" &&
            rainbow.lowSun[view] &&
            rainbow.spots[view].length === 0 && (
              <p className={s.small}>
                No place has rain opposite a low, open sun right now.
              </p>
            )}
          {rainbow && rainbow !== "error" && (
            <ul className={s.storms}>
              {rainbow.spots[view].map((x) => (
                <li key={`${x.lat},${x.lon}`}>
                  <button type="button" onClick={() => focus(x)}>
                    <span className={s.where}>
                      <b>{x.place}</b>
                      <small>
                        Look {x.look}; the top of the bow about {x.top}° up
                      </small>
                    </span>
                    <span className={s.hail}>
                      <i
                        style={{ background: bandColor("rainbow", x.value) }}
                      />
                      <b>{x.value}%</b>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ReportBox kind="rainbow" />
          {rainbow && rainbow !== "error" && (
            <ReportSummary kind="rainbow" sum={rainbow.reports} />
          )}
        </section>
      )}

      {(engine === "deer" || engine === "fish") && (
        <>
          <section className={s.card}>
            <header>
              <h3>
                {engine === "deer" ? "Where deer move most" : "Best bite"} in
                the next day
              </h3>
            </header>
            {mapKey && !placeMaps[mapKey] && (
              <p className={s.small}>Reading the forecast…</p>
            )}
            {mapKey && placeMaps[mapKey] === "error" && (
              <p className={s.small}>
                The forecast isn&apos;t answering right now. Try again in a few
                minutes.
              </p>
            )}
            {mapKey && placeMaps[mapKey] && placeMaps[mapKey] !== "error" && (
              <ul className={s.storms}>
                {(placeMaps[mapKey] as PlaceMap).spots.map((x) => (
                  <li key={`${x.lat},${x.lon}`}>
                    <button
                      type="button"
                      onClick={() => {
                        focus(x);
                        setSpot({ lat: x.lat, lon: x.lon, label: x.place });
                      }}
                    >
                      <span className={s.where}>
                        <b>{x.place}</b>
                        {x.at && (
                          <small>
                            {whenLabel(engine, view)} {when(x.at)}
                          </small>
                        )}
                        {x.note && <small>{x.note}</small>}
                      </span>
                      <span className={s.hail}>
                        <i style={{ background: bandColor(engine, x.value) }} />
                        <b>{x.value}</b>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className={s.card}>
            <header>
              <h3>Your next three days</h3>
              {spot && <small>Near {spot.label}</small>}
            </header>
            {!spot && (
              <p className={s.small}>
                Tap the map, pick a place above, or save a place in the location
                menu.
              </p>
            )}
            {spot && detailKey && (
              <PlacePanel
                kind={engine}
                label={spot.label}
                data={detail[detailKey] ?? null}
                color={(v) => bandColor(engine, v)}
              />
            )}
          </section>
          <ReportBox
            kind={engine}
            species={engine === "fish" ? species : undefined}
          />
          {mapKey && placeMaps[mapKey] && placeMaps[mapKey] !== "error" && (
            <ReportSummary
              kind={engine}
              sum={(placeMaps[mapKey] as PlaceMap).reports}
            />
          )}
        </>
      )}

      {engine === "rwrap" && (
        <section className={s.card}>
          <header>
            <h3>Rotating storms now</h3>
            {wraps && wraps !== "error" && (
              <small>ProbSevere scan {time(wraps.at)}</small>
            )}
          </header>
          {wraps === null && (
            <p className={s.small}>Reading the latest scan…</p>
          )}
          {wraps === "error" && (
            <p className={s.small}>
              ProbSevere isn&apos;t answering right now. Trying again in two
              minutes.
            </p>
          )}
          {wraps && wraps !== "error" && wraps.storms.length === 0 && (
            <p className={s.small}>
              No storm is rotating right now, so there is nothing to score.
            </p>
          )}
          {wraps && wraps !== "error" && (
            <ul className={s.storms}>
              {wraps.storms.map((x) => {
                const band = Math.max(
                  0,
                  FIELD_BANDS.rwrap.levels.findLastIndex((l) => x.wrap >= l),
                );
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => focus(x)}>
                      <span className={s.where}>
                        <b>{x.place}</b>
                        <small>
                          {x.tor}% tornado · mid-level wind {x.srw} kt ·{" "}
                          {x.pwat}&quot; of water · base{" "}
                          {x.lcl.toLocaleString("en-US")} ft
                        </small>
                      </span>
                      <span className={s.hail}>
                        <i style={{ background: fieldColor("rwrap", band) }} />
                        <b>{x.wrap}</b>
                        <small>{FIELD_BANDS.rwrap.labels[band]}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {engine === "blind" && (
        <section className={s.card}>
          <header>
            <h3>Beam height where you tap</h3>
          </header>
          {beam === null && <p className={s.small}>Tap anywhere on the map.</p>}
          {beam === "none" && (
            <p className={s.small}>
              No NWS radar reaches this spot at the lowest tilt.
            </p>
          )}
          {beam && beam !== "none" && (
            <p className={s.readout}>
              <b>
                {Math.round(beam.ft / 100) * 100 >= 1000
                  ? `${(Math.round(beam.ft / 100) * 100).toLocaleString("en-US")} ft`
                  : `${Math.round(beam.ft)} ft`}
              </b>
              <span>
                above the {beam.id} radar, {Math.round(beam.mi)} miles away
              </span>
            </p>
          )}
        </section>
      )}

      <details className={s.how}>
        <summary>How this works</summary>
        <p>
          <b>{how.lead}</b>
        </p>
        {how.body.map((p) => (
          <p key={p.slice(0, 20)}>{p}</p>
        ))}
      </details>
    </div>
  );
}
