/**
 * What a tapped mark on the replay map is, in a line or two (owner's Final Fix-It #17):
 * a tornado on the ground or its path, a surveyed damage point, a hail report, a warning,
 * a photo or the chaser. Marks the replay has not reached yet (their reveal state is
 * still 0) are not there to tap.
 */
export const TAPPABLE = [
  "tornado-now",
  "damage-point",
  "hail-point",
  "photo-pin",
  "chaser-dot",
  "path-line",
  "warn-fill",
] as const;

type Tapped = {
  layer: { id: string };
  properties: Record<string, unknown>;
  state?: Record<string, unknown>;
};
export type Label = { title: string; line?: string };

const s = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const n = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const shown = (f: Tapped, key: string) => (n(f.state?.[key]) ?? 0) > 0;
const join = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" · ") || undefined;

export function describe(f: Tapped): Label | null {
  const p = f.properties;
  switch (f.layer.id) {
    case "tornado-now":
      return {
        title: s(p.name) ?? "Tornado",
        line: `${s(p.ef) ?? "EFU"} tornado on the ground now`,
      };
    case "path-line":
      return {
        title: s(p.name) ?? "Tornado path",
        line: `${s(p.ef) ?? "EFU"} tornado path`,
      };
    case "damage-point": {
      if (!shown(f, "age")) return null;
      const wind = n(p.wind);
      const dod = n(p.degree);
      return {
        title: `Damage survey point · ${s(p.ef) ?? "EFU"}`,
        line: join(
          s(p.what),
          dod !== undefined ? `degree of damage ${dod}` : undefined,
          wind ? `about ${Math.round(wind)} mph` : undefined,
        ),
      };
    }
    case "hail-point": {
      if (!shown(f, "age")) return null;
      const inches = n(p.in);
      return {
        title: `Hail report · ${s(p.name) ?? "hail"}${inches ? ` (${inches}″)` : ""}`,
        line: join(s(p.place), s(p.source)),
      };
    }
    case "warn-fill":
      if (!shown(f, "fill")) return null;
      return {
        title: s(p.label) ?? "Warning",
        line: join(s(p.where), s(p.wfo) ? `NWS ${s(p.wfo)}` : undefined),
      };
    case "photo-pin":
      return { title: "Photo", line: "Taken here on the chase" };
    case "chaser-dot":
      return { title: "The chaser", line: "Where the car is at this moment" };
    default:
      return null;
  }
}

/** The best mark under a tap: the first that describes itself, in TAPPABLE's order. */
export function pick(features: Tapped[]): Label | null {
  for (const id of TAPPABLE)
    for (const f of features)
      if (f.layer.id === id) {
        const l = describe(f);
        if (l) return l;
      }
  return null;
}
