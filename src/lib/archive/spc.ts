import "server-only";
import data from "@/data/archive/spc-surveyed.json";
import type { ArchiveTornado } from "@/features/replay/archive/types";
import { groupDays } from "./auto";
import type { AutoDay, Survey } from "./group";

/**
 * The NWS Surveyed list's days through SPC's last published year (owner, 2026-11-02): every F4
 * and F5 before 2000, every violent or significant tornado from 2000 through 2022, and every
 * tornado from 2023, from SPC's database (scripts/archive/build_spc_surveyed.py). Each qualifying tornado's neighbours ride along,
 * so a day replays with its whole outbreak. Grouped into storm events exactly as surveyed
 * days are; only events holding a qualifying tornado are listed. Nothing is stored in the
 * database: this file ships with the app.
 */
type Row = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  string,
  number,
];

/** Days from here on come from the NWS Damage Assessment Toolkit instead. */
export const SPC_THROUGH = `${data.through}-12-31`;
/** The Fujita scale ran until 1 February 2007. */
const EF_FROM = "2007-02-01";

const ef = (mag: number) => (mag >= 0 && mag <= 5 ? `EF${mag}` : "EFU");

let built: { days: AutoDay[]; tracks: Map<string, Survey[]> } | null = null;

function build() {
  if (built) return built;
  const list: Survey[] = (data.t as Row[]).map(
    ([t0, t1, mag, x0, y0, x1, y1, miles, yards, fat, inj, st, q]) => ({
      start: t0,
      end: t1,
      ef: ef(mag),
      wfo: "",
      fat,
      inj,
      lengthMi: miles,
      path: [
        [x0, y0],
        [x1, y1],
      ],
      widthYd: yards,
      st,
      key: q === 1,
    }),
  );
  const tracks = new Map<string, Survey[]>();
  const days = groupDays(list, (d, g) => {
    if (g.some((t) => t.key)) tracks.set(d.id, g);
  }).filter((d) => tracks.has(d.id));
  built = { days, tracks };
  return built;
}

/** Every listed pre-2023 storm event, newest first. */
export function spcDays(): AutoDay[] {
  return build().days;
}

/** The scale a day was rated on. */
export const scaleOf = (day: string): "F" | "EF" =>
  day < EF_FROM ? "F" : "EF";

/**
 * One pre-2023 event's day and tracks, straight lines from each recorded start to end. Times
 * are seconds from the day's first touchdown (the replay's T0), like every archive event.
 */
export function spcEvent(
  id: string,
): { day: AutoDay; torn: ArchiveTornado[] } | null {
  const { days, tracks } = build();
  const day = days.find((d) => d.id === id);
  const g = day && tracks.get(id);
  if (!day || !g) return null;
  return {
    day,
    torn: g.map((t) => ({
      name: "",
      ef: t.ef,
      start: t.start - day.t0,
      end: t.end - day.t0,
      coords: t.path,
      lengthMi: t.lengthMi,
      widthYd: t.widthYd ?? 0,
      inj: t.inj,
      fat: t.fat,
      state: t.st ?? "",
      geometry:
        t.path[0][0] === t.path[1][0] && t.path[0][1] === t.path[1][1]
          ? "point"
          : "endpoints",
      timing: "SPC database start time; end estimated from the path length",
    })),
  };
}
