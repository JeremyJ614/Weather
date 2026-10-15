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
import { COLOR as WARN } from "@/lib/warnings/style";
import { RARITY } from "@/lib/badges";
import { GAUGE_LEVELS } from "@/lib/rivers/style";
import { SND_BANDS, SND_LINES } from "@/lib/soundings/style";
import { COMPARE } from "@/lib/radar/products";
import { BANDS as CHASE_BANDS } from "@/lib/chase/score";
import { PROB as WINTER_PROB } from "@/lib/winter/style";
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
    note: "Each model's track in the Model Battle Royale.",
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
    entries: CHASE_BANDS.map((b, i) => ({
      key: `chase:band:${i}`,
      label: `${b.min}+ · ${b.label}`,
      def: b.color,
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
    id: "badges",
    label: "Badge rarity",
    entries: Object.entries(RARITY).map(([k, v]) => ({
      key: `badge:${k}`,
      label: `${k[0].toUpperCase()}${k.slice(1)}`,
      def: v,
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
