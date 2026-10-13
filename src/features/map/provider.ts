/**
 * Which map library a new map uses. Mapbox (one key, 50,000 free map loads a month) until our own
 * monthly counter in Supabase says the budget is spent, then MapLibre with free OpenFreeMap tiles.
 * Anything uncertain (no token, counter unreachable) chooses MapLibre, so a map never costs money.
 */
export type MapProvider = "mapbox" | "maplibre";

export const MAPBOX_STYLE = "mapbox://styles/mapbox/dark-v11";
export const MAPLIBRE_STYLE = "https://tiles.openfreemap.org/styles/dark";

/** The public, URL-restricted Mapbox token, or null. A secret `sk.` token is refused. */
export function mapboxToken(
  raw: string | undefined = process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
): string | null {
  return raw && raw.startsWith("pk.") ? raw : null;
}

/**
 * Counts one Mapbox map load if this month's budget allows it. True means "create a Mapbox map";
 * false means "use MapLibre". Gives up after `timeoutMs` so a slow counter never delays a map.
 */
export async function claimMapbox(
  token: string | null,
  supabaseUrl: string | undefined,
  anonKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2500,
): Promise<boolean> {
  if (!token || !supabaseUrl || !anonKey) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/count_map_load`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: ctl.signal,
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
