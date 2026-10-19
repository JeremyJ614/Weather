import type { ArchiveEvent } from "@/features/replay/archive/types";
import type { DiscoveryBundle } from "@/features/replay/import/sources";

export type AutoMeta = {
  id: string;
  name: string;
  region: string;
  tz: string;
  t0: number;
};

/** An automatic archive day, from what the NWS survey and IEM archives returned for it. */
export function eventFromBundle(m: AutoMeta, b: DiscoveryBundle): ArchiveEvent {
  return {
    id: m.id,
    name: m.name,
    region: m.region,
    blurb: "",
    scale: "EF",
    tz: m.tz,
    T0: m.t0,
    source: "NWS Damage Assessment Toolkit (added automatically)",
    pathFidelity: "surveyed tracks from the NWS Damage Assessment Toolkit",
    torn: b.tornadoes.map((t) => ({
      name: t.name,
      ef: t.ef,
      start: t.start,
      end: t.end,
      coords: t.coords,
      lengthMi: t.lengthMi ?? 0,
      widthYd: t.widthYd ?? 0,
      inj: t.inj ?? 0,
      fat: t.fat ?? 0,
      state: "",
      geometry: "surveyed",
      timing: "surveyed",
      ...(t.comments ? { comments: t.comments } : {}),
      ...(t.wfo ? { wfo: t.wfo } : {}),
      ...(t.maxwind ? { maxwind: t.maxwind } : {}),
    })),
    polys: b.contours,
    dpts: b.damage,
    hail: b.hail,
    warns: b.warnings,
  };
}
