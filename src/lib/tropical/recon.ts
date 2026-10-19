import "server-only";

/**
 * Hurricane Hunter reconnaissance (ported from VIP). Rows come from Vortex Data Messages,
 * the centre-fix report whose field D is the true minimum sea-level pressure, merged with
 * live High-Density Observations, which show a mission is still airborne. HDOB's sixth
 * field is a height departure above 550 mb, never read as a pressure.
 */
export type Mission = {
  key: string;
  aircraft: string;
  storm: string;
  stormId: string | null;
  fix: string | null;
  lastOb: string | null;
  lat: number | null;
  lon: number | null;
  mslp: number | null;
  flKt: number | null;
  sfcKt: number | null;
  ob: string | null;
  active: boolean;
};

const UA = { "User-Agent": "StormSync Weather (https://weather.sswx.space)" };
const get = (url: string) =>
  fetch(url, {
    headers: UA,
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(15000),
  });
const int = (s: string | undefined) => {
  const n = parseInt(s ?? "", 10);
  return Number.isFinite(n) ? n : null;
};

export function parseVdm(text: string): Mission | null {
  const stormId =
    text.match(/VORTEX DATA MESSAGE\s+([A-Z]{2}\d{6})/i)?.[1] ?? null;
  const field = (l: string) =>
    text.match(new RegExp(`^\\s*${l}\\.\\s*(.+?)\\s*$`, "mi"))?.[1] ?? null;
  const u = field("U");
  if (!u || /TEST|TRAIN|WXWXA/i.test(u)) return null;
  if (stormId?.slice(2, 4) === "99") return null;
  const m = u.match(/^(\S+)\s+(\S+)\s+(.+?)(?:\s+OB\s+(\d+))?\s*$/i);
  if (!m) return null;
  const [, aircraft, num, rawName, ob] = m;
  const at = field("A")?.match(/(\d{2})\/(\d{2}):(\d{2}):(\d{2})Z/);
  let fix: string | null = null;
  if (at) {
    const now = new Date();
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        +at[1],
        +at[2],
        +at[3],
        +at[4],
      ),
    );
    if (d.getTime() - now.getTime() > 3 * 86400e3)
      d.setUTCMonth(d.getUTCMonth() - 1);
    fix = d.toISOString();
  }
  const b = field("B")?.match(
    /([\d.]+)\s*deg\s*([NS])\s+([\d.]+)\s*deg\s*([EW])/i,
  );
  const remarkFl = int(text.match(/MAX\s+FL\s+WIND\s+(\d+)\s*KT/i)?.[1]);
  const legs = ["J", "N"]
    .map((l) => int(field(l)?.match(/(\d+)\s*kt/i)?.[1]))
    .filter((n): n is number => n != null);
  const age = fix ? (Date.now() - Date.parse(fix)) / 60000 : Infinity;
  return {
    key: `${aircraft}-${num}-${rawName.trim()}`.toUpperCase(),
    aircraft,
    storm: rawName.trim(),
    stormId,
    fix,
    lastOb: null,
    lat: b ? (b[2].toUpperCase() === "S" ? -1 : 1) * parseFloat(b[1]) : null,
    lon: b ? (b[4].toUpperCase() === "W" ? -1 : 1) * parseFloat(b[3]) : null,
    mslp: int(field("D")?.match(/(\d+)\s*mb/i)?.[1]),
    flKt: remarkFl ?? (legs.length ? Math.max(...legs) : null),
    sfcKt: int(text.match(/MAX\s+(?:SFC|SURFACE)\s+WIND\s+(\d+)\s*KT/i)?.[1]),
    ob: ob ?? null,
    active: age <= 150,
  };
}

