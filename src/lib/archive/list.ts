import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  ArchiveEvent,
  ArchiveIndexEntry,
} from "@/features/replay/archive/types";

export type AutoEntry = {
  id: string;
  day: string;
  name: string;
  region: string;
  count: number;
  strongest: string;
  fatalities: number;
};

const dir = () => join(process.cwd(), "public", "archive");

/** The famous events (built once from SPC + DAT, in public/archive) and the automatic days. */
export async function archiveCatalog(): Promise<{
  famous: ArchiveIndexEntry[];
  auto: AutoEntry[];
}> {
  const famous = JSON.parse(
    await readFile(join(dir(), "index.json"), "utf8"),
  ) as ArchiveIndexEntry[];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { famous, auto: [] };
  const r = await fetch(
    `${url}/rest/v1/archive_auto?select=id,day,name,region,count,strongest,fatalities,west,south,east,north&order=t0.desc&limit=5000`,
    { headers: { apikey: key }, next: { revalidate: 1800 } },
  ).catch(() => null);
  const rows = (r?.ok ? await r.json() : []) as (AutoEntry & {
    west: number;
    south: number;
    east: number;
    north: number;
  })[];
  // A famous event already covers its day's storm: drop the automatic copy of it.
  const boxes = await Promise.all(
    famous
      .filter((f) => rows.some((a) => a.day === f.id.slice(0, 10)))
      .map(async (f) => {
        const e = JSON.parse(
          await readFile(join(dir(), `${f.id}.json`), "utf8"),
        ) as ArchiveEvent;
        const pts = e.torn.flatMap((t) => t.coords);
        return {
          day: f.id.slice(0, 10),
          w: Math.min(...pts.map((p) => p[0])),
          e: Math.max(...pts.map((p) => p[0])),
          s: Math.min(...pts.map((p) => p[1])),
          n: Math.max(...pts.map((p) => p[1])),
        };
      }),
  );
  const auto = rows
    .filter(
      (a) =>
        !boxes.some(
          (b) =>
            b.day === a.day &&
            a.west <= b.e &&
            a.east >= b.w &&
            a.south <= b.n &&
            a.north >= b.s,
        ),
    )
    .map(({ id, day, name, region, count, strongest, fatalities }) => ({
      id,
      day,
      name,
      region,
      count,
      strongest,
      fatalities,
    }));
  return { famous, auto };
}
