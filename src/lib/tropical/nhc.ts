import "server-only";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { pick, type Colors } from "@/lib/colors/pick";
import {
  CONE,
  INTENSITY,
  RISK,
  WATCH,
  classLabel,
  mph,
  tierOf,
  type BasinId,
} from "./style";

/**
 * Live NHC data for Tropical Outlook: active storms (CurrentStorms.json), each storm's cone,
 * track, forecast points, past track and coastal watches/warnings (NHC's map service, by the
 * storm's bin), the seven-day outlook areas, and the text outlooks (NWS API).
 */
const MS =
  "https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer";
const UA = { "User-Agent": "StormSync Weather (weather.sswx.space)" };
const TTL = 600;
// Each storm bin is a block of 26 layers; the first bin of each basin starts here.
const BIN0: Record<string, number> = { AT: 4, EP: 134, CP: 264 };
const OFF = {
  points: 2,
  track: 3,
  cone: 4,
  warnings: 5,
  pastPoints: 7,
  pastTrack: 8,
};

type FC = FeatureCollection<Geometry, Record<string, unknown>>;
const EMPTY: FC = { type: "FeatureCollection", features: [] };

export type ForecastPoint = {
  lat: number;
  lon: number;
  tau: number;
  kt: number;
  mph: number;
  gustMph: number | null;
  label: string;
  when: string;
  type: string;
};
export type Storm = {
  id: string;
  basin: BasinId;
  name: string;
  title: string;
  kt: number;
  mph: number;
  tier: string;
  color: string;
  pressure: number | null;
  lat: number;
  lon: number;
  dir: number | null;
  speedMph: number | null;
  updated: string;
  advisory: string | null;
  links: {
    advisory?: string;
    discussion?: string;
    graphics?: string;
    forecast?: string;
    windProbs?: string;
  };
  points: ForecastPoint[];
  warnings: string[];
};
export type Area = {
  basin: string;
  two: number | null;
  seven: number | null;
  risk: string;
};
export type Outlook = {
  storms: Storm[];
  areas: Area[];
  /** Map layers, already colored. */
  geo: {
    cones: FC;
    tracks: FC;
    points: FC;
    past: FC;
    warnings: FC;
    areas: FC;
    spots: FC;
    motion: FC;
  };
  text: TwoText[];
  updated: string;
};
export type TwoText = {
  basin: BasinId;
  issued: string | null;
  intro: string;
  items: {
    title: string;
    body: string;
    two: number | null;
    seven: number | null;
  }[];
};

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: UA, next: { revalidate: TTL } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}
const layer = async (id: number): Promise<FC> =>
  (await json<FC>(
    `${MS}/${id}/query?where=1%3D1&outFields=*&returnGeometry=true&geometryPrecision=3&f=geojson`,
  )) ?? EMPTY;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type RawStorm = {
  id: string;
  binNumber?: string;
  name: string;
  classification: string;
  intensity: string;
  pressure: string;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir?: number;
  movementSpeed?: number;
  lastUpdate: string;
  publicAdvisory?: { advNum?: string; url?: string };
  forecastAdvisory?: { url?: string };
  forecastDiscussion?: { url?: string };
  forecastGraphics?: { url?: string };
  windSpeedProbabilities?: { url?: string };
};

/** The layer ids for a storm bin such as "EP1". */
export function binLayers(bin: string) {
  const m = /^(AT|EP|CP)([1-5])$/.exec(bin);
  if (!m) return null;
  const g = BIN0[m[1]] + (Number(m[2]) - 1) * 26;
  return Object.fromEntries(
    Object.entries(OFF).map(([k, o]) => [k, g + o]),
  ) as Record<keyof typeof OFF, number>;
}

/** Chances like "near 0 percent", "10 percent" → number. */
export function parseChance(s: string): number | null {
  const m = /(\d{1,3})\s*percent/i.exec(s);
  return m ? Number(m[1]) : null;
}

