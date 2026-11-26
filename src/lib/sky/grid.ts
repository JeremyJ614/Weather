import "server-only";
import {
  buildGrid,
  fresh,
  gridPoints,
  hourlies,
  skyUrl,
  type Hourly,
} from "./gridCore";

export { LATS, LONS, nights, scoreHours, type Hourly } from "./gridCore";

/**
 * Hourly sky inputs for one or many points (UTC hours), 3 days, cached `revalidate` seconds.
 * A cached copy that has run out is refused and fetched again uncached: when Open-Meteo
 * refuses a refresh (it rate-limits Vercel's shared addresses), the framework kept serving
 * the last good copy for days, with every hour already past (bug 171). If the fresh fetch
 * fails too, this throws and the page fetches from the viewer's own browser instead.
 */
export async function skyHourly(
  lats: number[],
  lons: number[],
  revalidate: number,
): Promise<Hourly[]> {
  const url = skyUrl(lats, lons);
  const get = async (init: RequestInit) => {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
    return hourlies(await r.json());
  };
  const first = await get({ next: { revalidate } }).catch(() => null);
  if (first?.length && first.every((h) => fresh(h))) return first;
  const again = await get({ cache: "no-store" });
  if (!again.length || !again.every((h) => fresh(h)))
    throw new Error("Open-Meteo sent an old forecast");
  return again;
}

export async function skyGrid(now = Date.now()) {
  const { lats, lons } = gridPoints();
  const grid = buildGrid(await skyHourly(lats, lons, 10800), now);
  if (!grid.t0) throw new Error("empty sky grid");
  return grid;
}
