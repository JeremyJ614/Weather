import { useMemo } from "react";
import type React from "react";
import { PAL } from "@/features/replay/palette";
import { Countdown } from "./Countdown";
import { ratingLabel } from "@/features/replay/archive/types";
import type { Replayable } from "../replayable";
import {
  distanceLabel,
  durationLabel,
  hailCard,
  nextTornado,
  tornadoCards,
  type TornadoCard,
} from "./live";

/** What the trend line says, and how loudly. */
const TREND: Record<
  NonNullable<TornadoCard["trend"]>,
  { text: string; tone: string }
> = {
  closing: { text: "closing on you", tone: "bad" },
  leaving: { text: "moving away", tone: "ok" },
  holding: { text: "holding its distance", tone: "warn" },
};

/**
 * The cards that say what is happening.
 *
 * One per tornado on the ground, nearest first, plus the day's worst recent
 * hail when there is any. They sit bottom-left on a phone and left-of-centre
 * on a desktop, out of the way of the clock and the transport, and they are
 * the only thing on the map that appears and disappears on its own — which is
 * deliberate. A card arriving is the map telling you something changed.
 *
 * Tapping one opens the survey report behind it.
 */
export function InfoCards({
  replay,
  at,
  onOpenReport,
  openReport,
  onJump,
  hostRef,
}: {
  replay: Replayable | null;
  at: number;
  onOpenReport: (index: number | null) => void;
  openReport: number | null;
  /** Jumping the clock, for the countdown at the top of the stack. */
  onJump: (to: number) => void;
  /** So the page can measure the stack and keep the panels clear of it. */
  hostRef?: React.Ref<HTMLDivElement>;
}) {
  const cards = useMemo(
    () => (replay ? tornadoCards(replay, at) : []),
    [replay, at],
  );
  const hail = useMemo(
    () => (replay ? hailCard(replay, at) : null),
    [replay, at],
  );
  const next = useMemo(
    () => (replay ? nextTornado(replay, at) : null),
    [replay, at],
  );
  const scale = replay?.scale ?? "EF";

  if (!replay || (cards.length === 0 && !hail && !next)) return null;

  return (
    <div className="info-cards" ref={hostRef}>
      {/*
        What is next, pinned above what is now.

        Outside the scroller on purpose. It was inside it for one build, which
        looked right in the source and was wrong on screen: the stack is
        column-reverse and a column-reverse scroller rests at its own start,
        which is the bottom — so the countdown sat above the scroll position
        and was never visible, and the card it half-covered read as a
        rendering fault.

        It used to live in the left-hand column with the chase card. That
        column cannot hold it on a phone: at 360×740, once the top bar, the
        map buttons, this stack and the HUD have taken their space, 58px
        remain, and the countdown alone is 77. It belongs here anyway — now
        and next are the same question asked twice.
      */}
      <Countdown replay={replay} at={at} onJump={onJump} />

      <div className="info-cards-stack" aria-live="polite">
        {cards.map((c) => {
          const colour = PAL.ef[c.ef] ?? PAL.ef.EFU;
          const trend = c.trend ? TREND[c.trend] : null;
          return (
            <button
              key={c.index}
              type="button"
              className="info-card"
              data-open={openReport === c.index || undefined}
              style={{ "--card-accent": colour } as React.CSSProperties}
              onClick={() =>
                onOpenReport(openReport === c.index ? null : c.index)
              }
              aria-expanded={openReport === c.index}
            >
              <span className="ic-bar" aria-hidden="true" />
              <span className="ic-body">
                <span className="ic-head">
                  <span className="ic-name">{c.name}</span>
                  {/*
                  The rating is never colour alone. An EF1 and an EF3 differ by
                  two hues here and by two characters of text, and only the
                  second of those survives a colourblind reader, a greyscale
                  screenshot, or a phone in direct sun.
                */}
                  <span className="ic-ef" style={{ background: colour }}>
                    {ratingLabel(c.ef, scale)}
                  </span>
                </span>

                <span className="ic-line">
                  <strong>on the ground</strong>
                  {c.metres !== null && c.fromYou && (
                    <>
                      {" "}
                      · {distanceLabel(c.metres)} {c.fromYou} of you
                    </>
                  )}
                </span>

                <span className="ic-line ic-dim">
                  moving {c.heading} at {c.mph} mph
                  {trend && (
                    <>
                      {" "}
                      ·{" "}
                      <span className={`ic-trend ic-${trend.tone}`}>
                        {trend.text}
                      </span>
                    </>
                  )}
                </span>

                <span className="ic-line ic-dim">
                  {c.widthYd > 0 && (
                    <>{c.widthYd.toLocaleString()} yd wide · </>
                  )}
                  {c.maxwind > 0 && <>{c.maxwind} mph winds · </>}
                  down {durationLabel(c.aground)}
                </span>
              </span>
              <span className="ic-more ui" aria-hidden="true">
                {openReport === c.index ? "Close" : "Survey"}
              </span>
            </button>
          );
        })}

        {hail && (
          <div className="info-card info-card-hail">
            <span className="ic-bar" aria-hidden="true" />
            <span className="ic-body">
              <span className="ic-head">
                <span className="ic-name">{hail.size} hail</span>
                <span className="ic-ef ic-ice">
                  {hail.inches.toFixed(2)}&Prime;
                </span>
              </span>
              <span className="ic-line">
                <strong>{hail.place}</strong>
                {hail.metres !== null && hail.fromYou && (
                  <>
                    {" "}
                    · {distanceLabel(hail.metres)} {hail.fromYou} of you
                  </>
                )}
              </span>
              <span className="ic-line ic-dim">
                {durationLabel(hail.ago)} ago
                {hail.source && <> · {hail.source}</>}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