export function parseHdob(text: string) {
  const head = text.match(
    /^(\S+)\s+(\S+)\s+(\S+)\s+HDOB\s+(\d+)\s+(\d{8})\s*$/m,
  );
  if (!head) return null;
  const [, aircraft, num, storm, ob, ymd] = head;
  if (/TEST|TRAIN|WXWXA/i.test(num + storm)) return null;
  let fl: number | null = null;
  let sfc: number | null = null;
  let last: string | null = null;
  for (const line of text.split("\n")) {
    const c = line.trim().split(/\s+/);
    if (c.length < 11 || !/^\d{6}$/.test(c[0])) continue;
    last = c[0];
    const f = /^\d+$/.test(c[9]) ? +c[9] : null;
    const s = /^\d+$/.test(c[10]) ? +c[10] : null;
    if (f != null && f < 300) fl = Math.max(fl ?? 0, f);
    if (s != null && s < 300) sfc = Math.max(sfc ?? 0, s);
  }
  return {
    key: `${aircraft}-${num}-${storm}`.toUpperCase(),
    aircraft,
    storm,
    ob,
    fl,
    sfc,
    lastOb: last
      ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T${last.slice(0, 2)}:${last.slice(2, 4)}:${last.slice(4, 6)}Z`
      : null,
  };
}

const pre = (html: string) =>
  (html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1] ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Recon missions from the last 30 hours, airborne first. */
export async function recon() {
  const year = new Date().getUTCFullYear();
  const cutoff = Date.now() - 30 * 3600e3;
  const out = new Map<string, Mission>();
  for (const dir of ["REPNT2", "REPPN2"]) {
    try {
      const base = `https://www.nhc.noaa.gov/archive/recon/${year}/${dir}/`;
      const idx = await get(base);
      if (!idx.ok) continue;
      const names = [
        ...(await idx.text()).matchAll(
          /href="([A-Z0-9]+-[A-Z]+\.(\d{12})\.txt)"/g,
        ),
      ]
        .filter(
          (m) =>
            Date.UTC(
              +m[2].slice(0, 4),
              +m[2].slice(4, 6) - 1,
              +m[2].slice(6, 8),
              +m[2].slice(8, 10),
              +m[2].slice(10, 12),
            ) >= cutoff,
        )
        .map((m) => m[1])
        .slice(-40);
      const bodies = await Promise.all(
        names.map((n) =>
          get(base + n)
            .then((r) => (r.ok ? r.text() : null))
            .catch(() => null),
        ),
      );
      for (const body of bodies) {
        const v = body ? parseVdm(body) : null;
        if (!v) continue;
        const prev = out.get(v.key);
        if (!prev || (v.fix ?? "") > (prev.fix ?? ""))
          out.set(v.key, {
            ...v,
            flKt: Math.max(v.flKt ?? 0, prev?.flKt ?? 0) || null,
            mslp:
              v.mslp != null && prev?.mslp != null
                ? Math.min(v.mslp, prev.mslp)
                : (v.mslp ?? prev?.mslp ?? null),
          });
      }
    } catch {
      /* one basin failing must not blank the table */
    }
  }
  const hdobs = await Promise.all(
    ["URNT15-USAF", "URNT15-NOAA", "URPN15-USAF", "URPN15-NOAA"].map((p) =>
      get(`https://www.nhc.noaa.gov/text/${p}.shtml`)
        .then(async (r) => (r.ok ? parseHdob(pre(await r.text())) : null))
        .catch(() => null),
    ),
  );
  for (const h of hdobs) {
    if (!h) continue;
    const airborne = h.lastOb
      ? Date.now() - Date.parse(h.lastOb) < 90 * 60e3
      : false;
    const e = out.get(h.key);
    if (e)
      out.set(h.key, {
        ...e,
        active: airborne || e.active,
        lastOb: h.lastOb,
        flKt: Math.max(e.flKt ?? 0, h.fl ?? 0) || null,
        sfcKt: Math.max(e.sfcKt ?? 0, h.sfc ?? 0) || null,
      });
    else if (airborne)
      out.set(h.key, {
        key: h.key,
        aircraft: h.aircraft,
        storm: h.storm,
        stormId: null,
        fix: null,
        lastOb: h.lastOb,
        lat: null,
        lon: null,
        mslp: null,
        flKt: h.fl,
        sfcKt: h.sfc,
        ob: h.ob,
        active: true,
      });
  }
  return [...out.values()].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      (b.lastOb ?? b.fix ?? "").localeCompare(a.lastOb ?? a.fix ?? ""),
  );
}
