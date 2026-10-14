/** GOES GeoColor loops from NOAA STAR: a basin sector, or one storm's floater. */
const CDN = "https://cdn.star.nesdis.noaa.gov";
export const SECTORS: Record<
  string,
  { path: string; size: string; label: string }
> = {
  AL: {
    path: "GOES19/ABI/SECTOR/taw/GEOCOLOR",
    size: "900x540",
    label: "GOES-East · Tropical Atlantic",
  },
  EP: {
    path: "GOES18/ABI/SECTOR/eep/GEOCOLOR",
    size: "900x540",
    label: "GOES-West · East Pacific",
  },
  CP: {
    path: "GOES18/ABI/SECTOR/tpw/GEOCOLOR",
    size: "900x540",
    label: "GOES-West · Tropical Pacific",
  },
};

export type Frame = { url: string; at: string };

/** Picks every `step`-th of the newest frames of one size from a STAR directory listing. */
export function framesFrom(
  html: string,
  base: string,
  size: string,
  count: number,
  step: number,
): Frame[] {
  const names = [
    ...new Set(
      [...html.matchAll(/href="(\d{11}_[^"]+-(\d+x\d+)\.jpg)"/g)]
        .filter((m) => m[2] === size)
        .map((m) => m[1]),
    ),
  ].sort();
  const picked: string[] = [];
  for (let i = names.length - 1; i >= 0 && picked.length < count; i -= step)
    picked.unshift(names[i]);
  return picked.map((n) => {
    // 20262870400 = year 2026, day-of-year 287, 04:00 UTC.
    const y = +n.slice(0, 4);
    const d = new Date(
      Date.UTC(y, 0, +n.slice(4, 7), +n.slice(7, 9), +n.slice(9, 11)),
    );
    return { url: `${base}/${n}`, at: d.toISOString() };
  });
}

export async function satFrames(
  src: string,
  big: boolean,
): Promise<{ label: string; frames: Frame[] } | null> {
  const sector = SECTORS[src];
  const storm = /^(AL|EP|CP)\d{6}$/.test(src) ? src : null;
  if (!sector && !storm) return null;
  const path = sector ? sector.path : `FLOATER/data/${storm}/GEOCOLOR`;
  const size = sector
    ? big
      ? "1800x1080"
      : sector.size
    : big
      ? "1000x1000"
      : "500x500";
  const r = await fetch(`${CDN}/${path}/`, { next: { revalidate: 300 } });
  if (!r.ok) return null;
  const frames = framesFrom(
    await r.text(),
    `${CDN}/${path}`,
    size,
    big ? 36 : 24,
    2,
  );
  return frames.length
    ? { label: sector ? sector.label : `GOES floater · ${storm}`, frames }
    : null;
}
