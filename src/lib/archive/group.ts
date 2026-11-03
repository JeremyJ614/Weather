/**
 * Groups NWS-surveyed tornado tracks into archive days (Fix-It #7.18). Pure: the cron route
 * fetches, this decides. Two tracks belong to the same event when one starts within three
 * hours of the other and their paths come within 120 km; the link is transitive, so a squall
 * line or an outbreak sweeping across states stays one event, while storms on opposite
 * sides of the country on the same afternoon are separate.
 */
import { zoneAt } from "@/features/replay/core/timezone";

export type Survey = {
  start: number;
  end: number;
  ef: string;
  wfo: string;
  fat: number;
  inj: number;
  lengthMi: number;
  /** [lon, lat] points along the surveyed path. */
  path: [number, number][];
  /** SPC database rows only (days before 2023): width, state and whether it earns the day a place. */
  widthYd?: number;
  st?: string;
  key?: boolean;
};

export type AutoDay = {
  id: string;
  day: string;
  name: string;
  region: string;
  tz: string;
  t0: number;
  t1: number;
  west: number;
  south: number;
  east: number;
  north: number;
  count: number;
  strongest: string;
  fatalities: number;
  injuries: number;
};

export const EF_RANK: Record<string, number> = {
  EFU: -1,
  EF0: 0,
  EF1: 1,
  EF2: 2,
  EF3: 3,
  EF4: 4,
  EF5: 5,
};

const km = (a: [number, number], b: [number, number]) => {
  const r = Math.PI / 180;
  const x = (b[0] - a[0]) * r * Math.cos(((a[1] + b[1]) / 2) * r);
  const y = (b[1] - a[1]) * r;
  return Math.hypot(x, y) * 6371;
};

/** Closest approach of two paths, by their points (paths are already thinned). */
export function gapKm(a: [number, number][], b: [number, number][]) {
  let best = Infinity;
  for (const p of a) for (const q of b) best = Math.min(best, km(p, q));
  return best;
}

export type Namer = (
  lat: number,
  lon: number,
) => { place: string; st: string } | null;

export function groupSurveys(
  list: Survey[],
  name: Namer,
  stateName: (st: string) => string,
  /** Told each day's own tracks, for callers that keep them (the SPC days). */
  members?: (day: AutoDay, tracks: Survey[]) => void,
): AutoDay[] {
  const s = [...list].sort((a, b) => a.start - b.start);
  const parent = s.map((_, i) => i);
  const find = (i: number): number =>
    parent[i] === i ? i : (parent[i] = find(parent[i]));
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      if (s[j].start - s[i].start > 3 * 3600) break;
      if (gapKm(s[i].path, s[j].path) <= 120) parent[find(j)] = find(i);
    }
  const groups = new Map<number, Survey[]>();
  s.forEach((t, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), t]);
  });

  const days: AutoDay[] = [];
  const taken = new Map<string, number>();
  for (const g of groups.values()) {
    const lead = g.reduce((a, b) =>
      (EF_RANK[b.ef] ?? -1) > (EF_RANK[a.ef] ?? -1) ||
      ((EF_RANK[b.ef] ?? -1) === (EF_RANK[a.ef] ?? -1) &&
        b.lengthMi > a.lengthMi)
        ? b
        : a,
    );
    const mid = lead.path[Math.floor(lead.path.length / 2)];
    const tz = zoneAt(mid[1], mid[0]) ?? "America/Chicago";
    const t0 = Math.min(...g.map((t) => t.start));
    const day = new Date(t0 * 1000).toLocaleDateString("en-CA", {
      timeZone: tz,
    });
    const states = new Set<string>();
    for (const t of g) {
      const n = name(t.path[0][1], t.path[0][0]);
      if (n) states.add(n.st);
    }
    const at = name(mid[1], mid[0]);
    const place = at ? `${at.place}, ${at.st}` : `${lead.wfo} area`;
    const slug =
      place
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 36) || "day";
    let id = `${day}-${slug}`;
    const n = (taken.get(id) ?? 0) + 1;
    taken.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    const pts = g.flatMap((t) => t.path);
    const d: AutoDay = {
      id,
      day,
      name: place,
      region: [...states].map(stateName).sort().join(" · ") || "United States",
      tz,
      t0,
      t1: Math.max(...g.map((t) => t.end)),
      west: Math.min(...pts.map((p) => p[0])),
      south: Math.min(...pts.map((p) => p[1])),
      east: Math.max(...pts.map((p) => p[0])),
      north: Math.max(...pts.map((p) => p[1])),
      count: g.length,
      strongest: lead.ef,
      fatalities: g.reduce((a, t) => a + t.fat, 0),
      injuries: g.reduce((a, t) => a + t.inj, 0),
    };
    days.push(d);
    members?.(d, g);
  }
  return days.sort((a, b) => b.t0 - a.t0);
}
