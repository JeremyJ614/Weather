/**
 * fetch() for Open-Meteo that never hands back a forecast that has run out (bug 171).
 * Open-Meteo refuses addresses past 10,000 calls a day, and Vercel's shared addresses get
 * there; when a cached copy can't be refreshed the framework keeps serving it, for days, with
 * every hour already past. This reads the cached answer, and if its newest hour (or `current`
 * reading, or day) is behind, fetches once more uncached. Anything not from Open-Meteo, or
 * not JSON, passes straight through. Same call shape as fetch.
 */
type Series = { time?: string[] };
type Answer = {
  utc_offset_seconds?: number;
  hourly?: Series;
  minutely_15?: Series;
  daily?: Series;
  current?: { time?: string };
};

/** The answer's newest moment, in ms (UTC), or null when it carries no times. */
function newest(a: Answer): number | null {
  const off = (a.utc_offset_seconds ?? 0) * 1000;
  const at = (t?: string) => {
    if (!t) return null;
    const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
    return Number.isFinite(ms)
      ? ms - (/[zZ]|[+-]\d\d:?\d\d$/.test(t) ? 0 : off)
      : null;
  };
  const list = [
    at(a.hourly?.time?.at(-1)),
    at(a.minutely_15?.time?.at(-1)),
    // A day counts through its end.
    a.daily?.time?.length
      ? (at(
          a.daily.time.at(-1)! +
            (a.daily.time.at(-1)!.length === 10 ? "T23:59" : ""),
        ) ?? null)
      : null,
    at(a.current?.time),
  ].filter((x): x is number => x != null);
  return list.length ? Math.max(...list) : null;
}

/** Whether an Open-Meteo answer (one point or many) still reaches the present. */
export function current(body: unknown, now = Date.now()): boolean {
  const all = (Array.isArray(body) ? body : [body]) as Answer[];
  return all.every((a) => {
    if (!a || typeof a !== "object") return true;
    const n = newest(a);
    // `current` readings are at most a few hours old; series must reach at least an hour ago.
    return n == null || n >= now - (a.current && !a.hourly ? 3 : 1) * 3600_000;
  });
}

export async function meteoFetch(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } } = {},
): Promise<Response> {
  const r = await fetch(url, init);
  if (!r.ok || !/open-meteo\.com/.test(url) || init.cache === "no-store")
    return r;
  const text = await r.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(text, { status: r.status, headers: r.headers });
  }
  if (current(body))
    return new Response(text, { status: r.status, headers: r.headers });
  const { next: _next, ...rest } = init;
  void _next;
  const again = await fetch(url, {
    ...rest,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!again.ok)
    throw new Error(`Open-Meteo ${again.status} (cached copy is out of date)`);
  return again;
}
