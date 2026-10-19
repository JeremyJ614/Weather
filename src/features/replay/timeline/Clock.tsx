import { useMemo } from "react";
import { readingAt } from "@/features/replay/core/timezone";

interface ClockProps {
  /** Epoch seconds of the chase start. */
  T0: number;
  /** Seconds from T0. */
  at: number;
  /**
   * Where the replay starts, in seconds from T0.
   *
   * T0 is a reference point, not the moment the chase began — on the 10 March
   * 2026 payload the first fix sits at T0 while the first touchdown is nearly
   * seven hours later. Counting elapsed time from T0 made the clock open at
   * "+6:49:30", which answers a question nobody asked.
   */
  since?: number;
  /** Where the chaser is now — the clock follows the chaser, not the chase. */
  lat: number;
  lon: number;
  /** The zone the chase declared, used wherever position cannot decide. */
  declaredZone: string;
  /** Playback multiplier, shown so the reader knows the clock is not wall-time. */
  speed?: number;
  paused?: boolean;
}

/**
 * The clock, as an instrument rather than a caption (Z3 #08).
 *
 * It reports three things a chaser actually needs and one they would otherwise
 * get wrong:
 *
 *   * the local time where the chaser is standing, which is not necessarily
 *     the zone the chase was filed under (B-009);
 *   * how far into the chase this is;
 *   * whether the clock is running, and how fast;
 *   * that the zone changed under them, when it did.
 *
 * Seconds are shown but de-emphasised: they move constantly and would drag the
 * eye away from the hour and minute, which are what gets read.
 */
export function Clock({
  T0,
  at,
  since = 0,
  lat,
  lon,
  declaredZone,
  speed = 1,
  paused,
}: ClockProps) {
  const instant = useMemo(() => new Date((T0 + at) * 1000), [T0, at]);
  const zone = useMemo(
    () => readingAt(lat, lon, declaredZone, instant),
    [lat, lon, declaredZone, instant],
  );

  const parts = useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: zone.zone,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).formatToParts(instant);
      const get = (t: string) => fmt.find((p) => p.type === t)?.value ?? "";
      return {
        hour: get("hour"),
        minute: get("minute"),
        second: get("second"),
        period: get("dayPeriod"),
      };
    } catch {
      return { hour: "--", minute: "--", second: "--", period: "" };
    }
  }, [instant, zone.zone]);

  return (
    <div className="clock" data-paused={paused ? "" : undefined}>
      <div className="clock-face">
        <span className="clock-time">
          {parts.hour}
          {/* The colon blinks only while running, so a still clock looks still. */}
          <span className="clock-colon" data-running={!paused ? "" : undefined}>
            :
          </span>
          {parts.minute}
        </span>
        <span className="clock-tail">
          <span className="clock-seconds">{parts.second}</span>
          <span className="clock-period">{parts.period}</span>
        </span>
      </div>

      <div className="clock-meta">
        <span
          className="clock-zone"
          data-approximate={zone.approximate ? "" : undefined}
        >
          {zone.abbreviation}
          {zone.approximate ? (
            <abbr title="Close to a time zone boundary — this may be the neighbouring zone">
              *
            </abbr>
          ) : null}
        </span>
        <span className="clock-elapsed">{elapsed(at - since)}</span>
        {speed !== 1 ? <span className="clock-speed">{speed}×</span> : null}
        {paused ? <span className="clock-speed">paused</span> : null}
      </div>

      {/* Said once, where it happens: the zone moved out from under the chase. */}
      {zone.changed ? (
        <p className="clock-note">
          Now on {zone.abbreviation} — the chase was filed under{" "}
          {shortZone(declaredZone)}.
        </p>
      ) : null}
    </div>
  );
}

/** "+1:24:06" — how far into the chase, which is what a chaser counts in. */
export function elapsed(seconds: number): string {
  const sign = seconds < 0 ? "−" : "+";
  const s = Math.abs(Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0
    ? `${sign}${h}:${pad(m)}:${pad(sec)}`
    : `${sign}${m}:${pad(sec)}`;
}

/** "America/Chicago" is not something to put in front of a reader. */
function shortZone(zone: string): string {
  const tail = zone.split("/").pop() ?? zone;
  return tail.replace(/_/g, " ");
}
