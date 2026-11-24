import type { Recipe } from "@/lib/models/core";
import { fill } from "@/lib/models/tpl";

/**
 * Earth Watch's wind: GFS 10 m wind speed in mph, read from NOAA's open data on AWS and drawn on
 * the viewer's own device by the model viewer's worker (no server cost). The forecast hour
 * nearest now is used, so the picture is the model's best guess at this hour.
 */
export const WIND: Recipe = {
  key: "wind10",
  match: ":UGRD:10 m above ground:",
  extra: [":VGRD:10 m above ground:"],
  combine: "mag",
  levels: [0, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100],
  full: true,
};

/** The GFS files to try for the hour nearest `now`: the newest run likely out, then the one before. */
export function windUrls(tpl: string, now: number) {
  const H = 3600_000;
  const pad = (n: number) => String(n).padStart(2, "0");
  // A GFS run is fully out about four and a half hours after its start.
  const run = Math.floor((now - 4.5 * H) / (6 * H)) * 6 * H;
  return [run, run - 6 * H].map((r) => {
    const d = new Date(r);
    const fh = Math.max(0, Math.min(120, Math.round((now - r) / H)));
    return {
      url: fill(
        tpl,
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`,
        pad(d.getUTCHours()),
        fh,
      ),
      /** The hour the picture is for. */
      at: r + fh * H,
    };
  });
}
