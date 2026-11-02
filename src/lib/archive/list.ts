import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ArchiveEvent,
  ArchiveIndexEntry,
} from "@/features/replay/archive/types";
import { STATES } from "@/lib/geo/search";
import { SPC_THROUGH, scaleOf, spcDays } from "./spc";

/** One row of the NWS Surveyed list. */
export type SurveyedEntry = {
  id: string;
  day: string;
  name: string;
  region: string;
  /** Two-letter state codes, for the State filter. */
  states: string[];
  count: number;
  strongest: string;
  fatalities: number;
  scale: "F" | "EF";
  /** Built on request from the NWS survey or SPC's database, not from a file in public/archive. */
  auto: boolean;
  blurb?: string;
};

type Box = { west: number; south: number; east: number; north: number };

const dir = () => join(process.cwd(), "public", "archive");

async function index(): Promise<ArchiveIndexEntry[]> {
  return JSON.parse(
    await readFile(join(dir(), "index.json"), "utf8"),
  ) as ArchiveIndexEntry[];
}

/** The Historic list: only the events the owner picked. */
export async function historicEvents(): Promise<ArchiveIndexEntry[]> {
  return (await index()).filter((e) => !e.surveyed);
}

// Longest names first, so "West Virginia" is read before "Virginia" (and "Arkansas" before "Kansas").
const NAMES = Object.entries(STATES).sort((a, b) => b[1].length - a[1].length);

/** State codes named in a region line such as "Oklahoma · Kansas" or "Iowa to Ohio". */
export function statesIn(region: string): string[] {
  let rest = ` ${region} `;
  const out: string[] = [];
  for (const [code, name] of NAMES) {
    const re = new RegExp(`(^|[^A-Za-z])${name}(?=$|[^A-Za-z])`);
    if (re.test(rest)) {
      out.push(code);
      rest = rest.replace(re, "$1 ");
    }
  }
  return out.sort();
}

const overlaps = (a: Box, b: Box) =>
  a.west <= b.east &&
  a.east >= b.west &&
  a.south <= b.north &&
  a.north >= b.south;

/** A static event's day and the box around its tracks. */
async function boxOf(
  e: ArchiveIndexEntry,
): Promise<(Box & { day: string }) | null> {
  try {
    const ev = JSON.parse(
      await readFile(join(dir(), `${e.id}.json`), "utf8"),
    ) as ArchiveEvent;
    const pts = ev.torn.flatMap((t) => t.coords);
    if (!pts.length) return null;
    return {
      day: e.id.slice(0, 10),
      west: Math.min(...pts.map((p) => p[0])),
      east: Math.max(...pts.map((p) => p[0])),
      south: Math.min(...pts.map((p) => p[1])),
      north: Math.max(...pts.map((p) => p[1])),
    };
  } catch {
    return null;
  }
}

/**
 * The NWS Surveyed list (owner, 2026-11-02): every tornado the NWS has surveyed since January
 * 2023 (the Damage Assessment Toolkit, refreshed every six hours), the violent and significant
 * tornadoes before that (SPC's database, lib/archive/spc.ts), and the major events the archive
 * holds as full files but the owner didn't pick for Historic. A day a file already covers
 * isn't listed twice.
 */
export async function surveyedCatalog(): Promise<SurveyedEntry[]> {
  const all = await index();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const r =
    url && key
      ? await fetch(
          `${url}/rest/v1/archive_auto?select=id,day,name,region,count,strongest,fatalities,west,south,east,north&day=gt.${SPC_THROUGH}&order=t0.desc&limit=8000`,
          { headers: { apikey: key }, next: { revalidate: 1800 } },
        ).catch(() => null)
      : null;
  type Row = Omit<SurveyedEntry, "states" | "scale" | "auto"> & Box;
  const live = (r?.ok ? await r.json() : []) as Row[];
  const old = spcDays();
  const days = new Set([...live, ...old].map((d) => d.day));
  const boxes = (
    await Promise.all(all.filter((f) => days.has(f.id.slice(0, 10))).map(boxOf))
  ).filter((b) => b !== null);
  const covered = (d: Row) =>
    boxes.some((b) => b.day === d.day && overlaps(d, b));
  const fromDay = (d: Row): SurveyedEntry => ({
    id: d.id,
    day: d.day,
    name: d.name,
    region: d.region,
    states: statesIn(d.region),
    count: d.count,
    strongest: d.strongest,
    fatalities: d.fatalities,
    scale: scaleOf(d.day),
    auto: true,
  });
  return [
    ...live.filter((d) => !covered(d)).map(fromDay),
    ...old.filter((d) => !covered(d)).map(fromDay),
    ...all
      .filter((e) => e.surveyed)
      .map((e) => ({
        id: e.id,
        day: e.id.slice(0, 10),
        name: e.name,
        region: e.region,
        states: statesIn(e.region),
        count: e.count,
        strongest: e.strongest,
        fatalities: e.fatalities,
        scale: e.scale,
        auto: false,
        blurb: e.blurb,
      })),
  ].sort((a, b) => b.day.localeCompare(a.day));
}
