import "server-only";
import { inside } from "@/lib/colors/spc-server";
import type { Geometry } from "@/lib/map/geo";
import { isMarine } from "@/lib/warnings/style";
import type { CamKind } from "./style";

/**
 * Every free, keyless public camera feed with still images: Caltrans (all 12 districts),
 * NYC DOT, Iowa DOT (traffic and road-weather RWIS cams), INDOT/KYTC TrafficWise, and
 * ALERTCalifornia's wildfire cameras. The merged list is kept for 6 hours per server.
 */
export type Cam = {
  id: string;
  src: string;
  kind: CamKind;
  name: string;
  area: string;
  lat: number;
  lon: number;
  img: string;
  video?: string;
};

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const get = async <T>(url: string): Promise<T> => {
  const r = await fetch(url, {
    headers: UA,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return (await r.json()) as T;
};
const ok = (lat: number, lon: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  lat > 15 &&
  lat < 72 &&
  lon < -60;

/** Hosts whose images are http only, served through /api/cams/img. */
export const HTTP_HOSTS = ["pws.trafficwise.org"];
const viaProxy = (u: string) =>
  u.startsWith("http://") ? `/api/cams/img?u=${encodeURIComponent(u)}` : u;

type CaltransRow = {
  cctv: {
    index: string;
    inService: string;
    location: {
      district: string;
      locationName: string;
      nearbyPlace: string;
      latitude: string;
      longitude: string;
      route: string;
    };
    imageData: {
      streamingVideoURL?: string;
      static?: { currentImageURL?: string };
    };
  };
};

async function caltrans(): Promise<Cam[]> {
  const districts = await Promise.all(
    Array.from({ length: 12 }, (_, i) => i + 1).map((d) =>
      get<{ data: CaltransRow[] }>(
        `https://cwwp2.dot.ca.gov/data/d${d}/cctv/cctvStatusD${String(d).padStart(2, "0")}.json`,
      ).catch(() => ({ data: [] })),
    ),
  );
  return districts.flatMap((x) =>
    x.data
      .filter(({ cctv: c }) => c.inService === "true")
      .map(({ cctv: c }) => ({
        id: `ca${c.location.district}-${c.index}`,
        src: "caltrans",
        kind: "traffic" as const,
        name: c.location.locationName,
        area: `${c.location.nearbyPlace}, CA`,
        lat: Number(c.location.latitude),
        lon: Number(c.location.longitude),
        img: c.imageData.static?.currentImageURL ?? "",
        video: c.imageData.streamingVideoURL || undefined,
      }))
      .filter((c) => c.img.startsWith("https://") && ok(c.lat, c.lon)),
  );
}

async function nyc(): Promise<Cam[]> {
  const list = await get<
    {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      area: string;
      isOnline: string;
      imageUrl: string;
    }[]
  >("https://webcams.nyctmc.org/api/cameras");
  return list
    .filter((c) => c.isOnline === "true" && ok(c.latitude, c.longitude))
    .map((c) => ({
      id: `ny-${c.id}`,
      src: "nyc",
      kind: "traffic" as const,
      name: c.name,
      area: `${c.area}, NY`,
      lat: c.latitude,
      lon: c.longitude,
      img: c.imageUrl,
    }));
}

async function iowa(): Promise<Cam[]> {
  const j = await get<{
    features: { attributes: Record<string, string | number | null> }[];
  }>(
    "https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Traffic_Cameras_View/FeatureServer/0/query?where=1%3D1&outFields=COMMON_ID,Desc_,ImageURL,latitude,longitude,Type,Route&returnGeometry=false&resultRecordCount=3000&f=json",
  );
  return j.features
    .map(({ attributes: a }) => ({
      id: `ia-${a.COMMON_ID}`,
      src: "iadot",
      kind: (a.Type === "RWIS" ? "weather" : "traffic") as CamKind,
      name: String(a.Desc_ ?? "")
        .replace(/^RWIS - /, "")
        .replace(/ \(mini\)$/, ""),
      area: `${a.Route ?? ""}, IA`.replace(/^, /, ""),
      lat: Number(a.latitude),
      lon: Number(a.longitude),
      img: String(a.ImageURL ?? ""),
    }))
    .filter((c) => c.img.startsWith("https://") && ok(c.lat, c.lon));
}

async function trafficwise(): Promise<Cam[]> {
  const j = await get<{
    features: { attributes: Record<string, string | number | null> }[];
  }>(
    "https://services2.arcgis.com/CcI36Pduqd0OR4W9/ArcGIS/rest/services/trafficCamerasCur_Prd/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID,description,snapshot,latitude,longitude&returnGeometry=false&f=json",
  );
  return j.features
    .map(({ attributes: a }) => {
      const d = String(a.description ?? "");
      return {
        id: `tw-${a.OBJECTID}`,
        src: "trafficwise",
        kind: "traffic" as const,
        name: d.replace(/ (Indiana|Kentucky)$/, ""),
        area: / Indiana$/.test(d) ? "IN" : "KY",
        lat: Number(a.latitude),
        lon: Number(a.longitude),
        img: viaProxy(String(a.snapshot ?? "")),
      };
    })
    .filter((c) => c.img && ok(c.lat, c.lon));
}

async function alertca(): Promise<Cam[]> {
  const j = await get<{
    features: {
      geometry: { coordinates: (number | null)[] };
      properties: {
        id: string;
        name: string;
        county?: string;
        state?: string;
        last_frame_ts?: number;
      };
    }[];
  }>(
    "https://cameras.alertcalifornia.org/public-camera-data/all_cameras-v3.json",
  );
  const fresh = Date.now() / 1000 - 6 * 3600;
  return j.features
    .filter(
      (f) =>
        f.geometry.coordinates[0] != null &&
        (f.properties.last_frame_ts ?? 0) > fresh,
    )
    .map((f) => ({
      id: `fire-${f.properties.id}`,
      src: "alertca",
      kind: "fire" as const,
      name: f.properties.name || f.properties.id,
      area: [
        f.properties.county?.replace(/\b\w/g, (m) => m.toUpperCase()),
        f.properties.state,
      ]
        .filter(Boolean)
        .join(", "),
      lat: Number(f.geometry.coordinates[1]),
      lon: Number(f.geometry.coordinates[0]),
      img: `https://cameras.alertcalifornia.org/public-camera-data/${encodeURIComponent(f.properties.id)}/latest-frame.jpg`,
    }))
    .filter((c) => ok(c.lat, c.lon));
}

let memo: { at: number; p: Promise<{ cams: Cam[]; down: string[] }> } | null =
  null;

/** Every camera, plus the sources that failed this round. */
export function allCams() {
  if (memo && Date.now() - memo.at < 6 * 3600_000) return memo.p;
  const feeds: [string, () => Promise<Cam[]>][] = [
    ["caltrans", caltrans],
    ["nyc", nyc],
    ["iadot", iowa],
    ["trafficwise", trafficwise],
    ["alertca", alertca],
  ];
  const p = Promise.all(
    feeds.map(([k, f]) =>
      f().then(
        (cams) => ({ k, cams }),
        () => ({ k, cams: null as Cam[] | null }),
      ),
    ),
  ).then((r) => {
    const out = {
      cams: r.flatMap((x) => x.cams ?? []),
      down: r.filter((x) => !x.cams).map((x) => x.k),
    };
    // A round with failures is kept only 10 minutes so the missing feed is retried soon.
    if (out.down.length && memo) memo.at = Date.now() - 6 * 3600_000 + 600_000;
    return out;
  });
  memo = { at: Date.now(), p };
  return p;
}

export const milesTo = (
  lat: number,
  lon: number,
  c: { lat: number; lon: number },
) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((c.lat - lat) * r) / 2) ** 2 +
    Math.cos(lat * r) *
      Math.cos(c.lat * r) *
      Math.sin(((c.lon - lon) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
};

const WWA =
  "https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/1/query";

type Area = { ev: string; g: Geometry; box: [number, number, number, number] };

function bbox(g: Geometry): [number, number, number, number] {
  const b: [number, number, number, number] = [180, 90, -180, -90];
  const walk = (x: unknown): void => {
    if (Array.isArray(x) && typeof x[0] === "number") {
      b[0] = Math.min(b[0], x[0]);
      b[1] = Math.min(b[1], x[1] as number);
      b[2] = Math.max(b[2], x[0]);
      b[3] = Math.max(b[3], x[1] as number);
    } else if (Array.isArray(x)) x.forEach(walk);
  };
  walk((g as { coordinates?: unknown }).coordinates);
  return b;
}

let hazMemo: {
  at: number;
  p: Promise<{ event: string; cams: Cam[] }[]>;
} | null = null;

/** Cameras inside active NWS warnings, grouped by warning type, most cameras first. */
export function camsInWarnings() {
  if (hazMemo && Date.now() - hazMemo.at < 120_000) return hazMemo.p;
  const p = (async () => {
    const where = encodeURIComponent(
      "prod_type LIKE '%Warning' OR prod_type LIKE '%Emergency'",
    );
    const [{ cams }, r] = await Promise.all([
      allCams(),
      fetch(
        `${WWA}?where=${where}&outFields=prod_type&returnGeometry=true&maxAllowableOffset=0.02&geometryPrecision=3&outSR=4326&f=geojson`,
        { headers: UA, cache: "no-store", signal: AbortSignal.timeout(20000) },
      ),
    ]);
    if (!r.ok) throw new Error(`warnings ${r.status}`);
    const j = (await r.json()) as {
      features?: {
        properties: { prod_type?: string };
        geometry: Geometry | null;
      }[];
    };
    const areas: Area[] = (j.features ?? [])
      .filter(
        (f) =>
          f.geometry &&
          f.properties.prod_type &&
          !isMarine(f.properties.prod_type),
      )
      .map((f) => ({
        ev: String(f.properties.prod_type),
        g: f.geometry!,
        box: bbox(f.geometry!),
      }));
    const groups = new Map<string, Cam[]>();
    for (const c of cams) {
      const hit = areas.find(
        (a) =>
          c.lon >= a.box[0] &&
          c.lon <= a.box[2] &&
          c.lat >= a.box[1] &&
          c.lat <= a.box[3] &&
          inside(a.g, c.lon, c.lat),
      );
      if (hit) groups.set(hit.ev, [...(groups.get(hit.ev) ?? []), c]);
    }
    return [...groups.entries()]
      .map(([event, list]) => ({
        event,
        // Fire weather: the wildfire cameras first.
        cams: /Red Flag|Fire/.test(event)
          ? [...list].sort(
              (a, b) => Number(b.kind === "fire") - Number(a.kind === "fire"),
            )
          : list,
      }))
      .sort((a, b) => b.cams.length - a.cams.length);
  })();
  p.catch(() => (hazMemo = null));
  hazMemo = { at: Date.now(), p };
  return p;
}
