import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  getVersion,
  setWorkerUrl,
  type ErrorEvent,
} from "maplibre-gl";
import { tornadoPositionAt } from "@/features/replay/core/chase";
import { bearing as bearingOf, haversine } from "@/features/replay/core/geo";
import "maplibre-gl/dist/maplibre-gl.css";
import { addLayers, fitTo, updateLayers } from "./layers";
import {
  DEFAULT_FUNNEL_SETTINGS,
  FunnelLayer,
  type FunnelSettings,
} from "./funnels/FunnelLayer";
import { RadarLayer } from "@/features/replay/radar/RadarLayer";
import { BASE_STYLES, type BaseStyleId } from "./styles";
import { boundsOf, type Replayable } from "./replayable";
import { mapLayersFor, type LayerId } from "./layerToggles";
import { skyAt, solarPosition, type SkyGrade } from "./sky";

setWorkerUrl(`/vendor/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);

export type CameraMode = "free" | "follow" | "fit" | "chase";

interface MapCanvasProps {
  replay: Replayable | null;
  at: number;
  baseStyle: BaseStyleId;
  camera: CameraMode;
  /** Set by the 3D controls. */
  pitch?: number;
  bearing?: number;
  /** Reports the camera back, so the controls follow a drag instead of fighting it. */
  onCamera?: (view: { pitch: number; bearing: number }) => void;
  /** The graded sky for this instant, so the interface can name the light. */
  onSky?: (sky: SkyGrade) => void;
  onReady?: (map: MapLibreMap) => void;
  /** Hands the radar layer out once, so the interface can drive it. */
  onRadar?: (layer: RadarLayer) => void;
  /**
   * Photo pins to draw, or nothing.
   *
   * Passed in rather than read from the photo store here, because whether
   * they are shown at all is a setting and the map should not be the thing
   * that knows about it.
   */
  photoPins?: readonly {
    id: string;
    at: number | null;
    lat: number | null;
    lon: number | null;
  }[];
  /** Reports a basemap that could not load, so the interface can say so. */
  onTilesFailed?: () => void;
  /** Every non-mandatory part of the funnels is a setting, like everything else. */
  funnels?: FunnelSettings;
  /** Which data layers the reader has left on. */
  visible?: Record<LayerId, boolean>;
}

/** The steepest tilt MapLibre allows, which is what "any direction" means. */
export const MAX_PITCH = 85;

/**
 * The tilt at which a horizon first appears, measured rather than guessed.
 *
 * MapLibre's default vertical field of view is about 36.9 degrees, so the top
 * edge of the frustum points 18.4 degrees above the camera's own axis. The
 * horizon is 90 degrees from straight down, which puts it on screen only past
 * roughly 71.6 degrees of pitch — confirmed by screenshotting the canvas at
 * 70, 76, 80 and 85 and reading the pixels: at 70 there is a four-pixel sliver
 * of sky, at 76 a band 150 pixels deep.
 *
 * This matters because it is the whole of Z3 #21. A "3D view" below this angle
 * has no sky in it to grade, however steep it feels.
 */
export const HORIZON_PITCH = 72;

export function MapCanvas({
  replay,
  at,
  baseStyle,
  camera,
  pitch = 0,
  bearing = 0,
  onReady,
  onTilesFailed,
  onCamera,
  onSky,
  onRadar,
  photoPins = [],
  funnels = DEFAULT_FUNNEL_SETTINGS,
  visible,
}: MapCanvasProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const onRadarRef = useRef(onRadar);
  useEffect(() => {
    onRadarRef.current = onRadar;
  });
  const loadedFor = useRef<string | null>(null);
  /** Whether follow has framed the subject yet, so it zooms once and no more. */
  const framed = useRef(false);
  /** The instanced funnel layer, kept across style swaps. */
  const funnelLayer = useRef<FunnelLayer | null>(null);
  /**
   * The radar layer, kept across style swaps like the funnels.
   *
   * Created here but silent: it holds no tiles and fetches nothing until
   * something calls `load()`. Existing on the map and having asked anybody
   * for data are different things, which is the whole point of #13.
   */
  const radarLayer = useRef<RadarLayer | null>(null);
  /** Which replay-minute the sky was last graded for. */
  const skyBucket = useRef<number>(NaN);
  const heading = useRef<number>(NaN);
  const chaseFrom = useRef<string | null>(null);
  const zoomTo = useRef<number | null>(null);
  const zoomTarget = (m: MapLibreMap) => {
    const z = zoomTo.current;
    if (z !== null && Math.abs(m.getZoom() - z) < 0.05) zoomTo.current = null;
    return zoomTo.current ?? undefined;
  };
  /**
   * Bumped every time a style settles.
   *
   * `setStyle` throws the sky away with everything else, and the sky is
   * otherwise only recomputed when the clock moves — so swapping the basemap
   * on a paused map lost the light until the reader pressed play. Counting
   * style settlements makes the sky effect re-run on the swap itself.
   */
  const [styleEpoch, setStyleEpoch] = useState(0);
  /**
   * Set when the chosen basemap could not be fetched, so the map falls back to
   * the style that needs no network. Without this the whole map is hostage to
   * the tile server: MapLibre does not fire `load` for a style it could not
   * read, so the data layers never get added and a tile outage shows as a
   * black rectangle rather than a chase with no roads under it.
   */
  const [, setFellBack] = useState(false);

  // --- create once -------------------------------------------------------
  useEffect(() => {
    if (!host.current || map.current) return undefined;

    const m = new MapLibreMap({
      container: host.current,
      // Always the offline style first. A remote style that cannot be
      // fetched never fires `load`, which means the data layers are never
      // added and the whole map is hostage to a tile server — on a chase,
      // being off-network is the normal condition. Starting local guarantees
      // the paths and the clock work, and the basemap upgrades in behind them
      // once it is known to be reachable.
      style: BASE_STYLES.plain,
      center: [-97.5, 38.5],
      zoom: 4,
      attributionControl: { compact: true },
      /**
       * Free flight.
       *
       * `maxPitch` is 60 by default, which is not enough to put a horizon on
       * screen — and without a horizon there is no sky to grade and no
       * distance for the haze to work on. 85 is as far as MapLibre will go and
       * is where a chase actually looks like one: the storm ahead, the road
       * running away underneath, sky above it.
       *
       * Every gesture is left on. Drag pans, right-drag or ctrl-drag rotates
       * and tilts, two fingers do both on a phone, the keyboard does all of it
       * — and none of them is taken away by follow mode, because the reader
       * owning the camera is the point.
       */
      maxPitch: MAX_PITCH,
      dragPan: true,
      dragRotate: true,
      pitchWithRotate: true,
      touchZoomRotate: true,
      touchPitch: true,
      keyboard: true,
      scrollZoom: true,
    });
    map.current = m;

    // `load` is the happy path. `styledata` also fires for a style that
    // arrived in any usable state, and is what makes the data layers appear
    // when only the tiles are missing.
    const markReady = () => {
      setReady(true);
      setStyleEpoch((n) => n + 1);
      onReady?.(m);
    };
    m.on("load", markReady);
    // Fires for every style that settles, including each swap — which is what
    // puts the data layers back after setStyle tears them down.
    m.on("styledata", markReady);

    // A basemap that cannot be reached is the normal condition on a chase, not
    // an error worth a console full of red — the interface says so once and
    // the data layers carry on regardless.
    let reported = false;
    m.on("error", (e: ErrorEvent) => {
      const msg = String(e.error?.message ?? "");
      if (!/tile|source|style|sprite|glyph|fetch|network|load/i.test(msg))
        return;
      if (!reported) {
        reported = true;
        onTilesFailed?.();
      }
      // A style that never arrived leaves the map with nothing to draw on, so
      // swap to the offline one and keep the data.
      if (/style|sprite|glyph/i.test(msg)) setFellBack(true);
    });

    /**
     * Report the camera back whenever the reader moves it.
     *
     * Without this the tilt and rotate controls are write-only: drag the map
     * to 40 degrees, and the slider still says 0, so the next nudge snaps the
     * camera back to where the slider thinks it is. A control that lies about
     * the thing it controls is worse than no control.
     */
    const report = () =>
      onCamera?.({ pitch: m.getPitch(), bearing: m.getBearing() });
    m.on("pitchend", report);
    m.on("rotateend", report);

    return () => {
      m.remove();
      map.current = null;
      setReady(false);
    };
    // Created once on purpose; style and data changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- style swaps keep the data ------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;

    const wanted = BASE_STYLES[baseStyle];
    // The offline style needs no checking and no network.
    if (typeof wanted !== "string") {
      m.setStyle(wanted);
      return undefined;
    }

    // Probe the style before handing it to MapLibre: a failed setStyle leaves
    // the map with nothing to draw on, and there is no way back from it.
    let cancelled = false;
    fetch(wanted, { method: "GET" })
      .then((res) => {
        if (cancelled || !res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((style) => {
        if (cancelled) return;
        setFellBack(false);
        m.setStyle(style);

        /**
         * Watchdog.
         *
         * Fetching the style JSON only proves the JSON is reachable. If its
         * sprite or glyphs are not, MapLibre never finishes loading the style
         * — and an unloaded style renders NOTHING, including layers that are
         * entirely local. The basemap silently takes the chase down with it.
         *
         * So if the style has not settled shortly after the swap, go back to
         * the one that cannot fail. The paths matter; the roads under them do
         * not matter nearly as much.
         */
        window.setTimeout(() => {
          if (cancelled || !map.current) return;
          if (!map.current.isStyleLoaded()) {
            map.current.setStyle(BASE_STYLES.plain);
            setFellBack(true);
            onTilesFailed?.();
          }
        }, 6000);
      })
      .catch(() => {
        if (cancelled) return;
        // Stay on the style already showing, and say so once.
        setFellBack(true);
        onTilesFailed?.();
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStyle]);

  // --- data ---------------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !replay) return;
    // addLayers is idempotent, so calling it on every data tick costs a few
    // map lookups and guarantees the layers exist after any style change.
    addLayers(m, replay);

    // The funnels sit above the swaths and paths they belong to. Re-added
    // after a style swap like everything else.
    if (!funnelLayer.current) {
      funnelLayer.current = new FunnelLayer();
      // Dev only — see the note on the map handle in MapPage.
    }
    if (!m.getLayer("funnels")) {
      try {
        m.addLayer(funnelLayer.current);
      } catch {
        /* a style still settling; the next tick adds it */
      }
    }

    /*
     * Radar goes *under* everything the survey drew.
     *
     * The tornado paths, the damage and the track are the subject; the radar
     * is the weather they happened in. Drawn over them it would hide the
     * damage points under the very core that caused them.
     */
    if (!radarLayer.current) {
      radarLayer.current = new RadarLayer();
      onRadarRef.current?.(radarLayer.current);
    }
    if (!m.getLayer("radar")) {
      try {
        const under = m.getLayer("warn-fill") ? "warn-fill" : undefined;
        m.addLayer(radarLayer.current, under);
      } catch {
        /* a style still settling; the next tick adds it */
      }
    }
    /*
     * A hidden funnel layer is disabled, not merely invisible.
     *
     * `visibility: none` on a custom layer does not stop MapLibre calling its
     * render method — the draw call still happens and the instance buffer is
     * still built. For a raymarched volume that is the most expensive thing on
     * the map, so turning it off has to actually turn it off.
     */
    const funnelsOn = visible?.funnels !== false;
    funnelLayer.current.setFrame(
      replay.tornadoes,
      at,
      funnelsOn ? funnels : { ...funnels, enabled: false },
    );

    if (loadedFor.current !== replay.id) {
      const b = boundsOf(replay);
      if (b) fitTo(m, b);
      loadedFor.current = replay.id;
      framed.current = false;
    }
    updateLayers(m, replay, at, photoPins);
  }, [ready, replay, at, funnels, visible, photoPins]);

  /**
   * Apply the reader's layer choices.
   *
   * Runs after `addLayers` so a layer added this tick is hidden on the same
   * tick rather than flashing on for a frame. Wrapped because a style swap can
   * remove a layer between the check and the call.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !visible) return;
    for (const [id, on] of Object.entries(visible)) {
      for (const layer of mapLayersFor(id as LayerId)) {
        if (!m.getLayer(layer)) continue;
        try {
          m.setLayoutProperty(layer, "visibility", on ? "visible" : "none");
        } catch {
          /* the style is mid-swap; the next tick re-applies */
        }
      }
    }
  }, [visible, ready, replay, at]);

  // --- camera -------------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !replay) return;

    if (camera === "chase") {
      // Entering the chase cam frames close in once, even straight from Follow.
      if (chaseFrom.current !== replay.id) {
        chaseFrom.current = replay.id;
        framed.current = false;
      }
      // The 3D chase camera: low behind the chaser (or the strongest tornado on an archive
      // day), looking the way it is travelling, turning smoothly with the road.
      let from: [number, number] | null = null;
      let to: [number, number] | null = null;
      const here = replay.track?.positionAt(at);
      const next = replay.track?.positionAt(at + 45);
      if (here && next) {
        from = [here.lat, here.lon];
        to = [next.lat, next.lon];
      } else {
        const live = replay.tornadoes.filter(
          (t) => at >= t.start && at <= t.end,
        );
        if (live.length) {
          const t = live.reduce((a, b) => (a.widthYd >= b.widthYd ? a : b));
          from = tornadoPositionAt(t, at);
          to = tornadoPositionAt(t, Math.min(t.end, at + 90));
        }
      }
      if (!from || !to) return;
      if (haversine(from[0], from[1], to[0], to[1]) > 20) {
        const want = bearingOf(from[0], from[1], to[0], to[1]);
        const prev = Number.isFinite(heading.current) ? heading.current : want;
        const d = ((want - prev + 540) % 360) - 180;
        heading.current = (prev + d * 0.12 + 360) % 360;
      }
      if (!framed.current) zoomTo.current = Math.max(m.getZoom(), 12);
      framed.current = true;
      const zoom = zoomTarget(m);
      m.easeTo({
        center: [from[1], from[0]],
        bearing: Number.isFinite(heading.current)
          ? heading.current
          : m.getBearing(),
        pitch: 72,
        ...(zoom === undefined ? {} : { zoom }),
        duration: 140,
        essential: true,
      });
      return;
    }

    if (camera === "follow") {
      /**
       * Follow centres every frame but must only zoom once.
       *
       * Setting zoom on every tick fights the reader's own pinch and scroll;
       * never setting it leaves the camera at whatever the last fit chose,
       * which after a whole-chase fit is far too wide to see anything. So the
       * first frame of a follow frames the subject, and after that the reader
       * owns the zoom.
       */
      const FOLLOW_ZOOM = 10.5;
      const zoomNow = m.getZoom();
      if (!framed.current) zoomTo.current = Math.max(zoomNow, FOLLOW_ZOOM);
      framed.current = true;
      // The framing zoom rides along on every frame until it lands, since each frame's
      // ease replaces the last one and would otherwise cut the zoom short while playing.
      const zoom = zoomTarget(m);

      /**
       * Follow moves the centre and nothing else.
       *
       * It used to set pitch and bearing every frame too, which made free
       * flight a lie: tilt the map while following and the next tick of the
       * clock snapped it back. Following is about where the camera is
       * pointed, not how — so the reader keeps the tilt and the rotation they
       * chose, and follow only keeps the chaser in the middle of it.
       */
      const here = replay.track?.positionAt(at);
      if (here) {
        m.easeTo({
          center: [here.lon, here.lat],
          ...(zoom === undefined ? {} : { zoom }),
          // Short, because this runs every frame the clock moves.
          duration: 120,
          essential: true,
        });
        return;
      }
      // An archive day has no chaser, so follow the strongest tornado on the
      // ground instead of refusing to follow anything.
      const live = replay.tornadoes.filter((t) => at >= t.start && at <= t.end);
      if (live.length > 0) {
        const strongest = live.reduce((a, b) =>
          a.widthYd >= b.widthYd ? a : b,
        );
        const span = Math.max(1, strongest.end - strongest.start);
        const f = Math.min(1, Math.max(0, (at - strongest.start) / span));
        const i = Math.min(
          strongest.coords.length - 1,
          Math.floor(f * (strongest.coords.length - 1)),
        );
        const [lon, lat] = strongest.coords[i]!;
        m.easeTo({
          center: [lon, lat],
          ...(zoom === undefined ? {} : { zoom }),
          duration: 120,
          essential: true,
        });
      }
    }
  }, [camera, at, ready, replay]);

  // --- 3D, when the camera is not driving it ------------------------------
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (camera !== "chase") chaseFrom.current = null;
    if (camera === "follow" || camera === "chase") {
      heading.current = NaN;
      return;
    }
    framed.current = false;
    if (camera === "fit" && replay) {
      const b = boundsOf(replay);
      if (b) fitTo(m, b);
    }
  }, [camera, ready, replay]);

  /**
   * The tilt and rotate controls, in every camera mode.
   *
   * Follow no longer owns the angle, so the controls work while following —
   * which is what "GPS follow optional, not mandatory" has to mean in
   * practice: the reader can ride along behind the chaser at 70 degrees of
   * tilt, or stop following and fly, and neither choice takes the other away.
   *
   * Guarded on an actual difference, because this effect also fires after the
   * reader drags the map (the drag reports the new angle, which updates the
   * prop, which re-runs this) and easing to where the camera already is would
   * stutter every rotate gesture.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || camera === "chase") return;
    const dp = Math.abs(m.getPitch() - pitch);
    const db = Math.abs(((m.getBearing() - bearing + 540) % 360) - 180);
    if (dp < 0.5 && db < 0.5) return;
    m.easeTo({ pitch, bearing, duration: 300 });
  }, [pitch, bearing, ready, camera]);

  /**
   * The sky, graded to the chase's own time of day (Z3 #21) and carrying the
   * distance haze with it (Z3 #20).
   *
   * Recomputed on a coarse bucket rather than every frame: the sun moves a
   * quarter of a degree a minute, so a sky per replay-minute is already finer
   * than anyone can see, and at 64x that is still only one `setSky` a second.
   * A style swap throws the sky away, so `baseStyle` is a dependency too.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !replay) return;

    const bucket = Math.floor(at / 60) + styleEpoch * 1e6;
    if (bucket === skyBucket.current) return;
    skyBucket.current = bucket;

    const here = replay.track?.positionAt(at);
    const centre = m.getCenter();
    const lat = here?.lat ?? centre.lat;
    const lon = here?.lon ?? centre.lng;

    const grade = skyAt(replay.T0 + at, lat, lon);
    try {
      m.setSky({
        "sky-color": grade["sky-color"],
        "horizon-color": grade["horizon-color"],
        "fog-color": grade["fog-color"],
        "sky-horizon-blend": grade["sky-horizon-blend"],
        "horizon-fog-blend": grade["horizon-fog-blend"],
        "fog-ground-blend": grade["fog-ground-blend"],
        "atmosphere-blend": grade["atmosphere-blend"],
      });
    } catch {
      /* a style mid-swap; the next bucket sets it */
    }

    // The funnels are lit by the same sky they hang from — the cloud base they
    // are made of, and the sun that is actually on them.
    funnelLayer.current?.setCloud(grade.cloud);
    const sun = solarPosition(replay.T0 + at, lat, lon);
    funnelLayer.current?.setSun(sun.azimuth, sun.altitude, m.getBearing());
    onSky?.(grade);
    // `onSky` is a callback the caller may redefine each render; depending on
    // it would recompute the sky every frame for no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, replay, at, styleEpoch]);

  return <div className="map-gl" ref={host} />;
}
