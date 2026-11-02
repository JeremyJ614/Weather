/**
 * Forecast Game scoring (ported from the VIP Storm Engine). A contest, not a
 * test: the field is ranked by how close each pin landed to the day's SPC
 * storm reports. This copy is authoritative; scoring never trusts the browser.
 */
export const GAME_TZ = "America/New_York";

/** ⚡ The five closest severe pins of the day, in order. */
export const SEVERE_PLACES = [1000, 950, 750, 500, 250];
/** ⚡ Everyone outside the placings, paid on distance alone (miles → points). */
export const SEVERE_CONSOLATION: [number, number][] = [
  [75, 175],
  [100, 125],
  [250, 100],
];
/** 🌪 The three closest tornado pins, at any distance. */
export const TORNADO_PLACES = [1000, 750, 500];
/** 🌪 Landing within 25 miles of a tornado beats winning the day. */
export const TORNADO_BULLSEYE = { within: 25, points: 1500 };
/** 🌪 A "no tornadoes" call on a day that verifies with none. */
export const QUIET_DAY_BONUS = 750;

export type Report = {
  lat: number;
  lon: number;
  kind: "torn" | "hail" | "wind";
};
export type PinSet = {
  lat: number;
  lon: number;
  tor: { lat: number; lon: number } | null;
};

export function haversineMi(
  aLat: number,
  aLon: number,
  bLat: number,
  bLon: number,
) {
  const r = Math.PI / 180;
  const s =
    Math.sin(((bLat - aLat) * r) / 2) ** 2 +
    Math.cos(aLat * r) *
      Math.cos(bLat * r) *
      Math.sin(((bLon - aLon) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(s));
}

export function nearestMi(lat: number, lon: number, pts: Report[]) {
  let best = Infinity;
  for (const p of pts)
    best = Math.min(best, haversineMi(lat, lon, p.lat, p.lon));
  return best;
}

/**
 * Competition ranking: null distances are out of the running; equal distances
 * (to a thousandth of a mile) share the best award left and use up its places.
 */
export function rankedAwards(dist: (number | null)[], places: number[]) {
  const out = dist.map(() => 0);
  const field = dist
    .map((d, index) => ({ index, d }))
    .filter(
      (e): e is { index: number; d: number } =>
        e.d !== null && Number.isFinite(e.d),
    )
    .sort((a, b) => a.d - b.d);
  let i = 0;
  while (i < field.length && i < places.length) {
    let j = i;
    while (j + 1 < field.length && Math.abs(field[j + 1].d - field[i].d) < 1e-3)
      j++;
    for (let k = i; k <= j; k++) out[field[k].index] = places[i];
    i = j + 1;
  }
  return out;
}

export function scoreSevere(pins: PinSet[], all: Report[]) {
  const dist = pins.map((p) =>
    all.length ? nearestMi(p.lat, p.lon, all) : null,
  );
  const placed = rankedAwards(dist, SEVERE_PLACES);
  return dist.map((d, i) => {
    if (placed[i] > 0) return placed[i];
    if (d === null) return 0;
    return SEVERE_CONSOLATION.find(([w]) => d <= w)?.[1] ?? 0;
  });
}

export function scoreTornado(pins: PinSet[], torn: Report[]) {
  const dist = pins.map((p) =>
    p.tor === null || !torn.length
      ? null
      : nearestMi(p.tor.lat, p.tor.lon, torn),
  );
  const placed = rankedAwards(dist, TORNADO_PLACES);
  return pins.map((p, i) => {
    if (p.tor === null) return torn.length ? 0 : QUIET_DAY_BONUS;
    if (!torn.length) return 0;
    const d = dist[i];
    const bull =
      d !== null && d <= TORNADO_BULLSEYE.within ? TORNADO_BULLSEYE.points : 0;
    return Math.max(placed[i], bull);
  });
}

/** Today's contest date (YYYY-MM-DD) on the Eastern clock. */
export function gameDate(at: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: GAME_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Yesterday on the game's (Eastern) clock. */
export function previousGameDate(at: Date = new Date()) {
  return gameDate(new Date(at.getTime() - 86_400_000));
}

/**
 * When a round can be scored: SPC's convective day for that date runs 12Z to 12Z, and its
 * report files settle within half an hour, so 12:30Z the next day (7:30 AM ET in winter,
 * 8:30 AM in summer).
 */
export function roundScoresAt(ymd: string): Date {
  const d = new Date(`${ymd}T12:30:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Seconds until the next round starts (midnight Eastern), when today's pins become final. */
export function secondsToReset(at: Date = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: GAME_TZ,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
  return 86_400 - (g("hour") * 3600 + g("minute") * 60 + g("second"));
}

/** Parses an SPC daily reports CSV into points. */
export function parseReports(csv: string, kind: Report["kind"]): Report[] {
  const lines = csv.trim().split(/\r?\n/);
  const header = (lines.shift() ?? "").split(",");
  const la = header.findIndex((h) => /lat/i.test(h));
  const lo = header.findIndex((h) => /lon/i.test(h));
  if (la < 0 || lo < 0) return [];
  const out: Report[] = [];
  for (const line of lines) {
    const c = line.split(",");
    const lat = parseFloat(c[la]);
    const lon = parseFloat(c[lo]);
    // SPC repeats the header mid-file for each section; those rows parse as NaN.
    if (Number.isFinite(lat) && Number.isFinite(lon))
      out.push({ lat, lon, kind });
  }
  return out;
}
