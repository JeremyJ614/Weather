"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { RefreshKey } from "@/components/ui/RefreshKey";
import { pick, type Colors } from "@/lib/colors/pick";
import { stateOf, type ExtrasStates } from "@/lib/extras/items";
import {
  BLIND_BANDS,
  BOUND_POINTS,
  FIELD_BANDS,
  FIRST_TIME_BANDS,
  PROB_BANDS,
  OUTDOOR_BANDS,
  OUTMAP_BANDS,
  PYRO_BINS,
  SURGE_BANDS,
  TOR_BINS,
  pyroBin,
  torBin,
  type FieldId,
  type OutdoorId,
} from "@/lib/engines/colors";
import type { SpeciesId } from "@/lib/engines/outdoor";
import { unpackAreas } from "@/lib/engines/pack";
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
import { HIT_MEANS, HitCard, type HitStats } from "./HitCard";
import { RadarFlags, useRadarReads } from "./RadarCheck";
import { withRadar, type TorOutlook } from "@/lib/engines/project";

type Engine = "tor" | "surge" | "blind" | FieldId | OutdoorId;
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
  stp: ["Evening peak", "Chance of 1+"],
  scp: ["Evening peak", "Chance of 1+"],
  sunset: ["Sunset", "Sunrise"],
  rainbow: ["Now", "+30 min", "+60 min"],
  bound: ["Now", "In 3 hours"],
  deer: ["Day 1", "Day 2", "Day 3"],
  fish: ["Day 1", "Day 2", "Day 3"],
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
/** Deer and Fishing: the lower 48's outlook for Days 1–3 (SPC-style areas, best spots). */
type PlaceMap = {
  cycle: string;
  at: string;
  levels: number[];
  days: { date: string; areas: Areas; spots: Spot[]; typical: number }[];
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
  /** Deer and Fishing: whether the spot's best window is its dawn or its dusk. */
  window?: "dawn" | "dusk";
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
  stats?: HitStats;
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
  stats?: HitStats;
};
type SurgeData = {
  at: string;
  total: number;
  minutes: number;
  storms: SurgeStorm[];
  polys: GeoJSON.FeatureCollection;
  stats: HitStats;
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
    sub: "Lower 48, Days 1–3",
    icon: <Trees aria-hidden />,
  },
  {
    id: "fish",
    name: "Fishing Bite",
    sub: "Lower 48, Days 1–3",
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
      "Storms in a line (a squall line, where ProbSevere misses many tornadoes) are tested with the Three Ingredients Method forecasters use: 0–3 km shear of 30 knots or more from the HRRR, 30 knots of it running across the line, and a segment surging ahead of the rest. Two or three ingredients raise the chance by half or double it.",
      "For the leading storms (or any storm you tap), your phone reads the nearest Weather Service radar's newest lowest scan straight from NOAA's public archive and measures the rotation itself: the strongest inbound-outbound couplet near the storm, as rotational velocity. The chance moves toward what NWS studies found for that much rotation (about 10% at 20 knots, half at 45, up to 85% past 65). A drop in correlation coefficient right on the rotation is a debris signature and means a tornado is likely on the ground. Rotation more than 10,000 feet up or 90 miles out is too high to read.",
      "Each storm is projected along its own motion for 0–20, 20–40 and 40–60 minutes, and the map draws the chances the way SPC draws an outlook: nested, outlined areas around each path that fade with distance, merging where storms run together. Zoom in to see each storm's own 20-minute cones. The later chances only fade: past half an hour nobody can say much more.",
      "This is an experimental guide, never a warning. Act on National Weather Service warnings.",
    ],
  },
  surge: {
    lead: "A 10 to 20 minute heads-up, with false alarms.",
    body: [
      "A storm's lightning often jumps just before it turns severe, as a strengthening updraft lofts more ice and charges the cloud faster. This engine follows each storm NOAA and the University of Wisconsin's ProbSevere is tracking, reading its total flash rate from every new file (one every 2 minutes) for the last 20 minutes.",
      'It uses the "2σ" lightning jump from research by Schultz and others: the change in flash rate over each 2 minutes is compared with how much it varied over the 10 minutes before. A rise more than two standard deviations above that, in a storm flashing at least 10 times a minute, is a jump, and the storm stays flagged for 10 minutes. A jump of three or more, or one the radar backs up with tightening low-level rotation or a hail core growing by a quarter inch, is a strong jump. The bars show the jump\'s size, 2σ, 3σ or 4σ and up: the bigger the jump, the more often severe weather follows.',
      "Storms are followed from file to file by where they are, not only by their ID: an older storm belongs to a current one when its center, carried forward on the storm's motion, lands inside its outline. When two storms merge their flash rates are added together, and when one splits its rate is shared by size, so neither looks like a jump.",
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
      "Each spot is rated on Bonner's scale (a jet peaking at 25, 32 or 40 knots with the wind dropping off above it) from the 925, 850 and 700 mb winds, and weighted by how much moisture the jet is carrying north (mixing ratio times the 850 mb wind). The detail line says when the jet peaks between 10 p.m. and 4 a.m. Central, how strong, and whether it is a wet or dry jet.",
      "Mountains are left blank where those pressure levels are underground, and the open ocean is skipped.",
    ],
  },
  nst: {
    lead: "Fair: these tornadoes are hard to forecast.",
    body: [
      "Landspouts and waterspouts don't come from rotating supercells. They form when a growing storm stretches spin that already sits along a wind boundary at the ground.",
      "This is the Storm Prediction Center's Non-Supercell Tornado parameter from the HRRR for the next hour: steep low-level lapse rates, CAPE in the lowest 3 km, little inhibition, weak deep-layer shear and spin in the 10 m wind. 1 and up is favorable.",
      "On land it is weighted up where the HRRR has a boundary: surface winds running into each other or a sharp dew point edge, since that is where the spin waiting to be stretched lives.",
      "Over water it follows Szilagyi's waterspout index instead: how much warmer the water is than the air at 850 mb, how deep the clouds can grow and how light the wind is. It is counted only within about 40 miles of land. A storm still has to form on the boundary for anything to happen.",
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
      "The Significant Tornado Parameter is the Storm Prediction Center's go-to ingredient blend for tornadoes rated EF2 and up. This is the effective-layer version SPC prefers, from the HRRR: mixed-layer CAPE, how low the cloud base (LCL) is, effective storm-relative helicity (the HRRR's own), deep-layer shear (0–6 km standing in for the effective layer, which the HRRR doesn't carry) and how much the cap is holding storms back.",
      "Evening peak shows the highest value between 21Z and 03Z (about 4 to 10 p.m. Central) with the hour it peaks. Chance of 1+ is the share of the last three HRRR runs with STP of 1 or more at 00Z, so you can see how sure the model is.",
      "1 and up marks the environments most significant tornadoes form in; values over 4 are rare and come with the big days. A high number with no storms means nothing happens, so pair it with SPC's outlook.",
    ],
  },
  scp: {
    lead: "Good for where supercells could thrive.",
    body: [
      "The Supercell Composite Parameter weighs whether a storm would rotate as a supercell: most-unstable CAPE, effective storm-relative helicity and deep-layer shear (Thompson's effective-layer version), cut down where the cap is strong. Evening peak is the highest value from 21Z to 03Z; Chance of 1+ is the share of the last three HRRR runs at 1 or more at 00Z.",
      "Each top spot carries a storm-mode hint: deep shear crossing the edge of the instability (where storms start) favors discrete supercells; shear running along it tends to line storms up.",
      "1 and up favors supercells, which bring most large hail and strong tornadoes; above 8 is a classic supercell day. Left-moving storms are left off.",
    ],
  },
  dcp: {
    lead: "Fair: derechos need storms to organize first.",
    body: [
      "The Derecho Composite Parameter (Evans and Doswell) looks for long-lived, damaging wind storms: downdraft CAPE (how hard cold air can crash down out of a storm), most-unstable CAPE, 0–6 km shear and a fast 0–6 km mean wind to carry the line along. From the HRRR at this evening's peak (or as far ahead as the latest run reaches).",
      "The HRRR doesn't carry downdraft CAPE, so it is worked out here: a parcel let down from the drier of 700 and 500 mb at its wet-bulb temperature to the ground. 2 and up favors derecho-producing systems once a line of storms gets going.",
      "DCP was built for places a storm complex already exists, so the map counts it in full only within about 125 miles of an organized line in the HRRR (40 dBZ, 60+ miles long, in the three hours before) and at a third elsewhere. The HRRR's own hourly peak gusts weigh it too (half at 30 mph or less, full at 58 mph and up). Each top spot says where a complex would race, from the Corfidi vectors (cloud-layer mean wind and the low-level jet).",
    ],
  },
  ltg: {
    lead: "Good for the next few hours.",
    body: [
      "The HRRR forecasts lightning itself: flashes per square kilometer every five minutes, from the ice and graupel moving up and down inside its storms. This is the most each spot gets over the next three hours.",
      "The latest real strikes (the last two frames of NOAA's nowCOAST lightning density) are blended in, nudged 40 minutes along the steering wind so they sit where the storms are heading. Each region's model numbers are also scaled by how they have compared with real strikes lately, so a run that keeps over- or under-doing lightning gets corrected.",
      "Isolated means the odd strike; frequent and up means lightning every few seconds nearby. Any thunder you hear means you are close enough to be struck, so head indoors.",
    ],
  },
  first: {
    lead: "Placement within about 50 miles half the time; timing within 1–2 hours.",
    body: [
      "Where the first storms of the day break through the cap is one of the hardest things to forecast, and one of the most useful for chasing. This engine asks the last four HRRR runs together (a time-lagged ensemble): in each, a new storm is an echo of 35 dBZ or more with none within 25 miles the hour before. The RRFS ensemble's 14 members join them, through its chance of a 40 dBZ echo appearing where it had none within 25 miles the hour before. The chance is the share of all those members that start a storm within 25 miles of a spot in the next 6 hours.",
      "For the first hour, GOES satellite watches for towers growing now: cloud tops 6 K or more colder than any top nearby 15 minutes earlier, still between about −45 and 0 °C, away from storms radar already has. Where they are, the first hour is near-certain.",
      "The chances are then smoothed over about 40 km, the way SPC's own guidance is, and calibrated against how this engine's flagged chances have verified over the last 60 days.",
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
      "Each window gets a score: light 35%, colder than the two days before 25%, pressure change 15%, wind 15%, rain 10%. The rut lifts the whole day (the dates set in admin, Ohio's by default: late October to early December, peaking about November 5–20); outside it the best hour tops out at 80.",
      "The map is an outlook for the lower 48, Days 1 to 3, drawn like SPC's: every half degree is scored at its own dawn and dusk from the GFS model's 3-hourly forecast (recomputed with each new run), and the better window counts. Categories run Fair, Good, Very good, Excellent and Peak.",
      "Tap the map (or use your place) for that spot's next three days hour by hour from Open-Meteo, legal shooting hours, today's season and where to sit with the wind. Season dates are kept in admin; always check the state's regulations. Log deer you see: reports tune the weights.",
    ],
  },
  fish: {
    lead: "A conditions guide built on anglers' wisdom; reports make it better.",
    body: [
      "The science is thin: solunar theory has little evidence and the pressure effect is mostly anglers' rule of thumb. This scores what anglers swear by, hour by hour: low light at dawn and dusk (20%), the moon's major periods (overhead and underfoot) and minor ones (rise and set) (20%), pressure (25%: slowly falling ahead of a front is best, a fast rise behind one is worst), a light chop (10%) and clouds (10%) for the species that like them, and water in the species' comfortable range (15%).",
      "The map is an outlook for the lower 48, Days 1 to 3, drawn like SPC's: every half degree is scored at its own dawn and dusk from the GFS model's 3-hourly forecast (recomputed with each new run), with water estimated from five days of air temperature. Categories run Fair, Good, Very good, Excellent and Peak.",
      "Pick a species; tap the map or use your place for three days hour by hour, with water from the nearest USGS gauge that measures it (or estimated from the past week's air), the best times and when the next front passes.",
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
/** One field engine's map, unpacked. */
async function fetchField(id: FieldId, v?: string): Promise<FieldData> {
  const r = await fetch(`/api/engines/field?e=${id}${v ? `&v=${v}` : ""}`);
  if (!r.ok) throw new Error(String(r.status));
  const d: FieldData = await r.json();
  return { ...d, areas: unpackAreas(d.areas), alt: unpackAreas(d.alt) };
}

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

/** "Mon" for a YYYY-MM-DD date. */
const weekday = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

export function EnginesTab({
  colors,
  items = {},
  only,
}: {
  colors: Colors;
  /** The owner's switches (admin → Extras): hidden engines are left out, off ones greyed. */
  items?: ExtrasStates;
  /** One engine on a page of its own, without the picker. */
  only?: string;
}) {
  const shown = only
    ? ENGINES.filter((e) => e.id === only)
    : ENGINES.filter((e) => stateOf(items, e.id) !== "hidden");
  const usable = only
    ? shown
    : shown.filter((e) => stateOf(items, e.id) === "on");
  const [engine, setEngine] = useState<Engine>(usable[0]?.id ?? "tor");
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [surge, setSurge] = useState<SurgeData | "error" | null>(null);
  const [view, setView] = useState(0);
  const timing = engine === "first" && view === 1;
  const [rainbow, setRainbow] = useState<RainbowData | "error" | null>(null);
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

  // Refresh keys (Fix list 2026-10-30 #1): each engine looks for newer data in the background
  // and lights its key's marker; what is on screen only changes when the key is pressed.
  const [fresh, setFresh] = useState<Partial<Record<Engine, boolean>>>({});
  const [pulling, setPulling] = useState(false);
  const waiting = useRef<
    Partial<Record<Engine, Record<string, () => unknown>>>
  >({});
  /** Newer data for `e` (from source `slot`) is in hand or one fetch away: hold it. */
  const hold = useCallback((e: Engine, slot: string, apply: () => unknown) => {
    waiting.current[e] = { ...waiting.current[e], [slot]: apply };
    setFresh((f) => (f[e] ? f : { ...f, [e]: true }));
  }, []);
  /** What each engine is showing (its scan time or model run), to compare news against. */
  const stamps = useRef<Partial<Record<string, string>>>({});

  const torColor = (i: number) =>
    pick(colors, `engine:tor:${i}`, TOR_BINS[i].color);
  const blindColor = (i: number) =>
    pick(colors, `engine:blind:${i}`, BLIND_BANDS[i].color);
  const fieldColor = (id: FieldId | OutdoorId, i: number) =>
    pick(colors, `engine:${id}:${i}`, bandsOf(id).colors[i]);
  const outColor = (i: number) =>
    pick(colors, `engine:outmap:${i}`, OUTMAP_BANDS.colors[i]);
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
  const probColor = (i: number) =>
    pick(colors, `engine:prob:${i}`, PROB_BANDS.colors[i]);
  const pyroColor = (i: number) =>
    pick(colors, `engine:pyrocb:${i}`, PYRO_BINS[i].color);

  // A model engine's map is read once per visit (the server keeps it 30 minutes); `v` (a
  // refresh) reads the stored map past the server's own copy.
  const loadField = useCallback(
    (id: FieldId, v?: string) =>
      fetchField(id, v).then((d) => setFields((f) => ({ ...f, [id]: d }))),
    [],
  );
  const want = isField(engine) && !fields[engine] ? engine : null;
  useEffect(() => {
    if (!want) return;
    let live = true;
    fetchField(want)
      .then((d) => live && setFields((f) => ({ ...f, [want]: d })))
      .catch(() => live && setFields((f) => ({ ...f, [want]: "error" })));
    return () => {
      live = false;
    };
  }, [want]);

  // A newer model run stored for the open field engine lights its key (checked every 5 min).
  const fieldOpen = isField(engine) ? engine : null;
  useEffect(() => {
    if (!fieldOpen) return;
    const check = () =>
      document.visibilityState === "visible" &&
      fetch(`/api/engines/stamp?e=${fieldOpen}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { cycle: string | null } | null) => {
          const shown = stamps.current[fieldOpen];
          if (d?.cycle && shown && d.cycle !== shown)
            hold(fieldOpen, "field", () => loadField(fieldOpen, d.cycle!));
        })
        .catch(() => undefined);
    const t = setInterval(check, 300_000);
    return () => clearInterval(t);
  }, [fieldOpen, hold, loadField]);

  // Lightning surges every two minutes while that engine is open and the page is visible.
  useEffect(() => {
    if (engine !== "surge") return;
    let live = true;
    const load = (first: boolean) =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/surge")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: SurgeData) => {
          if (!live) return;
          if (first || !stamps.current.surge) setSurge(d);
          else if (d.at !== stamps.current.surge)
            hold("surge", "live", () => setSurge(d));
        })
        .catch(() => live && setSurge((x) => x ?? "error"));
    load(true);
    const t = setInterval(() => load(false), 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine, hold]);

  // The rotating storms' rain-wrap, every two minutes while that engine is open.
  useEffect(() => {
    if (engine !== "rwrap") return;
    let live = true;
    const load = (first: boolean) =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/rainwrap")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { at: string; storms: WrapStorm[] }) => {
          if (!live) return;
          if (first || !stamps.current.wraps) setWraps(d);
          else if (d.at !== stamps.current.wraps)
            hold("rwrap", "live", () => setWraps(d));
        })
        .catch(() => live && setWraps((x) => x ?? "error"));
    load(true);
    const t = setInterval(() => load(false), 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine, hold]);

  // Rainbow chances every five minutes while that engine is open.
  useEffect(() => {
    if (engine !== "rainbow") return;
    let live = true;
    const load = (first: boolean) =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/rainbow")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: RainbowData) => {
          if (!live) return;
          if (first || !stamps.current.rainbow) setRainbow(d);
          else if (d.at !== stamps.current.rainbow)
            hold("rainbow", "live", () => setRainbow(d));
        })
        .catch(() => live && setRainbow((x) => x ?? "error"));
    load(true);
    const t = setInterval(() => load(false), 300_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine, hold]);

  // Deer and fishing maps once per visit (per species), and the chosen place's three days.
  const mapKey =
    engine === "deer" ? "deer" : engine === "fish" ? `fish:${species}` : null;
  const needMap = mapKey && !placeMaps[mapKey] ? mapKey : null;
  /** Shows a Deer/Fishing outlook; a newer one also renews the picked place's days. */
  const showPlaceMap = (key: string, d: PlaceMap) => {
    setPlaceMaps((m) => ({
      ...m,
      [key]: {
        ...d,
        days: d.days.map((x) => ({ ...x, areas: unpackAreas(x.areas) })),
      },
    }));
    setDetail((m) =>
      Object.fromEntries(
        Object.entries(m).filter(([k]) => !k.startsWith(`${key}@`)),
      ),
    );
  };
  useEffect(() => {
    if (!needMap) return;
    let live = true;
    const [e, sp] = needMap.split(":");
    fetch(`/api/engines/place?e=${e}${sp ? `&sp=${sp}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(
        (d: PlaceMap) =>
          live &&
          setPlaceMaps((m) => ({
            ...m,
            [needMap]: {
              ...d,
              days: d.days.map((x) => ({ ...x, areas: unpackAreas(x.areas) })),
            },
          })),
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
    const load = (first: boolean) =>
      document.visibilityState === "visible" &&
      fetch("/api/engines/probsevere")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: Data) => {
          if (!live) return;
          setFailed(false);
          if (first || !stamps.current.tor) setData(d);
          else if (d.at !== stamps.current.tor)
            hold("tor", "live", () => setData(d));
        })
        .catch(() => live && first && setFailed(true));
    load(true);
    const t = setInterval(() => load(false), 120_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [engine, hold]);

  // The Deer/Fishing outlooks are looked at again every 30 minutes while open.
  const slowKey = mapKey;
  useEffect(() => {
    if (!slowKey) return;
    const [kind, part] = slowKey.split(":");
    const url = `/api/engines/place?e=${kind}${part ? `&sp=${part}` : ""}`;
    const check = () =>
      document.visibilityState === "visible" &&
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: PlaceMap | null) => {
          const shown = stamps.current[slowKey];
          const now = d?.at;
          if (!d || !shown || !now || now === shown) return;
          hold(engine, "slow", () => showPlaceMap(slowKey, d));
        })
        .catch(() => undefined);
    const t = setInterval(check, 1_800_000);
    return () => clearInterval(t);
  }, [slowKey, engine, hold]);

  // What is on screen, for the checks above.
  useEffect(() => {
    const at = <T extends { at: string }>(x: T | "error" | null) =>
      x && x !== "error" ? x.at : undefined;
    const st: Partial<Record<string, string>> = {
      tor: data?.at,
      surge: at(surge),
      wraps: at(wraps),
      rainbow: at(rainbow),
    };
    for (const [k, v] of Object.entries(fields))
      if (v && v !== "error") st[k] = v.cycle;
    for (const [k, v] of Object.entries(placeMaps))
      if (v && v !== "error") st[k] = v.at;
    stamps.current = st;
  });

  /** A refresh with nothing held: fetch the engine's newest data now, past the edge copies. */
  const pull = async (e: Engine) => {
    const r = `r=${Date.now()}`;
    const get = async <T,>(u: string): Promise<T> => {
      const x = await fetch(u);
      if (!x.ok) throw new Error(String(x.status));
      return x.json();
    };
    const jobs: Promise<unknown>[] = [];
    if (e === "tor")
      jobs.push(
        get<Data>(`/api/engines/probsevere?${r}`).then((d) => {
          setData(d);
          setFailed(false);
        }),
      );
    if (e === "surge")
      jobs.push(get<SurgeData>(`/api/engines/surge?${r}`).then(setSurge));
    if (e === "rwrap")
      jobs.push(
        get<{ at: string; storms: WrapStorm[] }>(
          `/api/engines/rainwrap?${r}`,
        ).then(setWraps),
      );
    if (e === "rainbow")
      jobs.push(get<RainbowData>(`/api/engines/rainbow?${r}`).then(setRainbow));
    if (isField(e)) jobs.push(loadField(e, String(Date.now())));
    if (mapKey && (e === "deer" || e === "fish")) {
      const [k, sp] = mapKey.split(":");
      jobs.push(
        get<PlaceMap>(
          `/api/engines/place?e=${k}${sp ? `&sp=${sp}` : ""}&${r}`,
        ).then((d) => showPlaceMap(mapKey, d)),
      );
    }
    await Promise.all(jobs);
  };
  const refresh = async () => {
    const e = engine;
    const held = waiting.current[e];
    delete waiting.current[e];
    setFresh((f) => ({ ...f, [e]: false }));
    setPulling(true);
    const start = Date.now();
    try {
      if (held) await Promise.all(Object.values(held).map((f) => f()));
      else await pull(e);
    } catch {
      // What is shown stays; the key can be pressed again.
    }
    // Long enough to see the key work.
    const rest = 650 - (Date.now() - start);
    if (rest > 0) await new Promise((ok) => setTimeout(ok, rest));
    setPulling(false);
  };

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
    vis("fieldA-fill", isField(e) || isPlace(e));
    vis("fieldA-line", isField(e) || isPlace(e));
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

  // Deer and Fishing cover the lower 48: fit all of it on any screen.
  useEffect(() => {
    if (map && (engine === "deer" || engine === "fish"))
      map.fitBounds(
        [
          [-125, 24.5],
          [-66.5, 49.5],
        ],
        {
          padding: 8,
          duration: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 800,
        },
      );
  }, [map, engine]);

  useEffect(() => {
    if (!map) return;
    const f = isField(engine) ? fields[engine] : undefined;
    const placeAreas =
      engine === "rainbow" && rainbow && rainbow !== "error"
        ? rainbow.maps[view]
        : null;
    const pm =
      mapKey && placeMaps[mapKey] && placeMaps[mapKey] !== "error"
        ? (placeMaps[mapKey] as PlaceMap)
        : null;
    if (engine === "deer" || engine === "fish") {
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(
        pm?.days[view]?.areas ?? EMPTY,
      );
      const expr = [
        "match",
        ["get", "band"],
        ...OUTMAP_BANDS.colors.map((_, i) => [i, outColor(i)]).flat(),
        outColor(0),
      ] as never;
      map.setPaintProperty("fieldA-fill", "fill-color", expr);
      map.setPaintProperty("fieldA-line", "line-color", expr);
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
    } else if (engine === "rainbow")
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
      const probBands = (engine === "stp" || engine === "scp") && alt;
      (map.getSource("fieldA") as GeoJSONSource | undefined)?.setData(
        alt ? f.alt! : f.areas,
      );
      const n = timeBands
        ? FIRST_TIME_BANDS.length
        : probBands
          ? PROB_BANDS.levels.length
          : FIELD_BANDS[engine].levels.length;
      const color = (i: number) =>
        timeBands
          ? timeColor(i)
          : probBands
            ? probColor(i)
            : fieldColor(engine, i);
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
    colors,
  ]);

  const storms = data?.storms ?? [];
  const { reads, run: readRadar } = useRadarReads(
    engine === "tor" ? storms : [],
    data?.at,
  );
  const how = HOW[engine];
  const current = ENGINES.find((e) => e.id === engine)!;
  const legend: [string, string][] =
    engine === "tor"
      ? TOR_BINS.map((b, i) => [b.label, torColor(i)])
      : engine === "surge"
        ? SURGE_BANDS.map((b, i) => [b.label, surgeColor(i)])
        : engine === "first" && timing
          ? FIRST_TIME_BANDS.map((b, i) => [b.label, timeColor(i)])
          : (engine === "stp" || engine === "scp") && view === 1
            ? PROB_BANDS.labels.map((l, i) => [l, probColor(i)])
            : engine === "blind"
              ? BLIND_BANDS.map((b, i) => [b.label, blindColor(i)])
              : engine === "deer" || engine === "fish"
                ? OUTMAP_BANDS.labels.map((l, i) => [l, outColor(i)])
                : bandsOf(engine).labels.map((l, i) => [
                    l,
                    fieldColor(engine, i),
                  ]);
  const placeNow =
    mapKey && placeMaps[mapKey] && placeMaps[mapKey] !== "error"
      ? (placeMaps[mapKey] as PlaceMap)
      : null;
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
      <div
        className={s.sections}
        role="tablist"
        aria-label="Weather engines"
        hidden={!!only}
      >
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
                      <span className={s.power} aria-hidden>
                        {e.icon}
                      </span>
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
          file={`sswx-engine-${engine}`}
          card={async (shot) =>
            (await import("@/features/map/snapshot")).enginePng(shot, {
              name: current.name,
              sub: current.sub,
              how: [how.lead, how.body[0]],
              legend,
            })
          }
        />
        <span className={s.badge}>
          <FlaskConical aria-hidden /> Experimental
        </span>
        {engine !== "blind" && (
          <RefreshKey
            className={s.refresh}
            onPress={refresh}
            busy={pulling}
            fresh={!!fresh[engine]}
            label={`Refresh ${shown.find((x) => x.id === engine)?.name ?? "this engine"}`}
          />
        )}
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
              {placeNow?.days[v] && ` · ${weekday(placeNow.days[v].date)}`}
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
          {data?.stats !== undefined && (
            <HitCard stats={data.stats ?? null} what={HIT_MEANS.tor} />
          )}
          {data && storms.length === 0 && (
            <p className={s.small}>
              No storm is showing tornado potential right now. ProbSevere is
              tracking {data.total} storm{data.total === 1 ? "" : "s"} across
              the country.
            </p>
          )}
          <ul className={s.storms}>
            {storms.map((x) => {
              const r = reads[x.id];
              const o = withRadar(
                { ...x, now: x.tor, trend: x.trend as TorOutlook["trend"] },
                typeof r === "object" ? r : undefined,
              );
              return (
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
                          ["Now", o.now],
                          ["20 min", o.p20],
                          ["40", o.p40],
                          ["60", o.p60],
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
                    {x.line && (
                      <span data-k={x.line.boost > 1 ? "up" : undefined}>
                        <GitMerge aria-hidden /> Squall line: {x.line.met} of 3
                        ingredients ({x.line.across} kt shear across it
                        {x.line.surge ? ", surging" : ""})
                      </span>
                    )}
                    <RadarFlags x={x} read={r} run={readRadar} />
                  </p>
                </li>
              );
            })}
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
                        {x.since === 0 ? "just now" : `${x.since} min ago`}
                        <em
                          className={s.sigma}
                          aria-label={`${x.peak} sigma, level ${x.level} of 4`}
                        >
                          {[2, 3, 4].map((l) => (
                            <i key={l} data-on={x.level >= l || undefined} />
                          ))}
                          {x.level >= 4 ? "4σ+" : `${x.level}σ`}
                        </em>
                      </span>
                    )}
                    {x.merged && (
                      <span>
                        <GitMerge aria-hidden /> Merger or split followed by
                        overlap
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
          {surge && surge !== "error" && (
            <HitCard stats={surge.stats} what={HIT_MEANS.surge} />
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
        <HitCard
          stats={field.stats}
          what={HIT_MEANS[engine] ?? "A hit is the weather following a flag."}
        />
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
                {engine === "deer" ? "Where deer move most" : "Best bite"},{" "}
                {VIEWS[engine]![view]}
              </h3>
              {placeNow && <small>GFS {placeNow.cycle.slice(8)}Z run</small>}
            </header>
            <p className={s.small}>
              An outlook for the lower 48 drawn like SPC&apos;s: each place is
              scored at its own dawn and dusk from the GFS model&apos;s
              forecast.{" "}
              {engine === "deer"
                ? "Deer move most when it turns colder than the days before, as pressure rises behind a front, in light wind and little rain, and the rut lifts the whole map in season."
                : "Fish bite best as pressure falls slowly ahead of a front, with a light chop, some cloud and water in the comfortable range for the fish you picked, and near the moon's major and minor periods."}{" "}
              The brighter the area, the better that day. Tap anywhere, or a
              place here, for its next three days hour by hour.
            </p>
            {placeNow?.days[view] && (
              <p className={s.small}>
                Typical spot: <b>{placeNow.days[view].typical}</b> of 100 (
                {OUTMAP_BANDS.labels[
                  placeNow.levels.findLastIndex(
                    (l) => placeNow.days[view].typical >= l,
                  )
                ] ?? "Slow"}
                ).
              </p>
            )}
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
                {(placeMaps[mapKey] as PlaceMap).days[view]?.spots.map((x) => (
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
                        {x.window && <small>Best at {x.window}</small>}
                        {x.note && <small>{x.note}</small>}
                      </span>
                      <span className={s.hail}>
                        <i
                          style={{
                            background: outColor(
                              Math.max(
                                0,
                                (
                                  placeMaps[mapKey] as PlaceMap
                                ).levels.findLastIndex((l) => x.value >= l),
                              ),
                            ),
                          }}
                        />
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
