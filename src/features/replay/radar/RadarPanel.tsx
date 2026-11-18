import { useMemo, useState } from "react";
import { chaserAt, LEGEND_STOPS } from "./decode";
import {
  ccStops,
  folded,
  MS_TO_MPH,
  velocityStops,
  legendGradient,
} from "./level2/palettes";
import { nearestSites, type NearSite } from "./level2/sites";
import { compassWord, tornadoLabel, type StormMotion } from "./motion";
import {
  DUAL_POL_BEGINS,
  RADAR_PRODUCTS,
  coveredByArchive,
  coveredByLevel2,
  scanLabel,
  snapToScan,
  stampFor,
  type RadarProductId,
} from "./source";
import { dateFormat } from "@/features/replay/core/intl";

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

/** What a radar scan that is on the map came from. */
export interface SiteScanInfo {
  site: string;
  /** "Des Moines, IA". */
  place: string;
  /** Epoch seconds of the lowest scan's first radial. */
  scanTime: number;
  /** Degrees above the horizon. */
  angle: number;
  /** m/s at which velocity folds, when the volume says. */
  nyquist: number | null;
  bytes: number;
  /** Which moments the scan carries. */
  has: { ref: boolean; vel: boolean; cc: boolean };
}

export interface RadarState {
  product: RadarProductId;
  /** Reflectivity from the national mosaic, or from the nearest radar's own scan. */
  source: "mosaic" | "site";
  /** The radar chosen, or null for "the nearest". */
  site: string | null;
  opacity: number;
  /** The moment the loaded scan is for, or null when nothing is loaded. */
  loadedAt: number | null;
  loading: boolean;
  /** What the last fetch found. */
  note: string | null;
  /** Level II scan on the map, if that is what is loaded. */
  scan: SiteScanInfo | null;
  /** While reading: what is happening, in words. */
  progress: string | null;
  /** Fetch again whenever the replay reaches a new scan. */
  follow: boolean;
  /** Blend a radar's bins together, or draw each as measured. */
  smooth: boolean;
}

export const INITIAL_RADAR: RadarState = {
  product: "reflectivity",
  source: "mosaic",
  site: null,
  opacity: 0.68,
  loadedAt: null,
  loading: false,
  note: null,
  scan: null,
  progress: null,
  follow: true,
  smooth: true,
};

/** Whether a product in a given state reads a single radar's archive. */
export const readsSite = (s: Pick<RadarState, "product" | "source">) =>
  s.product !== "reflectivity" || s.source === "site";

/**
 * The radar controls.
 *
 * Never automatic, which is the owner's requirement and also the right
 * default: this fetches tiles or several megabytes of radar volume from
 * somebody else's server, and doing that silently every time a map opens
 * would be rude to them and expensive on a phone in a field. Once the viewer
 * fetches a scan, "Keep up with the replay" (on unless they switch it off)
 * fetches each new scan as the event's clock reaches it.
 */
