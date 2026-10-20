import { useMemo } from "react";
import { PAL } from "@/features/replay/palette";
import { ratingLabel } from "@/features/replay/archive/types";
import { metresToMiles } from "@/features/replay/core/geo";
import type { Replayable } from "../replayable";
import { isNonEf, plainStructure, surveyReport } from "./survey";
import { dateFormat } from "@/features/replay/core/intl";

/** hh:mm in the chase's own timezone, which is the only one that means anything. */
function localTime(T0: number, offset: number, tz: string): string {
  return dateFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date((T0 + offset) * 1000));
}

/**
 * What the National Weather Service found.
 *
 * A sheet rather than a popup, because the narratives run to several hundred
 * words and a popup that needs scrolling is a sheet that is embarrassed about
 * it. It slides over the left of the map, leaves the clock and the transport
 * reachable, and closes on Escape or on the card that opened it.
 */
export function SurveyPanel({
  replay,
  index,
  onClose,
}: {
  replay: Replayable | null;
  index: number | null;
  onClose: () => void;
}) {
  const report = useMemo(
    () => (replay && index !== null ? surveyReport(replay, index) : null),
    [replay, index],
  );

  if (!replay || !report) return null;
  const t = report.tornado;
  const colour = PAL.ef[t.ef] ?? PAL.ef.EFU;
  const scale = replay.scale ?? "EF";
  const miles = metresToMiles(t.lengthM);

  return (
    <aside
      className="survey"
      aria-label={`Survey report for ${t.name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header
        className="survey-head"
        style={{ "--card-accent": colour } as React.CSSProperties}
      >
        <div className="survey-title">
          <span className="survey-ef" style={{ background: colour }}>
            {ratingLabel(t.ef, scale)}
          </span>
          <h2>{t.name}</h2>
        </div>
        <button
          type="button"
          className="survey-close ui"
          onClick={onClose}
          aria-label="Close the survey report"
        >
          Close
        </button>
      </header>

      <div className="survey-scroll">
        <dl className="survey-stats">
          <div>
            <dt>On the ground</dt>
            <dd>
              {localTime(replay.T0, t.start, replay.tz)} –{" "}
              {localTime(replay.T0, t.end, replay.tz)}
            </dd>
          </div>
          <div>
            <dt>Path length</dt>
            <dd>{miles.toFixed(2)} mi</dd>
          </div>
          <div>
            <dt>Maximum width</dt>
            <dd>
              {t.widthYd > 0
                ? `${Math.round(t.widthYd).toLocaleString()} yd`
                : "not surveyed"}
            </dd>
          </div>
          <div>
            <dt>Estimated peak wind</dt>
            <dd>{t.maxwind > 0 ? `${t.maxwind} mph` : "not estimated"}</dd>
          </div>
          <div>
            <dt>Injuries</dt>
            <dd>{t.injuries}</dd>
          </div>
          <div>
            <dt>Fatalities</dt>
            <dd>{t.fatalities}</dd>
          </div>
          {t.wfo && (
            <div>
              <dt>Surveyed by</dt>
              <dd>NWS {t.wfo}</dd>
            </div>
          )}
        </dl>

        {t.comments ? (
          <section className="survey-narrative">
            <h3>The survey&rsquo;s account</h3>
            {/*
              Split on blank lines and kept as the office wrote it. No
              summarising and no rewriting: this is the only text in the app
              that is a primary source, and the whole value of it is that a
              reader can tell it was not written by this app.
            */}
            {t.comments.split(/\n\s*\n/).map((para, i) => (
              <p key={i}>{para.trim()}</p>
            ))}
          </section>
        ) : (
          <section className="survey-narrative">
            <h3>The survey&rsquo;s account</h3>
            <p className="survey-none">
              No narrative was published for this one. That is common for short,
              weak tornadoes over open ground, where the survey confirms the
              track and records nothing further.
            </p>
          </section>
        )}

        <section className="survey-damage">
          <h3>Damage points</h3>
          {report.total === 0 ? (
            <p className="survey-none">
              No individual damage points were logged for this tornado.
            </p>
          ) : (
            <>
              <p className="survey-count">
                <strong>{report.total.toLocaleString()}</strong> surveyed
                {report.total === 1 ? " point" : " points"}
              </p>
              <ul className="survey-tally">
                {report.tally.map(({ ef, count }) => (
                  <li key={ef}>
                    <span
                      className="st-swatch"
                      style={{ background: PAL.ef[ef] ?? PAL.ef.EFU }}
                      aria-hidden="true"
                    />
                    <span className="st-ef">
                      {isNonEf(ef)
                        ? "Straight-line wind"
                        : ratingLabel(ef, scale)}
                    </span>
                    <span className="st-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${(count / report.total) * 100}%`,
                          background: PAL.ef[ef] ?? PAL.ef.EFU,
                        }}
                      />
                    </span>
                    <span className="st-n">{count}</span>
                  </li>
                ))}
              </ul>

              {report.worst && (
                <p className="survey-worst">
                  Worst single point:{" "}
                  <strong>{plainStructure(report.worst.what)}</strong>
                  {report.worst.degree && (
                    <> — {report.worst.degree.toLowerCase()}</>
                  )}
                  {report.worst.wind > 0 && (
                    <>, estimated {report.worst.wind} mph</>
                  )}
                  .
                </p>
              )}

              {report.structures.length > 0 && (
                <>
                  <h4>What it hit</h4>
                  <ul className="survey-structures">
                    {report.structures.map((s) => (
                      <li key={s.what}>
                        <span>{plainStructure(s.what)}</span>
                        <span className="ss-n">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </aside>
  );
}
