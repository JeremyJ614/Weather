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
import { KIND_TITLE, PROB_STEPS, SPC_PALETTES, type Kind } from "./spc";

export type Entry = { key: string; label: string; def: string };
export type Group = {
  id: string;
  label: string;
  note?: string;
  entries: Entry[];
};

/** EF-scale tornado path colors (VIP's), used by Severe Weather History. */
export const EF_COLORS: Record<string, string> = {
  EFU: "#8fa3bf",
  EF0: "#f6f8fc",
  EF1: "#89cff0",
  EF2: "#5fd9a8",
  EF3: "#e8bb4d",
  EF4: "#e2373c",
  EF5: "#8b46d9",
};

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
