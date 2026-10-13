import "server-only";
import { geoPath, serviceLayer } from "@/lib/map/geo";
import { pick } from "@/lib/colors/pick";
import { getColors } from "@/lib/colors/server";
import { activeAlerts } from "@/lib/nws/active";
import { classify, type Report } from "./reports";
import { colorOf, isMarine, rankOf, statesOf, tags } from "./style";

const SEV: Record<string, number> = {
  Extreme: 0,
  Severe: 1,
  Moderate: 2,
  Minor: 3,
};

/** Every active land alert, most dangerous first, with its map polygon if storm-based. */
export async function warningsList() {
  const [feats, colors] = await Promise.all([activeAlerts(), getColors()]);
  const items = feats
    .filter((f) => !isMarine(f.properties.event))
    .map((f) => {
      const p = f.properties;
      const one = (k: string) => p.parameters?.[k]?.[0];
      return {
        id: p.id,
        event: p.event,
        headline: (p.headline ?? "").slice(0, 240),
        area: (p.areaDesc ?? "").slice(0, 400),
        states: statesOf(p.geocode?.UGC),
        severity: p.severity ?? "Unknown",
        sent: p.sent ?? "",
        expires: p.ends ?? p.expires ?? "",
        sender: (p.senderName ?? "").replace(/^NWS /, ""),
        color: pick(colors, `warn:${p.event}`, colorOf(p.event)),
        rank: rankOf(p.event),
        tags: tags({
          tornadoDamageThreat: one("tornadoDamageThreat"),
          tornadoDetection: one("tornadoDetection"),
          thunderstormDamageThreat: one("thunderstormDamageThreat"),
          flashFloodDamageThreat: one("flashFloodDamageThreat"),
          maxHailSize: one("maxHailSize"),
          maxWindGust: one("maxWindGust"),
        }),
        pds: /PARTICULARLY DANGEROUS SITUATION/i.test(p.description ?? ""),
        d: f.geometry ? geoPath(f.geometry, 0.8) : "",
      };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (SEV[a.severity] ?? 4) - (SEV[b.severity] ?? 4) ||
        b.sent.localeCompare(a.sent),
    );
  return { at: new Date().toISOString(), items };
}
export type Warning = Awaited<ReturnType<typeof warningsList>>["items"][number];

/** The full text of one alert, loaded when a card is opened. */
export async function warningText(id: string) {
  const r = await fetch(`https://api.weather.gov/alerts/${id}`, {
    headers: {
      "User-Agent": "StormSync Weather (https://weather.sswx.space)",
      Accept: "application/geo+json",
    },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`NWS alert ${r.status}`);
  const p = (await r.json()).properties as {
    description?: string;
    instruction?: string;
  };
  return {
    description: (p.description ?? "").slice(0, 6000),
    instruction: (p.instruction ?? "").slice(0, 2000),
  };
}

const stamp = (d: Date) => d.toISOString().slice(0, 16).replace(/[-:T]/g, "");

/** IEM Local Storm Reports for the last `hours`, newest first. */
export async function stormReports(hours: number): Promise<Report[]> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3_600_000);
  const r = await fetch(
    `https://mesonet.agron.iastate.edu/geojson/lsr.php?sts=${stamp(start)}&ets=${stamp(end)}&fmt=geojson`,
    { next: { revalidate: 300 }, signal: AbortSignal.timeout(15000) },
  );
  if (!r.ok) throw new Error(`IEM ${r.status}`);
  type Raw = {
    typetext?: string;
    magnitude?: string | number | null;
    unit?: string;
    city?: string;
    county?: string;
    st?: string;
    state?: string;
    source?: string;
    remark?: string;
    valid?: string;
  };
  const d = (await r.json()) as {
    features?: {
      properties?: Raw;
      geometry?: { coordinates?: [number, number] };
    }[];
  };
  const out: Report[] = [];
  for (const f of d.features ?? []) {
    const p = f.properties ?? {};
    const type = (p.typetext ?? "").trim();
    const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
    if (!type || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const m =
      p.magnitude === null || p.magnitude === "" ? NaN : Number(p.magnitude);
    out.push({
      kind: classify(type),
      type,
      mag: Number.isFinite(m) ? m : null,
      unit: (p.unit ?? "").trim(),
      city: (p.city ?? "").trim(),
      county: (p.county ?? "").trim(),
      st: (p.st ?? p.state ?? "").trim(),
      lat,
      lon,
      valid: p.valid ?? "",
      remark: (p.remark ?? "").trim().slice(0, 400),
      source: (p.source ?? "").trim(),
    });
  }
  return out.sort((a, b) => b.valid.localeCompare(a.valid));
}

const WWA =
  "https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/1";

/** Every active land watch, warning and advisory area, projected; most dangerous drawn last. */
export async function warningMap() {
  const [feats, colors] = await Promise.all([
    serviceLayer<{ prod_type?: string }>(WWA, 120),
    getColors(),
  ]);
  const col = (ev: string) => pick(colors, `warn:${ev}`, colorOf(ev));
  const polys = feats
    .map((f) => {
      const ev = String(f.properties.prod_type ?? "");
      return { ev, r: rankOf(ev), c: col(ev), d: geoPath(f.geometry) };
    })
    .filter((p) => p.d && p.ev && !isMarine(p.ev))
    .sort((a, b) => b.r - a.r);
  const legend = [...new Set(polys.map((p) => p.ev))]
    .sort((a, b) => rankOf(a) - rankOf(b))
    .slice(0, 10)
    .map((label) => ({ label, color: col(label) }));
  return { polys: polys.map(({ c, d }) => ({ c, d })), legend };
}
