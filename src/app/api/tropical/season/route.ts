import { gunzipSync } from "node:zlib";
import {
  deckIds,
  FIRST_SEASON,
  seasonTotals,
  summariseStorm,
} from "@/lib/tropical/season";

const ATCF = "https://ftp.nhc.noaa.gov/atcf";

/**
 * GET /api/tropical/season?year=2025&basin=al → that season's numbered systems from NHC's
 * best tracks, with totals. This season's files are re-read every 3 hours; past seasons
 * are final and kept for 30 days.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const year = Number(q.get("year"));
  const basin = String(q.get("basin") ?? "").toLowerCase();
  const now = new Date().getUTCFullYear();
  if (
    !Number.isInteger(year) ||
    year < FIRST_SEASON ||
    year > now ||
    !/^(al|ep|cp)$/.test(basin)
  )
    return Response.json({ error: "Pick a season." }, { status: 400 });
  const current = year === now;
  const dir = current ? `${ATCF}/btk/` : `${ATCF}/archive/${year}/`;
  const revalidate = current ? 3 * 3600 : 30 * 86400;
  try {
    const list = await fetch(dir, { next: { revalidate } });
    if (!list.ok) throw new Error(String(list.status));
    const ids = deckIds(await list.text(), basin, year);
    const storms = (
      await Promise.all(
        ids.map(async (id) => {
          const r = await fetch(`${dir}b${id}.dat${current ? "" : ".gz"}`, {
            next: { revalidate },
          }).catch(() => null);
          if (!r?.ok) return null;
          const text = current
            ? await r.text()
            : gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8");
          return summariseStorm(id, text);
        }),
      )
    ).filter((s) => s !== null);
    return Response.json(
      { year, basin, storms, totals: seasonTotals(storms) },
      {
        headers: {
          "Cache-Control": current
            ? "public, s-maxage=10800, stale-while-revalidate=21600"
            : "public, s-maxage=2592000",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "NHC's best-track archive isn't answering right now." },
      { status: 502 },
    );
  }
}
