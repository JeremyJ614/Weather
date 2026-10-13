import "server-only";
import { inside } from "@/lib/colors/spc-server";
import { geoPath, type Geometry } from "@/lib/map/geo";
import { project } from "@/lib/map/usAlbers";
import { parseMd, plainRead } from "./mdText";

const IEM = "https://mesonet.agron.iastate.edu/api/1";

type Feat = {
  geometry: Geometry;
  properties: {
    product_id: string;
    num: number;
    year: number;
    concerning: string | null;
    issue: string;
    expire: string;
    watch_confidence: number | null;
  };
};

async function feed(hours?: number): Promise<Feat[]> {
  const r = await fetch(
    `${IEM}/nws/spc_mcd.geojson${hours ? `?hours=${hours}` : ""}`,
    {
      next: { revalidate: hours ? 600 : 120 },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok) throw new Error(`IEM ${r.status}`);
  return ((await r.json()) as { features?: Feat[] }).features ?? [];
}

async function text(id: string) {
  try {
    const r = await fetch(`${IEM}/nwstext/${id}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(12000),
    });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

/** Where to print the MD number: the mean of its outer ring, projected. */
function labelAt(g: Geometry) {
  const ring =
    g.type === "Polygon"
      ? (g as { coordinates: number[][][] }).coordinates[0]
      : g.type === "MultiPolygon"
        ? (g as { coordinates: number[][][][] }).coordinates[0][0]
        : null;
  if (!ring?.length) return null;
  const lon = ring.reduce((a, c) => a + c[0], 0) / ring.length;
  const lat = ring.reduce((a, c) => a + c[1], 0) / ring.length;
  return project(lon, lat);
}

/** Active MDs (newest first); when none are active, the last 72 hours' marked expired. */
export async function mesoscale(lat?: number, lon?: number) {
  let feats = await feed();
  const active = feats.length > 0;
  if (!active) feats = (await feed(72)).slice(-12);
  const out = await Promise.all(
    feats.map(async (f) => {
      const p = f.properties;
      const raw = await text(p.product_id);
      const parts = parseMd(raw);
      // SPC writes it in capitals ("SEVERE POTENTIAL...WATCH UNLIKELY").
      const low = (p.concerning ?? "")
        .trim()
        .toLowerCase()
        .replace(/\.{2,}/g, " · ");
      const concerning = low.charAt(0).toUpperCase() + low.slice(1);
      return {
        id: p.product_id,
        num: p.num,
        year: p.year,
        concerning,
        issue: p.issue,
        expire: p.expire,
        ...parts,
        prob: parts.prob ?? p.watch_confidence,
        read: plainRead({ ...parts, concerning }),
        d: geoPath(f.geometry, 0.6),
        at: labelAt(f.geometry),
        here:
          lat !== undefined && lon !== undefined
            ? inside(f.geometry, lon, lat)
            : false,
        // The raw text is only needed when the parser found no summary.
        text: parts.summary ? "" : raw.slice(0, 6000),
      };
    }),
  );
  return { active, mds: out.sort((a, b) => b.issue.localeCompare(a.issue)) };
}
export type Md = Awaited<ReturnType<typeof mesoscale>>["mds"][number];