/** Splits an NHC Tropical Weather Outlook into its intro and numbered systems. */
export function parseTwo(text: string): Omit<TwoText, "basin" | "issued"> {
  // Chance lines ("* Formation chance through 48 hours...") get their own paragraph.
  const paras = text
    .replace(/\r/g, "")
    .replace(/\n(?=\*\s*Formation chance)/gi, "\n\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  // The product starts after its issue time ("500 PM PDT Tue Oct 13 2026").
  const start = paras.findIndex((p) =>
    /\b(AM|PM) [A-Z]{3} \w{3} \w{3} \d{1,2} \d{4}$/.test(p),
  );
  const items: TwoText["items"] = [];
  const intro: string[] = [];
  for (const p of paras.slice(start + 1)) {
    if (/^(&&|\$\$|Forecaster)/.test(p)) break;
    const head = /^\d\.\s+([^:]{2,100}):\s*(.*)$/.exec(p);
    const last = items.at(-1);
    if (head)
      items.push({
        title: head[1].trim(),
        body: head[2].trim(),
        two: null,
        seven: null,
      });
    else if (last && /^\*\s*Formation chance/i.test(p)) {
      if (/48 hours/i.test(p)) last.two = parseChance(p);
      else if (/7 days/i.test(p)) last.seven = parseChance(p);
    } else if (last) last.body = `${last.body} ${p}`.trim();
    else intro.push(p);
  }
  return { intro: intro.join("\n\n"), items };
}

async function twoText(basin: BasinId): Promise<TwoText> {
  const loc = basin === "AL" ? "AT" : basin;
  const list = await json<{
    "@graph"?: { "@id": string; issuanceTime: string }[];
  }>(`https://api.weather.gov/products/types/TWO/locations/${loc}`);
  const latest = list?.["@graph"]?.[0];
  const p = latest ? await json<{ productText?: string }>(latest["@id"]) : null;
  return {
    basin,
    issued: latest?.issuanceTime ?? null,
    ...(p?.productText ? parseTwo(p.productText) : { intro: "", items: [] }),
  };
}

const color = (colors: Colors, kt: number) => {
  const t = tierOf(kt);
  return pick(colors, `trop:${t.key}`, t.color);
};
const paint = (
  fc: FC,
  f: (p: Record<string, unknown>) => Record<string, unknown>,
): FC => ({
  type: "FeatureCollection",
  features: fc.features.map((x) => ({
    ...x,
    properties: { ...x.properties, ...f(x.properties ?? {}) },
  })),
});
const join = (list: FC[]): FC => ({
  type: "FeatureCollection",
  features: list.flatMap((l) => l.features),
});

export async function getOutlook(colors: Colors = {}): Promise<Outlook> {
  const [raw, areas, spots, motion, ...text] = await Promise.all([
    json<{ activeStorms?: RawStorm[] }>(
      "https://www.nhc.noaa.gov/CurrentStorms.json",
    ),
    layer(3),
    layer(2),
    layer(398),
    twoText("AL"),
    twoText("EP"),
    twoText("CP"),
  ]);
  const active = (raw?.activeStorms ?? []).filter((s) =>
    /^(al|ep|cp)/i.test(s.id),
  );
  const perStorm = await Promise.all(
    active.map(async (s) => {
      const ids = s.binNumber ? binLayers(s.binNumber) : null;
      if (!ids) return null;
      const [points, track, cone, warnings, pastPoints, pastTrack] =
        await Promise.all([
          layer(ids.points),
          layer(ids.track),
          layer(ids.cone),
          layer(ids.warnings),
          layer(ids.pastPoints),
          layer(ids.pastTrack),
        ]);
      return { points, track, cone, warnings, pastPoints, pastTrack };
    }),
  );

  const storms: Storm[] = active.map((s, i) => {
    const kt = num(s.intensity) ?? 0;
    const g = perStorm[i];
    const pts = (g?.points.features ?? [])
      .map((f) => {
        const p = f.properties ?? {};
        const k = num(p.maxwind) ?? 0;
        return {
          lat: num(p.lat) ?? 0,
          lon: num(p.lon) ?? 0,
          tau: num(p.tau) ?? 0,
          kt: k,
          mph: mph(k),
          gustMph: num(p.gust) ? mph(num(p.gust)!) : null,
          label: tierOf(k).short,
          when: `${p.datelbl ?? ""}${p.timezone ? ` ${p.timezone}` : ""}`.trim(),
          type: String(p.stormtype ?? ""),
        };
      })
      .sort((a, b) => a.tau - b.tau);
    return {
      id: s.id,
      basin: s.id.slice(0, 2).toUpperCase() as BasinId,
      name: s.name,
      title: `${classLabel(s.classification, kt)} ${s.name}`,
      kt,
      mph: mph(kt),
      tier: tierOf(kt).short,
      color: color(colors, kt),
      pressure: num(s.pressure),
      lat: s.latitudeNumeric,
      lon: s.longitudeNumeric,
      dir: s.movementDir ?? null,
      // CurrentStorms.json gives movement speed in mph already (VIP verified against advisories).
      speedMph: s.movementSpeed != null ? Math.round(s.movementSpeed) : null,
      updated: s.lastUpdate,
      advisory: s.publicAdvisory?.advNum ?? null,
      links: {
        advisory: s.publicAdvisory?.url,
        discussion: s.forecastDiscussion?.url,
        graphics: s.forecastGraphics?.url,
        forecast: s.forecastAdvisory?.url,
        windProbs: s.windSpeedProbabilities?.url,
      },
      points: pts,
      warnings: [
        ...new Set(
          (g?.warnings.features ?? [])
            .map((f) => WATCH[String(f.properties?.tcww)]?.label)
            .filter(Boolean),
        ),
      ] as string[],
    };
  });

  const riskColor = (r: unknown) => {
    const k = String(r ?? "").toLowerCase();
    return pick(
      colors,
      `trop:risk:${k in RISK ? k : "low"}`,
      RISK[k] ?? RISK.low,
    );
  };
  const ok = perStorm.filter((g): g is NonNullable<typeof g> => !!g);
  return {
    storms,
    areas: spots.features.map((f) => {
      const p = f.properties ?? {};
      return {
        basin: String(p.basin ?? ""),
        two: num(p.prob2day),
        seven: num(p.prob7day),
        risk: String(p.risk7day ?? "low").toLowerCase(),
      };
    }),
    geo: {
      cones: paint(join(ok.map((g) => g.cone)), () => ({
        color: pick(colors, "trop:cone", CONE),
      })),
      tracks: join(ok.map((g) => g.track)),
      points: paint(join(ok.map((g) => g.points)), (p) => ({
        color: color(colors, num(p.maxwind) ?? 0),
        label: tierOf(num(p.maxwind) ?? 0).short,
      })),
      past: paint(
        join(ok.flatMap((g) => [g.pastTrack, g.pastPoints])),
        (p) => ({
          color: color(colors, num(p.intensity) ?? 0),
        }),
      ),
      warnings: paint(join(ok.map((g) => g.warnings)), (p) => {
        const w = WATCH[String(p.tcww)];
        return {
          color: w
            ? pick(colors, `trop:ww:${String(p.tcww)}`, w.color)
            : "#888888",
        };
      }),
      areas: paint(areas, (p) => ({ color: riskColor(p.risk7day) })),
      spots: paint(spots, (p) => ({ color: riskColor(p.risk7day) })),
      motion: paint(motion, (p) => ({ color: riskColor(p.risk7day) })),
    },
    text,
    updated: new Date().toISOString(),
  };
}

export const STORM_KEYS = INTENSITY.map((t) => t.key);
export type { Feature };
