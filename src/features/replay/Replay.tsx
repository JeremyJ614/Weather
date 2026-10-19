"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapCanvas, type CameraMode } from "@/features/replay/map/MapCanvas";
import type { SkyGrade } from "@/features/replay/map/sky";
import {
  LAYER_TOGGLES,
  defaultLayers,
  type LayerId,
} from "@/features/replay/map/layerToggles";
import { STYLE_LABELS, type BaseStyleId } from "@/features/replay/map/styles";
import { Switcher } from "@/features/replay/map/Switcher";
import { activeAt, type Replayable } from "@/features/replay/map/replayable";
import { insideSpans } from "@/features/replay/map/warnings";
import { Clock } from "@/features/replay/timeline/Clock";
import { ScrubBar } from "@/features/replay/timeline/ScrubBar";
import { momentsOf, spansOf } from "@/features/replay/timeline/moments";
import type { Moment } from "@/features/replay/timeline/snap";
import { SPEEDS, useClock } from "@/features/replay/map/useClock";
import { useMeasuredHeight } from "@/features/replay/map/useMeasuredHeight";
import { InfoCards } from "@/features/replay/map/cards/InfoCards";
import { SurveyPanel } from "@/features/replay/map/cards/SurveyPanel";
import {
  RadarPanel,
  type RadarState,
} from "@/features/replay/radar/RadarPanel";
import type { RadarLayer } from "@/features/replay/radar/RadarLayer";
import { readingAt } from "@/features/replay/core/timezone";
import type { Colors } from "@/lib/colors/pick";
import type { ReplayEntry } from "./entries";
import { PAL, applyPalette } from "./palette";
import "./replay.css";

/** What each speed means, for the button's tooltip. */
const SPEED_NOTE: Record<number, string> = {
  1: "real time",
  10: "1 min in 6 s",
  60: "1 hour a minute",
  750: "the whole day in about a minute",
};

/** 76° puts a real horizon on screen, so the graded sky shows. */
const PRESET_3D = { pitch: 76, bearing: -24 };

const SKY_LABEL: Record<SkyGrade["phase"], string> = {
  day: "Daylight",
  golden: "Golden hour",
  civil: "Dusk",
  nautical: "Blue hour",
  astronomical: "Late twilight",
  night: "Night",
};

const CAMERAS: { id: CameraMode; label: string }[] = [
  { id: "follow", label: "Follow" },
  { id: "chase", label: "3D chase cam" },
  { id: "fit", label: "Whole day" },
  { id: "free", label: "Free" },
];

type Props = {
  replay: Replayable | null;
  loading: boolean;
  /** 0–1 while a chase is prepared; null while a day downloads. */
  progress: number | null;
  error: string | null;
  /** A line under the title while extra layers are still arriving. */
  note?: string | null;
  entries: ReplayEntry[];
  onPick: (e: ReplayEntry) => void;
  onBack: () => void;
  backLabel: string;
  /** Admin color overrides (Map & data colors). */
  colors: Colors;
};

/**
 * The replay screen (ported from the Log repo's map page): the day on a MapLibre map with
 * GPU funnels, a synchronized clock at seven speeds, the scrub bar with tornado and warning
 * lanes, live tornado cards, NWS survey reports, optional archived radar and a 3D camera.
 */
