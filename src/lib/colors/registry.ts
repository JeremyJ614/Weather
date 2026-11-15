/**
 * Every data color an admin can change, with its default. Keys are stable:
 * an override is stored by key in app_config "color_overrides" and applied
 * wherever the color is drawn. Theme colors are not here (a theme is a token
 * swap); these are the meanings painted on maps and charts.
 */
import { DROUGHT, ERO_COLORS, QPF_SCALE, RAMP } from "@/lib/map/products";
import { PASTEL } from "@/lib/ingredients/calc";
import { HAZ, HAZARDS, RISK } from "@/lib/timing/calc";
import { KIND } from "@/lib/warnings/reports";
import type { Colors } from "./pick";
import { BANDS } from "@/lib/sswxcon/score";
import { WORDLE_COLORS } from "@/lib/weatherdle/colors";
import { EXTREME_COLORS } from "@/lib/extremes/colors";
import {
  COLOR as WARN,
  TAG_COLOR,
  TAG_LABEL,
  WARN_TAGS,
} from "@/lib/warnings/style";
import { RARITY } from "@/lib/badges";
import { GAUGE_LEVELS } from "@/lib/rivers/style";
import { SHELTER_COLORS } from "@/lib/disaster/style";
import { SND_BANDS, SND_LINES } from "@/lib/soundings/style";
import { CAM_KINDS } from "@/lib/cams/style";
import { SKY_BANDS, SKY_APERTURE } from "@/lib/sky/score";
import { SCALES } from "@/lib/models/params";
import { PAT_COLORS } from "@/lib/patterns/style";
import { ASTRO_LINES } from "@/lib/sky/style";
import { AURORA_LINES, AURORA_RAMP, KP_SCALE } from "@/lib/aurora/style";
import { LT_BANDS } from "@/lib/lightning/style";
import { CLIMO_LIGHT, CLIMO_LINES, CLIMO_RAMP } from "@/lib/climo/style";
import { COMPARE } from "@/lib/radar/products";
import { BANDS as CHASE_BANDS, CHASE_ALT } from "@/lib/chase/score";
import {
  BLIND_BANDS,
  FIELD_BANDS,
  BOUND_POINTS,
  FIRST_TIME_BANDS,
  OUTDOOR_BANDS,
  OUTMAP_BANDS,
  PYRO_BINS,
  SURGE_BANDS,
  TOR_BINS,
} from "@/lib/engines/colors";
import { PROB as WINTER_PROB } from "@/lib/winter/style";
import {
  CC_STOPS,
  DEFAULTS as REPLAY,
  FOLD,
  RADAR_STOPS,
  VEL_STOPS,
} from "@/features/replay/palette";
import { CONTAIN, FIRE_RISK } from "@/lib/fire/style";
import { HAZ_KINDS, USDM } from "@/lib/hazards/style";
import { ROSTER } from "@/lib/tropical/atcf";
import {
  CONE,
  INTENSITY,
  RISK as TROP_RISK,
  WATCH,
} from "@/lib/tropical/style";
import { KIND_TITLE, PROB_STEPS, SPC_PALETTES, type Kind } from "./spc";

export type Entry = { key: string; label: string; def: string };
export type Group = {
  id: string;
  label: string;
  note?: string;
  entries: Entry[];
};

export { EF_COLORS } from "./ef";
import { EF_COLORS } from "./ef";

export const SSWX_PARTS: Record<string, string> = {
  tornado: "#ef4444",
  severe: "#f97316",
  tropical: "#a855f7",
  flood: "#38bdf8",
  winter: "#67e8f9",
  setup: "#4ade80",
  fire: "#fbbf24",
};

