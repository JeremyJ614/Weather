import { useMemo } from "react";
import { PAL } from "@/features/replay/palette";
import { ratingLabel } from "@/features/replay/archive/types";
import type { Replayable } from "../replayable";
import { countdownLabel, distanceLabel, nextTornado } from "./live";

/** Under this, the countdown stops being information and starts being a warning. */
const IMMINENT = 120;

/**
 * How long until the next one.
 *
 * The map could describe now in six different ways and could not answer the
 * one question a chaser actually has while watching a replay. The scrub bar
 * shows the whole day at once, which tells you a tornado is coming but not
 * which one or when.
 *
 * Pressing it jumps the clock to thirty seconds before touchdown, because the
 * reason you want to know when something happens is to watch it happen.
 */
export function Countdown({
  replay,
  at,
  onJump,
}: {
  replay: Replayable | null;
  at: number;
  onJump: (to: number) => void;
}) {
  const next = useMemo(
    () => (replay ? nextTornado(replay, at) : null),
    [replay, at],
  );
  if (!replay || !next) return null;

  const colour = PAL.ef[next.ef] ?? PAL.ef.EFU;
  const imminent = next.inSeconds <= IMMINENT;

  return (
    <button
      type="button"
      className="countdown"
      data-soon={imminent || undefined}
      style={{ "--card-accent": colour } as React.CSSProperties}
      onClick={() =>
        onJump(Math.max(replay.window[0], at + next.inSeconds - 30))
      }
      title="Jump to just before it touches down"
    >
      <span className="cd-label ui">Next</span>
      <span className="cd-time">{countdownLabel(next.inSeconds)}</span>
      <span className="cd-what">
        <span className="cd-ef" style={{ background: colour }}>
          {ratingLabel(next.ef, replay.scale ?? "EF")}
        </span>
        <span className="cd-name">{next.name}</span>
      </span>
      <span className="cd-sub">
        {next.metres !== null && <>{distanceLabel(next.metres)} away · </>}
        {next.remaining} more {next.remaining === 1 ? "tornado" : "tornadoes"}{" "}
        to come
      </span>
    </button>
  );
}