export function RadarPanel({
  state,
  at,
  zone,
  focus,
  motion,
  onFetch,
  onClear,
  onOpacity,
  onProduct,
  onSource,
  onSite,
  onFollow,
  onSmooth,
}: {
  state: RadarState;
  /** The replay clock's current epoch, which is what would be fetched. */
  at: number;
  /** The zone the clock is reading in. Radar archives are keyed in UTC; the sentences need not be. */
  zone: string;
  /** Where the storm is — the active tornado, or the middle of the map. */
  focus: { lat: number; lon: number; what: string } | null;
  /** The storm motion storm-relative velocity takes out. */
  motion: StormMotion | null;
  onFetch: () => void;
  onClear: () => void;
  onOpacity: (v: number) => void;
  onProduct: (p: RadarProductId) => void;
  onSource: (s: "mosaic" | "site") => void;
  onSite: (id: string | null) => void;
  onFollow: (on: boolean) => void;
  onSmooth: (on: boolean) => void;
}) {
  const [showLegend, setShowLegend] = useState(true);
  const [picking, setPicking] = useState(false);
  const site = readsSite(state);
  const product =
    RADAR_PRODUCTS.find((p) => p.id === state.product) ?? RADAR_PRODUCTS[0]!;
  const covered = useMemo(
    () => (site ? coveredByLevel2(at) : coveredByArchive(at)),
    [at, site],
  );
  const near = useMemo<NearSite[]>(
    () => (focus ? nearestSites(focus.lat, focus.lon, 5) : []),
    // A tenth of a degree is ten kilometres; nearer than that changes nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus && Math.round(focus.lat * 10), focus && Math.round(focus.lon * 10)],
  );
  const chosen = state.site
    ? (near.find((s) => s.id === state.site) ?? null)
    : (near[0] ?? null);
  const scanTime = useMemo(() => scanLabel(at, zone), [at, zone]);
  const clock = (epoch: number) =>
    dateFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZone: safeZone(zone),
      timeZoneName: "short",
    }).format(new Date(epoch * 1000));

  const stale =
    state.loadedAt !== null &&
    (site
      ? state.scan !== null && Math.abs(state.scan.scanTime - at) > 330
      : snapToScan(state.loadedAt) !== snapToScan(at));
  const noCC = state.product === "cc" && at < DUAL_POL_BEGINS;

  return (
    <div className="map-panel radar-panel">
      <p className="map-panel-head">Radar</p>

      <div className="rd-chips" role="radiogroup" aria-label="Radar product">
        {RADAR_PRODUCTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={state.product === p.id}
            className="rd-chip"
            data-on={state.product === p.id || undefined}
            onClick={() => onProduct(p.id)}
          >
            {p.short}
          </button>
        ))}
      </div>
      <p className="rd-blurb">{product.blurb}</p>

      {state.product === "reflectivity" && (
        <div
          className="rd-chips rd-chips-quiet"
          role="radiogroup"
          aria-label="Reflectivity from"
        >
          <button
            type="button"
            role="radio"
            aria-checked={state.source === "mosaic"}
            className="rd-chip"
            data-on={state.source === "mosaic" || undefined}
            onClick={() => onSource("mosaic")}
          >
            National mosaic
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={state.source === "site"}
            className="rd-chip"
            data-on={state.source === "site" || undefined}
            onClick={() => onSource("site")}
          >
            Nearest radar
          </button>
        </div>
      )}

      {site && (
        <div className="rd-site">
          {chosen ? (
            <p>
              From <strong>{chosen.id}</strong> {chosen.name}, {chosen.state}{" "}
              <span className="rd-km">
                {Math.round(chosen.km)} km from {focus?.what ?? "here"}
              </span>{" "}
              <button
                type="button"
                className="rd-link"
                aria-expanded={picking}
                onClick={() => setPicking((v) => !v)}
              >
                {picking ? "Done" : "Change"}
              </button>
            </p>
          ) : (
            <p>The radar nearest the storm.</p>
          )}
          {picking && (
            <div
              className="rd-chips rd-chips-quiet"
              role="radiogroup"
              aria-label="Radar"
            >
              {near.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  className="rd-chip"
                  aria-checked={chosen?.id === s.id}
                  data-on={chosen?.id === s.id || undefined}
                  onClick={() => {
                    onSite(i === 0 ? null : s.id);
                    setPicking(false);
                  }}
                >
                  {s.id} <small>{Math.round(s.km)} km</small>
                </button>
              ))}
            </div>
          )}
          {chosen && chosen.km > 230 && (
            <p className="rd-stale">
              That is a long way for a radar to see. At {Math.round(chosen.km)}{" "}
              km the beam is{" "}
              {Math.round(beamHeightKm(chosen.km, 0.5) * 10) / 10} km up and
              passes over the lowest part of the storm.
            </p>
          )}
        </div>
      )}

      {!covered ? (
        <p className="rd-none">
          {site
            ? "The radars’ own archive begins in June 1991, and the network was not complete until 1997. " +
              "Before that there is no scan to read."
            : "The national mosaic does not reach this day; it begins in 2010. Switch to the nearest radar, " +
              "whose own archive goes back to 1991."}
        </p>
      ) : (
        <>
          {noCC && (
            <p className="rd-stale">
              Radars measured correlation only after the dual-polarisation
              upgrade of 2011 to 2013. This day is before it, so there is
              nothing to show but what the radar did measure.
            </p>
          )}
          <p className="rd-when">
            Nothing is fetched until you ask.{" "}
            {site ? (
              <>
                The radar&rsquo;s scan nearest <strong>{clock(at)}</strong> is
                the one it reads.
              </>
            ) : (
              <>
                The scan for <strong>{scanTime}</strong> is the one that covers
                this moment.
              </>
            )}
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

          <label className="rd-follow">
            <input
              type="checkbox"
              checked={state.follow}
              onChange={(e) => onFollow(e.target.checked)}
            />
            <span>
              Keep up with the replay
              <small>Fetches each new scan as the clock reaches it.</small>
            </span>
          </label>

          {state.progress && (
            <p className="rd-note" role="status">
              {state.progress}
            </p>
          )}

          {state.scan && site && (
            <p className="rd-note">
              {state.scan.site}&rsquo;s {state.scan.angle.toFixed(1)}° scan at{" "}
              {clock(state.scan.scanTime)} —{" "}
              {relative(state.scan.scanTime - at)}.{" "}
              {(state.scan.bytes / 1e6).toFixed(1)} MB read.
            </p>
          )}

          {stale && !state.loading && !state.follow && (
            <p className="rd-stale">
              The clock has moved on from what is drawn.
            </p>
          )}
          {state.note && <p className="rd-note">{state.note}</p>}

          {state.product === "srv" && (
            <p className="rd-note">
              {motion ? (
                <>
                  Storm motion taken out: toward the{" "}
                  {compassWord(motion.toward)} at{" "}
                  {Math.round(motion.speed * MS_TO_MPH)} mph, from{" "}
                  {tornadoLabel(motion.name)}&rsquo;s own track.
                </>
              ) : (
                <>
                  No tornado near this moment to take the storm&rsquo;s motion
                  from, so this is plain velocity until there is one.
                </>
              )}
            </p>
          )}

          {state.loadedAt !== null && (
            <label className="rd-follow">
              <input
                type="checkbox"
                checked={state.smooth}
                onChange={(e) => onSmooth(e.target.checked)}
              />
              <span>
                {site ? "Smooth between bins" : "Smooth between pixels"}
                <small>
                  {site
                    ? "Off draws every bin exactly as the radar measured it."
                    : "Off draws every one kilometre square exactly as the mosaic measured it."}
                </small>
              </span>
            </label>
          )}

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

      {showLegend &&
        (state.product === "velocity" || state.product === "srv") && (
          <VelocityLegend nyquist={state.scan?.nyquist ?? null} />
        )}
      {showLegend && state.product === "cc" && <CorrelationLegend />}
      {showLegend && state.product === "reflectivity" && (
        <div className="rd-legend">
          {/*
            Numbers beside every colour, always. A reflectivity ramp is
            continuous, so neighbouring values are meant to look alike — the
            number is what makes a particular one readable.
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
    </div>
  );
}

const foldedSwatch = () => {
  const f = folded();
  const over = (v: number) => Math.round(v * f[3] + 20 * (1 - f[3]));
  return `rgb(${over(f[0])}, ${over(f[1])}, ${over(f[2])})`;
};

function VelocityLegend({ nyquist }: { nyquist: number | null }) {
  const ticks = [-100, -50, 0, 50, 100];
  return (
    <div className="rd-legend">
      <div
        className="rd-bar"
        style={{ background: legendGradient(velocityStops(), -45, 45) }}
        aria-hidden="true"
      />
      <div className="rd-ticks">
        {ticks.map((t) => (
          <span key={t}>{t > 0 ? `+${t}` : t}</span>
        ))}
      </div>
      <div className="rd-ends">
        <span>towards the radar</span>
        <span>mph</span>
        <span>away from it</span>
      </div>
      <p className="rd-muted-note">
        <span
          className="rd-swatch rd-swatch-inline"
          style={{ background: foldedSwatch() }}
          aria-hidden="true"
        />{" "}
        Purple is range folded: something came back, but the radar could not
        tell from how far.
      </p>
      <p className="rd-muted-note">
        {nyquist ? (
          <>
            This scan folds beyond &plusmn;{Math.round(nyquist * MS_TO_MPH)}{" "}
            mph.{" "}
          </>
        ) : (
          <>
            Velocity folds past the scan&rsquo;s limit, usually 55 to 75
            mph.{" "}
          </>
        )}
        A jump straight from bright green to bright red with no grey between is
        folding, not a tornado; a couplet has grey or dark colours between its
        two cores.
      </p>
    </div>
  );
}

function CorrelationLegend() {
  const ticks = [0.2, 0.4, 0.6, 0.8, 1.0];
  return (
    <div className="rd-legend">
      <div
        className="rd-bar"
        style={{ background: legendGradient(ccStops(), 0.2, 1.0) }}
        aria-hidden="true"
      />
      <div className="rd-ticks">
        {ticks.map((t) => (
          <span key={t}>{t.toFixed(1)}</span>
        ))}
      </div>
      <div className="rd-ends">
        <span>debris, birds, clutter</span>
        <span>hail</span>
        <span>rain</span>
      </div>
      <p className="rd-muted-note">
        Drawn only where reflectivity is above 10 dBZ. A blue or cyan knot
        inside the hook, on top of a velocity couplet, is a tornado debris
        signature: confirmation that a tornado is on the ground and hitting
        something.
      </p>
    </div>
  );
}

/** "3 min after this moment", "40 s before it". */
function relative(seconds: number): string {
  const s = Math.round(Math.abs(seconds));
  if (s < 20) return "at this moment";
  const amount = s < 90 ? `${s} s` : `${Math.round(s / 60)} min`;
  return seconds > 0 ? `${amount} after this moment` : `${amount} before it`;
}

/** Height of a radar beam's centre above the antenna, 4/3-earth model. */
export function beamHeightKm(rangeKm: number, elevationDeg: number): number {
  const ka = (4 / 3) * 6371;
  const e = (elevationDeg * Math.PI) / 180;
  return (
    Math.sqrt(rangeKm ** 2 + ka ** 2 + 2 * rangeKm * ka * Math.sin(e)) - ka
  );
}

function safeZone(zone: string): string {
  try {
    dateFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return "UTC";
  }
}

/** Exported for the test, which checks the legend matches the palette. */
export { swatch as legendSwatch, stampFor };