export const GROUPS: Group[] = [
  ...(Object.keys(SPC_PALETTES) as Kind[]).map((k) => ({
    id: `spc-${k}`,
    label: `SPC · ${KIND_TITLE[k]}`,
    entries: SPC_PALETTES[k].map((l, i) => ({
      key: `spc:${k}:${i}`,
      label: l.label,
      def: l.color,
    })),
  })),
  {
    id: "prob",
    label: "Severe probability scale",
    entries: PROB_STEPS.map((s) => ({
      key: `prob:${s.level}`,
      label: `${s.level} · ${s.label}`,
      def: s.color,
    })),
  },
  {
    id: "ef",
    label: "Tornado paths (EF scale)",
    note: "Severe Weather History",
    entries: Object.entries(EF_COLORS).map(([k, v]) => ({
      key: `ef:${k}`,
      label: k === "EFU" ? "Unrated" : k,
      def: v,
    })),
  },
  {
    id: "qpf",
    label: "WPC rainfall",
    entries: QPF_SCALE.map((s, i) => ({
      key: `qpf:${i}`,
      label: `${s.at}"`,
      def: s.color,
    })),
  },
  {
    id: "ero",
    label: "WPC excessive rainfall risk",
    entries: ERO_COLORS.map((s, i) => ({
      key: `ero:${i}`,
      label: s.label,
      def: s.color,
    })),
  },
  {
    id: "cpc",
    label: "CPC outlooks",
    entries: [
      ...(["above", "below", "wet", "dry"] as const).flatMap((n) =>
        RAMP[n].map((c, i) => ({
          key: `cpc:${n}:${i}`,
          label: `${{ above: "Warmer", below: "Colder", wet: "Wetter", dry: "Drier" }[n]} · step ${i + 1}`,
          def: c,
        })),
      ),
      { key: "cpc:normal", label: "Near normal", def: "#adb5bd" },
    ],
  },
  {
    id: "drought",
    label: "CPC drought outlook",
    entries: Object.entries(DROUGHT).map(([k, s]) => ({
      key: `drought:${k}`,
      label: s.label,
      def: s.color,
    })),
  },
  {
    id: "warnings",
    label: "Warnings map",
    note: "NWS standard colors by default",
    entries: Object.entries(WARN).map(([k, v]) => ({
      key: `warn:${k}`,
      label: k,
      def: v,
    })),
  },
  {
    id: "warntags",
    label: "Warning outlines (impact tags)",
    note: "Severe Weather History · the strongest wording on each warning",
    entries: WARN_TAGS.map((t) => ({
      key: `warntag:${t}`,
      label: TAG_LABEL[t],
      def: TAG_COLOR[t],
    })),
  },
  {
    id: "reports",
    label: "Storm reports",
    entries: Object.entries(KIND).map(([k, v]) => ({
      key: `report:${k}`,
      label: v.label,
      def: v.color,
    })),
  },
  {
    id: "ingredients",
    label: "Storm ingredients & timing",
    note: "VIP's pastel ramp, benign to violent, plus wind and rotation",
    entries: Object.entries(PASTEL).map(([k, v]) => ({
      key: `ing:${k}`,
      label: k[0].toUpperCase() + k.slice(1),
      def: v,
    })),
  },
  {
    id: "timing",
    label: "Storm Timing Index",
    note: "Hazard lines and the six threat words",
    entries: [
      ...HAZARDS.map((k) => ({
        key: `timing:${k}`,
        label: HAZ[k].label,
        def: HAZ[k].color as string,
      })),
      ...RISK.map((r, i) => ({
        key: `timing:risk:${i}`,
        label: `Threat · ${r.label}`,
        def: r.color as string,
      })),
    ],
  },
  {
    id: "sswxcon",
    label: "SSWXCon",
    entries: [
      ...BANDS.map((b, i) => ({
        key: `sswx:band:${i}`,
        label: `Band · ${b.label}`,
        def: b.color,
      })),
      ...Object.entries(SSWX_PARTS).map(([k, v]) => ({
        key: `sswx:part:${k}`,
        label: `Part · ${k[0].toUpperCase()}${k.slice(1)}`,
        def: v,
      })),
    ],
  },
  {
    id: "tropical",
    label: "Tropical Outlook",
    note: "Storm strength, the forecast cone, outlook chances and coastal watches.",
    entries: [
      ...INTENSITY.map((t) => ({
        key: `trop:${t.key}`,
        label: t.label,
        def: t.color,
      })),
      { key: "trop:cone", label: "Forecast cone", def: CONE },
      ...Object.entries(TROP_RISK).map(([k, v]) => ({
        key: `trop:risk:${k}`,
        label: `Outlook chance · ${k[0].toUpperCase()}${k.slice(1)}`,
        def: v,
      })),
      ...Object.entries(WATCH).map(([k, v]) => ({
        key: `trop:ww:${k}`,
        label: v.label,
        def: v.color,
      })),
    ],
  },
  {
    id: "models",
    label: "Tropical models",
    note: "Each model's track on Tropical Outlook's Model Tracks.",
    entries: ROSTER.map((m) => ({
      key: `model:${m.tech}`,
      label: m.name,
      def: m.color,
    })),
  },
  {
    id: "usdm",
    label: "US Drought Monitor",
    note: "The weekly drought categories on Hazards & Droughts.",
    entries: USDM.map((d, i) => ({
      key: `usdm:${i}`,
      label: `${d.code} · ${d.label}`,
      def: d.color,
    })),
  },
  {
    id: "hazards",
    label: "Hazards outlook",
    note: "CPC's 3–7 and 8–14 day hazards on Hazards & Droughts.",
    entries: Object.entries(HAZ_KINDS).map(([k, v]) => ({
      key: `haz:${k}`,
      label: v.label,
      def: v.color,
    })),
  },
  {
    id: "fire",
    label: "Fire Weather",
    note: "SPC fire outlook areas and wildfire dots by containment.",
    entries: [
      ...Object.entries(FIRE_RISK).map(([k, v]) => ({
        key: `fire:${k}`,
        label: v.label,
        def: v.color,
      })),
      ...CONTAIN.map((c) => ({
        key: `fire:contain:${c.key}`,
        label: c.label,
        def: c.color,
      })),
    ],
  },
  {
    id: "winter",
    label: "Winter odds",
    note: "WPC's odds of heavy snow or ice on the Winter Center.",
    entries: WINTER_PROB.map((p, i) => ({
      key: `winter:prob:${i + 1}`,
      label: p.label,
      def: p.color,
    })),
  },
  {
    id: "chase",
    label: "Chase score",
    note: "The Storm Chasing Outlook's score bands.",
    entries: [
      ...CHASE_BANDS.map((b, i) => ({
        key: `chase:band:${i}`,
        label: `${b.min}+ · ${b.label}`,
        def: b.color,
      })),
      { key: "chase:alt", label: "Second target", def: CHASE_ALT },
    ],
  },
  {
    id: "engine-tor",
    label: "ProbTor",
    note: "Extras → Weather Engines: tornado chance cones by probability.",
    entries: TOR_BINS.map((b, i) => ({
      key: `engine:tor:${i}`,
      label: b.label,
      def: b.color,
    })),
  },
  {
    id: "engine-surge",
    label: "Lightning Surge Detector",
    note: "Extras → Weather Engines: storm outlines by lightning trend.",
    entries: SURGE_BANDS.map((b, i) => ({
      key: `engine:surge:${i}`,
      label: b.label,
      def: b.color,
    })),
  },
  {
    id: "engine-blind",
    label: "Radar Blind Spot",
    note: "Extras → Weather Engines: height of the lowest radar beam.",
    entries: BLIND_BANDS.map((b, i) => ({
      key: `engine:blind:${i}`,
      label: b.label,
      def: b.color,
    })),
  },
  ...(
    [
      ["llj", "Nocturnal LLJ Ramp-Up"],
      ["nst", "Landspout & Waterspout (NST)"],
      ["pyro", "Hot-Dry-Windy Index (PyroCb)"],
      ["tctor", "Landfalling Hurricane Tornado Risk"],
      ["stp", "Significant Tornado Parameter"],
      ["scp", "Supercell Composite Parameter"],
      ["dcp", "Derecho Composite Parameter"],
      ["ltg", "Lightning Threat"],
      ["rwrap", "Rain-Wrap Index"],
      ["blizz", "Blizzard Composite (hours of whiteout)"],
      ["first", "First Storms (chance)"],
      ["sunset", "Sunset & Sunrise Quality"],
      ["bound", "Boundary Collision Analyzer (boundaries)"],
    ] as const
  ).map(([id, label]) => ({
    id: `engine-${id}`,
    label,
    note: "Extras → Weather Engines map bands.",
    entries: [
      ...FIELD_BANDS[id].labels.map((l, i) => ({
        key: `engine:${id}:${i}`,
        label: l,
        def: FIELD_BANDS[id].colors[i],
      })),
      // The Blizzard map also brightens the interstates crossing its areas.
      ...(id === "blizz"
        ? [{ key: "engine:roads", label: "Interstates", def: "#e2e8f0" }]
        : []),
    ],
  })),
  ...(
    [
      ["rainbow", "Rainbow Chance"],
      ["deer", "Deer Activity"],
      ["fish", "Fishing Bite"],
    ] as const
  ).map(([id, label]) => ({
    id: `engine-${id}`,
    label,
    note:
      id === "rainbow"
        ? "Extras → Weather Engines map bands and charts."
        : "Extras → Weather Engines: a place's hour-by-hour bars.",
    entries: OUTDOOR_BANDS[id].labels.map((l, i) => ({
      key: `engine:${id}:${i}`,
      label: l,
      def: OUTDOOR_BANDS[id].colors[i],
    })),
  })),
  {
    id: "engine-outmap",
    label: "Deer & Fishing outlooks",
    note: "Extras → Weather Engines: the Day 1–3 maps of the lower 48, drawn like SPC's outlooks.",
    entries: OUTMAP_BANDS.labels.map((l, i) => ({
      key: `engine:outmap:${i}`,
      label: l,
      def: OUTMAP_BANDS.colors[i],
    })),
  },
  {
    id: "engine-boundpt",
    label: "Boundary collisions (points)",
    note: "Extras → Weather Engines → Boundary Collisions: where boundaries meet, by score.",
    entries: BOUND_POINTS.map((b, i) => ({
      key: `engine:boundpt:${i}`,
      label: b.label,
      def: b.color,
    })),
  },
  {
    id: "engine-firstT",
    label: "First Storms (timing)",
    note: "Extras → Weather Engines → First Storms: when the first storms start.",
    entries: FIRST_TIME_BANDS.map((b, i) => ({
      key: `engine:firstT:${i}`,
      label: b.label,
      def: b.color,
    })),
  },
  {
    id: "engine-pyrocb",
    label: "PyroCb chance per fire",
    note: "Extras → Weather Engines: each large fire's dot.",
    entries: PYRO_BINS.map((b, i) => ({
      key: `engine:pyrocb:${i}`,
      label: b.label,
      def: b.color,
    })),
  },
  {
    id: "replay",
    label: "Tornado Archive & Chase Log",
    note: "Replay map: warnings, hail, your track and the proximity ring (paths use the EF colors).",
    entries: [
      {
        key: "replay:warn:tornado",
        label: "Tornado warning",
        def: REPLAY.warn.tornado,
      },
      {
        key: "replay:warn:severe",
        label: "Severe warning",
        def: REPLAY.warn.severe,
      },
      {
        key: "replay:warn:emergency",
        label: "Tornado emergency",
        def: REPLAY.warn.emergency,
      },
      { key: "replay:hail:small", label: 'Hail ¾"', def: REPLAY.hail.small },
      { key: "replay:hail:mid", label: 'Hail 2"', def: REPLAY.hail.mid },
      { key: "replay:hail:big", label: 'Hail 4"+', def: REPLAY.hail.big },
      {
        key: "replay:prox:safe",
        label: "Proximity: far",
        def: REPLAY.prox.safe,
      },
      {
        key: "replay:prox:near",
        label: "Proximity: near",
        def: REPLAY.prox.near,
      },
      {
        key: "replay:prox:close",
        label: "Proximity: close",
        def: REPLAY.prox.close,
      },
      {
        key: "replay:prox:imminent",
        label: "Proximity: imminent",
        def: REPLAY.prox.imminent,
      },
      {
        key: "replay:track:done",
        label: "Track driven",
        def: REPLAY.track.done,
      },
      {
        key: "replay:track:rest",
        label: "Track ahead",
        def: REPLAY.track.rest,
      },
      {
        key: "replay:track:trail",
        label: "Track trail",
        def: REPLAY.track.trail,
      },
      {
        key: "replay:track:chaser",
        label: "Chaser marker",
        def: REPLAY.track.chaser,
      },
    ],
  },
  {
    id: "replay-radar",
    label: "Replay radar",
    note: "Tornado Archive & Chase Log radar reflectivity.",
    entries: RADAR_STOPS.map(([dbz, c]) => ({
      key: `replay:radar:${dbz}`,
      label: `${dbz} dBZ`,
      def: c,
    })),
  },
  {
    id: "replay-velocity",
    label: "Replay radar velocity",
    note: "Each radar's own scans in the Tornado Archive and Chase Log: radial and storm-relative velocity (m/s; negative is toward the radar).",
    entries: [
      ...VEL_STOPS.map(([v, c]) => ({
        key: `replay:vel:${v}`,
        label: `${v} m/s`,
        def: c,
      })),
      { key: "replay:folded", label: "Range folded", def: FOLD.default },
    ],
  },
  {
    id: "replay-cc",
    label: "Replay radar correlation",
    note: "Correlation coefficient: rain near 1, hail and edges in the 0.9s, tornado debris below about 0.8.",
    entries: CC_STOPS.map(([v, c]) => ({
      key: `replay:cc:${v}`,
      label: `CC ${v}`,
      def: c,
    })),
  },
  {
    id: "runs",
    label: "Model comparison",
    note: "Each model's line on Radar & Model Runs.",
    entries: COMPARE.map((m) => ({
      key: `runs:${m.key}`,
      label: m.label,
      def: m.color,
    })),
  },
  {
    id: "soundings",
    label: "Soundings",
    note: "Skew-T lines, hodograph and 3D wind bands on 3D Soundings.",
    entries: [...SND_LINES, ...SND_BANDS].map((g) => ({
      key: `snd:${g.key}`,
      label: g.label,
      def: g.color,
    })),
  },
  {
    id: "climo",
    label: "Climatology",
    note: "Density ramps on the tornado, hurricane and lightning maps, season and EF2+ lines on Climatology.",
    entries: [...CLIMO_RAMP, ...CLIMO_LIGHT, ...CLIMO_LINES].map((x, i) => ({
      key: `climo:${x.key}`,
      label: x.label || `Ramp step ${i + 1}`,
      def: x.color,
    })),
  },
  {
    id: "lightning",
    label: "Lightning",
    note: "Strike-density bands in Lightning Monitoring's scope and hotspot list (the map tiles are NOAA's).",
    entries: LT_BANDS.map((b) => ({
      key: `lt:${b.key}`,
      label: b.label,
      def: b.color,
    })),
  },
  {
    id: "aurora",
    label: "Aurora",
    note: "Oval chance ramp, oval edge and view line on Aurora Center.",
    entries: [...AURORA_RAMP, ...AURORA_LINES].map((x) => ({
      key: `aurora:${x.key}`,
      label: x.label,
      def: x.color,
    })),
  },
  {
    id: "kp",
    label: "Kp / G-scale",
    note: "Kp bars and storm levels on Aurora Center.",
    entries: KP_SCALE.map((x) => ({
      key: `kp:${x.key}`,
      label: `Kp ${x.min}+ ${x.label}`,
      def: x.color,
    })),
  },
  {
    id: "astro",
    label: "Astronomy",
    note: "Sun and moon lines and planet colors on Astronomy.",
    entries: ASTRO_LINES.map((l) => ({
      key: `astro:${l.key}`,
      label: l.label,
      def: l.color,
    })),
  },
  {
    id: "sky",
    label: "Stargazing",
    note: "Score bands on Star Gazing Forecast (map, chart, numbers) and the target dots on its sky chart.",
    entries: [...SKY_BANDS, ...SKY_APERTURE].map((b) => ({
      key: `sky:${b.key}`,
      label:
        b.key in { eye: 1, binoculars: 1, telescope: 1 }
          ? `Targets: ${b.label}`
          : b.label,
      def: b.color,
    })),
  },
  {
    id: "cams",
    label: "Cameras",
    note: "Camera dots on Traffic Cameras.",
    entries: CAM_KINDS.map((k) => ({
      key: `cam:${k.key}`,
      label: k.label,
      def: k.color,
    })),
  },
  {
    id: "gauges",
    label: "River gauges",
    note: "Flood categories on River & Flood Gauges.",
    entries: GAUGE_LEVELS.map((g) => ({
      key: `gauge:${g.key}`,
      label: g.label,
      def: g.color,
    })),
  },
  {
    id: "shelters",
    label: "Storm shelters",
    note: "The Storm Shelter map on Disaster Response.",
    entries: SHELTER_COLORS.map((c) => ({
      key: `shelter:${c.key}`,
      label: c.label,
      def: c.color,
    })),
  },
  {
    id: "extremes",
    label: "Climate Extremes",
    note: "The extremes now, their map dots, and this week's records.",
    entries: EXTREME_COLORS.map((c) => ({
      key: `extreme:${c.key}`,
      label: c.label,
      def: c.color,
    })),
  },
  {
    id: "weatherdle",
    label: "Weatherdle",
    note: "The tiles and keys in WX Games → Weatherdle.",
    entries: WORDLE_COLORS.map((c) => ({
      key: `weatherdle:${c.key}`,
      label: c.label,
      def: c.color,
    })),
  },
  {
    id: "badges",
    label: "Badge rarity",
    entries: Object.entries(RARITY).map(([k, v]) => ({
      key: `badge:${k}`,
      label: `${k[0].toUpperCase()}${k.slice(1)}`,
      def: v,
    })),
  },
  {
    id: "models",
    label: "Model maps",
    note: "Color scales on the HRRR, GFS and REFS maps in Radar & Model Runs. Each scale's stops spread across that field's levels, and the map shades smoothly between them.",
    entries: Object.entries(SCALES).flatMap(([scale, stops]) =>
      stops.map((c, i) => ({
        key: `model:${scale}:${i}`,
        label: `${scale} scale, stop ${i + 1}`,
        def: c,
      })),
    ),
  },
  {
    id: "patterns",
    label: "Weather Patterns",
    note: "Pattern index, the Day 4–7 probabilities and the report bars on Weather Patterns.",
    entries: PAT_COLORS.map((x) => ({
      key: `pat:${x.key}`,
      label: x.label,
      def: x.color,
    })),
  },
];

export const ALL_KEYS = new Set(
  GROUPS.flatMap((g) => g.entries.map((e) => e.key)),
);
export const HEX = /^#[0-9a-f]{6}$/i;

export { pick, type Colors } from "./pick";

/** Keeps only known keys with valid hex values. */
export function cleanColors(raw: unknown): Colors {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      (e): e is [string, string] =>
        ALL_KEYS.has(e[0]) && typeof e[1] === "string" && HEX.test(e[1]),
    ),
  );
}
