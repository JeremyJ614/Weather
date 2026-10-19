import { useMemo, useState } from "react";
import { chaserAt, LEGEND_STOPS } from "./decode";
import {
  RADAR_PRODUCTS,
  coveredByArchive,
  scanLabel,
  snapToScan,
  stampFor,
} from "./source";

/**
 * The palette colour for a dBZ, composited the way the map shows it.
 *
 * Over the map's own dark ground, because a swatch of the raw colour at 38
 * per cent alpha looks nothing like the pixel it is standing for.
 */
function swatch(dbz: number): string {
  const c = chaserAt(dbz);
  const over = (v: number) => Math.round(v * c.a + 20 * (1 - c.a));
  return `rgb(${over(c.r)}, ${over(c.g)}, ${over(c.b)})`;
}

export interface RadarState {
  on: boolean;
  opacity: number;
  /** The moment the loaded scan is for, or null when nothing is loaded. */
  loadedAt: number | null;
  loading: boolean;
  /** What the last fetch found. */
  note: string | null;
}

/**
 * The radar controls.
 *
 * Never automatic, which is the owner's requirement and also the right
 * default: this fetches up to sixty-four tiles from somebody else's server,
 * and doing that silently every time a map opens would be rude to them and
 * expensive on a phone in a field.
 *
 * So there is a button, and it says what it will do before it does it.
 */
export function RadarPanel({
  state,
  at,
  zone,
  onFetch,
  onClear,
  onOpacity,
}: {
  state: RadarState;
  /** The replay clock's current epoch, which is what would be fetched. */
  at: number;
  /**
   * The zone the clock is reading in.
   *
   * This line used to be printed in UTC while the clock beside it read local,
   * so deciding whether the offered scan was the right one meant converting in
   * your head. Radar archives are keyed in UTC; nothing about that obliges the
   * sentence to be.
   */
  zone: string;
  onFetch: () => void;
  onClear: () => void;
  onOpacity: (v: number) => void;
}) {
  const [showLegend, setShowLegend] = useState(true);
  const covered = useMemo(() => coveredByArchive(at), [at]);

  const scanTime = useMemo(() => scanLabel(at, zone), [at, zone]);

  const stale =
    state.loadedAt !== null && snapToScan(state.loadedAt) !== snapToScan(at);

  return (
    <div className="map-panel radar-panel">
      <p className="map-panel-head">Radar</p>

      {!covered ? (
        <p className="rd-none">
          The national radar archive does not reach this day. It begins in 2010;
          before that there is no composite to fetch, and an empty sky over a
          violent outbreak would be a worse answer than none.
        </p>
      ) : (
        <>
          <p className="rd-when">
            Nothing is fetched until you ask. The scan for{" "}
            <strong>{scanTime}</strong> is the one that covers this moment.
          </p>

          <div className="rd-actions">
            <button
              type="button"
              className="rd-fetch"
              disabled={state.loading}
              onClick={onFetch}
            >
              {state.loading
                ? "Fetching…"
                : state.loadedAt === null
                  ? "Fetch this scan"
                  : stale
                    ? "Fetch this moment"
                    : "Fetch again"}
            </button>
            {state.loadedAt !== null && (
              <button
                type="button"
                className="rd-clear"
                onClick={onClear}
                disabled={state.loading}
              >
                Clear
              </button>
            )}
          </div>

          {stale && !state.loading && (
            <p className="rd-stale">
              What is drawn is the scan for{" "}
              {new Date(snapToScan(state.loadedAt!) * 1000).toLocaleTimeString(
                "en-US",
                { timeStyle: "short", timeZone: "UTC" },
              )}{" "}
              UTC. The clock has moved on.
            </p>
          )}
          {state.note && <p className="rd-note">{state.note}</p>}

          {state.loadedAt !== null && (
            <label className="rd-slider">
              <span>
                Opacity <em>{Math.round(state.opacity * 100)}%</em>
              </span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round(state.opacity * 100)}
                onChange={(e) => onOpacity(Number(e.target.value) / 100)}
              />
            </label>
          )}
        </>
      )}

      <button
        type="button"
        className="rd-legend-toggle"
        aria-expanded={showLegend}
        onClick={() => setShowLegend((v) => !v)}
      >
        {showLegend ? "Hide the scale" : "Show the scale"}
      </button>

      {showLegend && (
        <div className="rd-legend">
          {/*
            Numbers beside every colour, always. A reflectivity ramp is
            continuous, so neighbouring values are meant to look alike — the
            number is what makes a particular one readable, and it is the
            secondary encoding that lets the ramp be a ramp at all.
          */}
          {LEGEND_STOPS.map((dbz) => (
            <span key={dbz} className="rd-legend-row">
              <span
                className="rd-swatch"
                style={{ background: swatch(dbz) }}
                aria-hidden="true"
              />
              <span className="rd-dbz">
                {dbz}
                <small>dBZ</small>
              </span>
              <span className="rd-means">
                {dbz <= 20
                  ? "light rain"
                  : dbz <= 30
                    ? "steady rain"
                    : dbz <= 40
                      ? "heavy rain"
                      : dbz <= 50
                        ? "a core"
                        : dbz <= 60
                          ? "hail likely"
                          : "large hail"}
              </span>
            </span>
          ))}
          <p className="rd-muted-note">
            Below 20 dBZ is deliberately almost invisible. The
            forecaster&rsquo;s palette colours it as brightly as a core, and a
            supercell arrives inside a wash of green that hides where the storm
            actually is.
          </p>
        </div>
      )}

      <div className="rd-products">
        <p className="rd-products-head">Products</p>
        {RADAR_PRODUCTS.map((p) => (
          <div
            key={p.id}
            className="rd-product"
            data-off={!p.available || undefined}
          >
            <span className="rd-product-name">
              {p.label}
              {!p.available && (
                <span className="rd-unavailable">unavailable</span>
              )}
            </span>
            <span className="rd-product-blurb">
              {p.available ? p.blurb : p.why}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Exported for the test, which checks the legend matches the palette. */
export { swatch as legendSwatch, stampFor };