export function Replay({
  replay: current,
  loading,
  progress,
  error,
  note,
  entries,
  onPick,
  onBack,
  backLabel,
  colors,
}: Props) {
  // Paint colors are read when the map builds its layers, so set them first.
  useState(() => applyPalette(colors));
  const [camera, setCamera] = useState<CameraMode>("follow");
  const [base, setBase] = useState<BaseStyleId>("dark");
  const [pitch, setPitch] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [sky, setSky] = useState<SkyGrade | null>(null);
  const [visible, setVisible] = useState(defaultLayers);
  const [panel, setPanel] = useState<"none" | "layers" | "view" | "radar">(
    "none",
  );
  const [moment, setMoment] = useState<Moment | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [report, setReport] = useState<number | null>(null);

  // Radar stays empty and silent until someone presses the button.
  const radarRef = useRef<RadarLayer | null>(null);
  const [radar, setRadar] = useState<RadarState>({
    on: false,
    opacity: 0.68,
    loadedAt: null,
    loading: false,
    note: null,
  });

  const [hudRef, hudH] = useMeasuredHeight(210);
  const [cardsRef, cardsH] = useMeasuredHeight(0);
  const [toolRowRef, toolRowH] = useMeasuredHeight(56);

  const window_ = current?.window ?? [0, 1];
  const clock = useClock(window_ as [number, number]);

  const toggleClock = clock.toggle;
  // Esc leaves the replay; space plays and pauses.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [role=listbox]")) return;
      if (e.key === "Escape" && !switcherOpen) onBack();
      if (e.key === " ") {
        e.preventDefault();
        toggleClock();
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onBack, switcherOpen, toggleClock]);

  const fetchRadar = async () => {
    const layer = radarRef.current;
    if (!layer || !current) return;
    const when = current.T0 + clock.at;
    setRadar((r) => ({ ...r, loading: true, note: null }));
    const { tiles, withData } = await layer.load(when);
    setRadar((r) => ({
      ...r,
      loading: false,
      loadedAt: withData ? when : r.loadedAt,
      note:
        withData === 0
          ? `Nothing came back for this moment. ${tiles} tiles were asked for and all were empty: either the archive has no scan here, or there was nothing to see.`
          : `${withData} of ${tiles} tiles carried returns.`,
    }));
  };

  const clearRadar = () => {
    radarRef.current?.clear();
    setRadar((r) => ({ ...r, loadedAt: null, note: null }));
  };

  const moments = useMemo(
    () =>
      current
        ? momentsOf({
            ...current,
            approaches: [],
            crossings: [],
            totalMetres: 0,
            trackPoints: 0,
            strongest: "",
            signature: current.id,
            trackWindow: current.window,
          })
        : [],
    [current],
  );
  const spans = useMemo(
    () => (current ? spansOf({ tornadoes: current.tornadoes } as never) : []),
    [current],
  );

  // Only the stretches the chaser was inside a warning: the lead-time question.
  const warningSpans = useMemo(() => {
    if (!current?.track || current.warnings.length === 0) return [];
    return insideSpans(current.track, current.warnings, current.window).map(
      (s) => ({ from: s.from, to: s.to, kind: s.kind, label: s.label }),
    );
  }, [current]);

  const hiddenCount = (Object.keys(visible) as LayerId[]).filter(
    (k) => !visible[k],
  ).length;

  const here = useMemo(() => {
    const p = current?.track?.positionAt(clock.at);
    if (p) return { lat: p.lat, lon: p.lon };
    const t = current?.tornadoes[0];
    return t
      ? { lat: t.coords[0][1], lon: t.coords[0][0] }
      : { lat: 38.5, lon: -97.5 };
  }, [current, clock.at]);

  const zoneNow = current
    ? readingAt(
        here.lat,
        here.lon,
        current.tz,
        new Date((current.T0 + clock.at) * 1000),
      ).zone
    : "UTC";

  const live = useMemo(
    () => (current ? activeAt(current, clock.at) : []),
    [current, clock.at],
  );

  const toggle = (p: typeof panel) => setPanel((v) => (v === p ? "none" : p));

  return (
    <div
      className="rp"
      style={
        {
          "--w-severe": PAL.warn.severe,
          "--w-tornado": PAL.warn.tornado,
          "--w-emergency": PAL.warn.emergency,
          "--hud-h": `${hudH}px`,
          "--cards-h": `${cardsH}px`,
          "--toolrow-h": `${toolRowH}px`,
        } as React.CSSProperties
      }
    >
      <MapCanvas
        replay={current}
        at={clock.at}
        baseStyle={base}
        camera={camera}
        pitch={pitch}
        bearing={bearing}
        onTilesFailed={() => setTilesFailed(true)}
        onCamera={(v) => {
          setPitch(v.pitch);
          setBearing(v.bearing);
        }}
        onSky={setSky}
        onRadar={(layer) => {
          radarRef.current = layer;
        }}
        visible={visible}
      />

      {loading && (
        <div className="map-loading">
          <span>
            {progress === null
              ? "Loading the day…"
              : `Preparing ${Math.round(progress * 100)}%`}
          </span>
        </div>
      )}
      {error && (
        <div className="map-error" role="alert">
          {error}
        </div>
      )}

      <div className="map-topleft">
        <div className="rp-row">
          <button
            type="button"
            className="rp-back"
            onClick={onBack}
            aria-label={backLabel}
          >
            <span aria-hidden="true">‹</span> {backLabel}
          </button>
          <button
            type="button"
            className="map-switch"
            onClick={() => setSwitcherOpen((v) => !v)}
            aria-expanded={switcherOpen}
          >
            <span className="map-switch-title">
              {current?.title ?? "Choose a day"}
            </span>
            <span className="map-switch-sub">{current?.subtitle ?? ""}</span>
          </button>
        </div>

        {switcherOpen && (
          <Switcher
            entries={entries}
            currentId={current?.id ?? null}
            onPick={(e) => {
              setSwitcherOpen(false);
              onPick(e);
            }}
            onClose={() => setSwitcherOpen(false)}
          />
        )}

        {current?.provenance && (
          <p className="map-provenance">Paths: {current.provenance}</p>
        )}
        {note && <p className="map-provenance">{note}</p>}
        {tilesFailed && (
          <p className="map-provenance">
            Basemap unavailable. The paths and the clock are unaffected.
          </p>
        )}
      </div>

      <div className="map-tools">
        <div className="map-toolhead" ref={toolRowRef}>
          <div
            className="map-tool-group"
            role="group"
            aria-label="Map controls"
          >
            <button
              type="button"
              data-on={panel === "view" ? "" : undefined}
              aria-expanded={panel === "view"}
              onClick={() => toggle("view")}
            >
              View
            </button>
            <button
              type="button"
              data-on={panel === "layers" ? "" : undefined}
              aria-expanded={panel === "layers"}
              onClick={() => toggle("layers")}
            >
              Layers
              {hiddenCount > 0 && (
                <span className="map-badge">{hiddenCount}</span>
              )}
            </button>
            <button
              type="button"
              data-on={panel === "radar" ? "" : undefined}
              aria-expanded={panel === "radar"}
              onClick={() => toggle("radar")}
            >
              Radar
              {radar.loadedAt !== null && (
                <span className="map-badge map-badge-dot" aria-hidden="true" />
              )}
            </button>
          </div>
          {sky && (
            <p className="map-sky" aria-live="polite">
              {SKY_LABEL[sky.phase]} · sun {sky.altitude >= 0 ? "+" : ""}
              {Math.round(sky.altitude)}°
            </p>
          )}
        </div>

        {panel === "view" && (
          <div className="map-panel">
            <h3>Camera</h3>
            <div className="map-chips" role="group" aria-label="Camera">
              {CAMERAS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-on={camera === c.id ? "" : undefined}
                  aria-pressed={camera === c.id}
                  onClick={() => setCamera(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {camera === "chase" && (
              <p className="map-hint">
                Rides low behind{" "}
                {current?.track ? "your car" : "the strongest tornado"}, facing
                the way it is moving.
              </p>
            )}

            <h3>Basemap</h3>
            <div className="map-chips" role="group" aria-label="Basemap">
              {(Object.keys(STYLE_LABELS) as BaseStyleId[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-on={base === s ? "" : undefined}
                  aria-pressed={base === s}
                  onClick={() => setBase(s)}
                >
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>

            <h3>3D</h3>
            <div className="map-chips" role="group" aria-label="3D">
              <button
                type="button"
                onClick={() => {
                  if (camera === "chase") setCamera("follow");
                  setPitch(0);
                  setBearing(0);
                }}
              >
                Level
              </button>
              <button
                type="button"
                onClick={() => {
                  if (camera === "chase") setCamera("follow");
                  setPitch(PRESET_3D.pitch);
                  setBearing(PRESET_3D.bearing);
                }}
              >
                3D view
              </button>
            </div>
            <p className="map-hint">
              Drag with two fingers to tilt, twist to rotate. Tilt{" "}
              {Math.round(pitch)}°, rotate {Math.round(bearing)}°.
            </p>
          </div>
        )}

        {panel === "radar" && (
          <RadarPanel
            state={radar}
            at={current ? current.T0 + clock.at : 0}
            zone={zoneNow}
            onFetch={() => void fetchRadar()}
            onClear={clearRadar}
            onOpacity={(v) => {
              setRadar((r) => ({ ...r, opacity: v }));
              radarRef.current?.setSettings({ opacity: v });
            }}
          />
        )}

        {panel === "layers" && (
          <div className="map-panel">
            <h3>Layers</h3>
            <ul className="map-layers">
              {LAYER_TOGGLES.filter(
                (t) =>
                  (t.id !== "track" && t.id !== "proximity") || current?.track,
              ).map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={visible[t.id]}
                    data-on={visible[t.id] ? "" : undefined}
                    onClick={() =>
                      setVisible((v) => ({ ...v, [t.id]: !v[t.id] }))
                    }
                  >
                    <span className="map-layer-tick" aria-hidden="true" />
                    <span>
                      <span className="map-layer-name">{t.label}</span>
                      <span className="map-layer-blurb">{t.blurb}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 && (
              <button
                type="button"
                className="map-layers-all"
                onClick={() => setVisible(defaultLayers())}
              >
                Turn everything back on
              </button>
            )}
          </div>
        )}
      </div>

      <InfoCards
        onJump={clock.seek}
        hostRef={cardsRef}
        replay={current}
        at={clock.at}
        openReport={report}
        onOpenReport={setReport}
      />

      <SurveyPanel
        replay={current}
        index={report}
        onClose={() => setReport(null)}
      />

      {current && (
        <div className="map-hud" ref={hudRef}>
          <div className="map-hud-top">
            <Clock
              T0={current.T0}
              at={clock.at}
              since={current.window[0]}
              lat={here.lat}
              lon={here.lon}
              declaredZone={current.tz}
              speed={clock.speed}
              paused={!clock.playing}
            />
            <div className="map-hud-now">
              {moment && <span className="map-hud-moment">{moment.label}</span>}
              <span className="map-hud-count">
                {current.tornadoes.length}{" "}
                {current.tornadoes.length === 1 ? "tornado" : "tornadoes"}
                {live.length > 0 ? ` · ${live.length} on the ground` : ""}
              </span>
            </div>
          </div>

          <ScrubBar
            window={current.window}
            at={clock.at}
            onScrub={clock.seek}
            tornadoes={spans}
            moments={moments}
            warnings={warningSpans}
            snapping
            onMoment={setMoment}
          />

          <div className="map-hud-controls">
            <button
              type="button"
              className="map-btn"
              onClick={clock.toggle}
              aria-label={clock.playing ? "Pause" : "Play"}
            >
              {clock.playing ? "❚❚" : "▶"}
            </button>
            <button
              type="button"
              className="map-btn map-btn-small"
              onClick={clock.restart}
              aria-label="Back to the start"
            >
              ↺
            </button>
            <div
              className="map-speeds"
              role="group"
              aria-label="Playback speed"
            >
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-on={clock.speed === s ? "" : undefined}
                  aria-pressed={clock.speed === s}
                  onClick={() => clock.setSpeed(s)}
                  title={SPEED_NOTE[s]}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
