import { useEffect, useRef, useState } from "react";
import {
  LngLat,
  Map as MapLibreMap,
  Popup,
  getVersion,
  setWorkerUrl,
  type ErrorEvent,
  type StyleSpecification,
} from "maplibre-gl";
import { tornadoPositionAt } from "@/features/replay/core/chase";
import { bearing as bearingOf, haversine } from "@/features/replay/core/geo";
import "maplibre-gl/dist/maplibre-gl.css";
import { ReplayLayers, fitTo } from "./layers";
import { glide, stormBounds } from "./stormCamera";
import { mercatorX, mercatorY } from "./funnels/mercator";
import {
  DEFAULT_FUNNEL_SETTINGS,
  FunnelLayer,
  type FunnelSettings,
} from "./funnels/FunnelLayer";
import { IconLayer } from "./funnels/IconLayer";
import { RadarLayer } from "@/features/replay/radar/RadarLayer";
import { SiteRadarLayer } from "@/features/replay/radar/SiteRadarLayer";
import { BASE_STYLES, STYLE_TRANSFORMS, type BaseStyleId } from "./styles";
import { boundsOf, type Replayable } from "./replayable";
import { mapLayersFor, type LayerId } from "./layerToggles";
import { skyAt, solarPosition, type SkyGrade } from "./sky";
import { pick as pickMark, TAPPABLE } from "./popups";

setWorkerUrl(`/vendor/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);

/**
 * `storm` is the overhead camera that follows the tornadoes on the ground
 * (#4) — the default for archive days, where there is no chaser to follow.
 * `chase` is the 3D camera riding behind the chaser.
 */
export type CameraMode = "free" | "follow" | "fit" | "storm" | "chase";

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
  /** Hands the radar layers out once, so the interface can drive them: the national mosaic, and one radar's own scan (#7). */
  onRadar?: (mosaic: RadarLayer, site: SiteRadarLayer) => void;
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
  /**
   * How much of each edge the interface covers, in pixels, so the storm
   * camera frames the tornadoes in the part of the map that can be seen.
   */
  insets?: { top: number; right: number; bottom: number; left: number };
  /**
   * The reader panned or zoomed while the storm camera was driving. The
   * camera stops at once — fighting a hand on the map is the worst thing a
   * camera can do — and the interface offers the way back.
   */
  onTakeover?: () => void;
  /**
   * Where to open, when this map replaces one that died (#6). Given, the map
   * opens exactly there instead of fitting the replay.
   */
  initialView?: MapView;
  /**
   * The browser took the map's GPU context away — phones do this under memory
   * pressure and when the app is backgrounded — and a map without one draws
   * nothing, ever again. Reports the view so the page can put a fresh map in
   * its place, looking at the same thing.
   */
  onContextLost?: (view: MapView) => void;
  /** A basemap that had failed has come back. */
  onTilesRecovered?: () => void;
  /**
   * The closest zoom radar still reads at while it is on the map (Fix It List #36, 10):
   * at the storm camera's street-level ceiling a 1 km mosaic cell fills a phone screen and
   * the storm turns into smeared color. Null when no radar is drawn.
   */
  radarZoom?: number | null;
}

export interface MapView {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * The storm camera's zoom range. The ceiling is what keeps a single tornado
 * in its surroundings — a few miles of country either side — rather than
 * filling the screen; the floor keeps a sprawling outbreak on the map.
 */
const STORM_MAX_ZOOM = 12.2;
const STORM_MIN_ZOOM = 5.5;

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
  insets,
  onTakeover,
  initialView,
  onContextLost,
  onTilesRecovered,
  radarZoom = null,
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
  /** Where the storm camera is gliding to, and what it needs to know about the moment. */
  const stormTarget = useRef<{ center: [number, number]; zoom: number } | null>(
    null,
  );
  const cameraRef = useRef(camera);
  const takeoverRef = useRef(onTakeover);
  const contextLostRef = useRef(onContextLost);
  useEffect(() => {
    cameraRef.current = camera;
    takeoverRef.current = onTakeover;
    contextLostRef.current = onContextLost;
  });
  /** The instanced funnel layer, kept across style swaps. */
  const funnelLayer = useRef<FunnelLayer | null>(null);
  /** The spinning icon on the ground under each funnel (#5), likewise. */
  const iconLayer = useRef<IconLayer | null>(null);
  /**
   * The radar layer, kept across style swaps like the funnels.
   *
   * Created here but silent: it holds no tiles and fetches nothing until
   * something calls `load()`. Existing on the map and having asked anybody
   * for data are different things, which is the whole point of #13.
   */
  const radarLayer = useRef<RadarLayer | null>(null);
  const siteLayer = useRef<SiteRadarLayer | null>(null);
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
  /** The same count, readable from a timer without a stale closure. */
  const epochRef = useRef(0);
  /** The replay's layers on this map: data once, frames cheaply. */
  const layers = useRef<ReplayLayers | null>(null);
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
      center: initialView?.center ?? [-97.5, 38.5],
      zoom: initialView?.zoom ?? 4,
      pitch: initialView?.pitch ?? 0,
      bearing: initialView?.bearing ?? 0,
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
    // A replacement map keeps the view it was handed rather than refitting.
    if (initialView && replay) loadedFor.current = replay.id;

    layers.current = new ReplayLayers(m);

    /**
     * A style has settled — the first one, or a basemap swap.
     *
     * This used to listen to `styledata`, which MapLibre fires after *every*
     * change to the style: each added layer, each layout property. Every one
     * of those counted as "a new style", re-ran the data effect and re-set
     * every source, so the map spent its time reloading data it already had.
     * `style.load` fires once per style, including after a diffed swap, which
     * is the only moment the data layers actually need putting back.
     */
    const markReady = () => {
      epochRef.current += 1;
      setReady(true);
      setStyleEpoch(epochRef.current);
      onReady?.(m);
    };
    m.on("style.load", markReady);

    // A basemap that cannot be reached is the normal condition on a chase, not
    // an error worth a console full of red — the interface says so once and
    // the data layers carry on regardless.
    let reported = false;
    /*
     * Tile failures are counted, not announced one by one.
     *
     * A single road tile that times out is routine — the next pan fetches it
     * again — and announcing "basemap unavailable" for it put a false alarm
     * on a map that was plainly drawing its roads. The notice goes up when
     * the style itself cannot be had, or when tiles are failing wholesale.
     */
    let tileErrors = 0;
    let tileErrorsFrom = performance.now();
    m.on("error", (e: ErrorEvent) => {
      const msg = String(e.error?.message ?? "");
      if (/style|sprite|glyph/i.test(msg)) {
        if (!reported) {
          reported = true;
          onTilesFailed?.();
        }
        // A style that never arrived leaves the map with nothing to draw on,
        // so swap to the offline one and keep the data.
        setFellBack(true);
        return;
      }
      if (!/tile|source|fetch|network|load/i.test(msg)) return;
      const now = performance.now();
      if (now - tileErrorsFrom > 30_000) {
        tileErrors = 0;
        tileErrorsFrom = now;
      }
      tileErrors += 1;
      if (tileErrors >= 25 && !reported) {
        reported = true;
        onTilesFailed?.();
      }
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

    /*
     * A lost GPU context (#6).
     *
     * One of the ways the map "disappeared out of nowhere": the browser drops
     * the WebGL context — on a phone under memory pressure, loading a big
     * chase, or after the app has sat in the background — and every draw
     * after that is a no-op. Nothing errors; the canvas just stays empty
     * until something remounts it, which is why switching pages brought it
     * back. The page now does that itself, on the same view.
     */
    let lostReported = false;
    const lost = () => {
      // MapLibre drops its style on a lost context, but a frame it had
      // already queued still runs and trips over the missing style. Cancel it;
      // with no style it queues no more, and this map is being replaced.
      const pending = m as unknown as {
        _frameRequest?: AbortController | null;
      };
      pending._frameRequest?.abort();
      pending._frameRequest = null;
      if (lostReported) return;
      lostReported = true;
      const c = m.getCenter();
      contextLostRef.current?.({
        center: [c.lng, c.lat],
        zoom: m.getZoom(),
        pitch: m.getPitch(),
        bearing: m.getBearing(),
      });
    };
    m.on("webglcontextlost", lost);
    // Back from the background: the context may have gone without saying so.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const gl = (
        m as unknown as {
          painter?: { context?: { gl?: WebGLRenderingContext } };
        }
      ).painter?.context?.gl;
      if (gl?.isContextLost?.()) {
        lost();
        return;
      }
      m.resize();
      m.triggerRepaint();
    };
    document.addEventListener("visibilitychange", onVisible);

    // A hand on the map ends any camera that is driving (storm, follow, the 3D chase
    // cam): the camera is always free to take, in 3D too. Only real input has an
    // originalEvent; the camera's own moves do not, so it never takes over from
    // itself. On the storm camera, tilting and turning are allowed — they change how
    // the storms are seen, not which part of the map is shown.
    const takeover = (e: { originalEvent?: unknown; type?: string }) => {
      const c = cameraRef.current;
      if (!e.originalEvent || c === "free" || c === "fit") return;
      if (
        c === "storm" &&
        (e.type === "rotatestart" || e.type === "pitchstart")
      )
        return;
      takeoverRef.current?.();
    };
    m.on("dragstart", takeover);
    m.on("zoomstart", takeover);
    m.on("rotatestart", takeover);
    m.on("pitchstart", takeover);

    // A tap on a mark says what it is (#17): a short label, never a page of detail.
    const popup = new Popup({
      className: "rp-pop",
      closeButton: true,
      closeOnClick: true,
      maxWidth: "250px",
      offset: 12,
    });
    const tappable = () => TAPPABLE.filter((id) => m.getLayer(id));
    const onTap = (e: { point: { x: number; y: number }; lngLat: LngLat }) => {
      const r = 14;
      const hits = m.queryRenderedFeatures(
        [
          [e.point.x - r, e.point.y - r],
          [e.point.x + r, e.point.y + r],
        ],
        { layers: tappable() },
      );
      const label = pickMark(hits);
      if (!label) return popup.remove();
      const el = document.createElement("div");
      const b = document.createElement("b");
      b.textContent = label.title;
      el.append(b);
      if (label.line) {
        const sm = document.createElement("small");
        sm.textContent = label.line;
        el.append(sm);
      }
      popup.setLngLat(e.lngLat).setDOMContent(el).addTo(m);
    };
    m.on("click", onTap);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      m.remove();
      map.current = null;
      layers.current = null;
      setReady(false);
    };
    // Created once on purpose; style and data changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- style swaps keep the data ------------------------------------------
  /*
   * Fetch the chosen basemap, apply it, and make sure it arrived.
   *
   * A basemap that cannot be had leaves the replay on the offline Plain style
   * — the paths, the damage and the clock carry on — and is tried again: after
   * 15 s, 45 s, 2 and 5 minutes, and at once when the connection comes back or
   * the app returns to the foreground. It used to give up on the first
   * failure and stay on Plain until the page was left and re-entered, which
   * on a slow phone connection was the map "disappearing" (#6): a style that
   * took more than eight seconds to settle was thrown away for good.
   */
  useEffect(() => {
    const m = map.current;
    if (!m) return undefined;

    const wanted = BASE_STYLES[baseStyle];
    // The offline style needs no checking and no network.
    if (typeof wanted !== "string") {
      m.setStyle(wanted);
      return undefined;
    }

    let cancelled = false;
    let failed = false;
    let attempt = 0;
    let retry: number | undefined;
    let watchdog: number | undefined;
    const BACKOFF = [15_000, 45_000, 120_000, 300_000];

    /**
     * @param stuck the style was applied but never settled. An unsettled style
     *   draws nothing at all — the data layers included — so the map goes to
     *   the offline style. A style that could not even be fetched was never
     *   applied, and the map keeps whatever it was already showing.
     */
    const fail = (stuck: boolean) => {
      if (cancelled) return;
      if (stuck && map.current) map.current.setStyle(BASE_STYLES.plain);
      if (!failed) {
        failed = true;
        setFellBack(true);
        onTilesFailed?.();
      }
      window.clearTimeout(retry);
      retry = window.setTimeout(
        load,
        BACKOFF[Math.min(attempt, BACKOFF.length - 1)],
      );
      attempt += 1;
    };

    function load() {
      if (cancelled || !map.current) return;
      window.clearTimeout(retry);
      fetch(wanted as string, { method: "GET" })
        .then((res) => {
          if (cancelled || !res.ok) throw new Error(String(res.status));
          return res.json();
        })
        .then((fetched) => {
          if (cancelled || !map.current) return;
          const transform = STYLE_TRANSFORMS[baseStyle];
          const style = transform
            ? transform(fetched as StyleSpecification)
            : fetched;
          // Taken before the swap: a diffed swap can settle synchronously.
          const before = epochRef.current;
          map.current.setStyle(style);
          /*
           * Watchdog. Fetching the JSON only proves the JSON is reachable; a
           * style whose sprite or glyphs never arrive never finishes loading.
           * Judged by whether the style itself arrived — not isStyleLoaded(),
           * which is false whenever any tile is in flight, and during playback
           * one always is.
           */
          window.clearTimeout(watchdog);
          watchdog = window.setTimeout(() => {
            if (cancelled || !map.current) return;
            let showing: string | undefined;
            try {
              showing = map.current.getStyle()?.name;
            } catch {
              showing = undefined;
            }
            const arrived =
              epochRef.current !== before ||
              (showing !== undefined &&
                showing === (style as { name?: string }).name);
            if (!arrived) {
              fail(true);
              return;
            }
            if (failed) {
              failed = false;
              attempt = 0;
              setFellBack(false);
              onTilesRecovered?.();
            }
          }, 15_000);
        })
        .catch(() => fail(false));
    }

    const now = () => {
      if (failed && !cancelled) {
        attempt = 0;
        load();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") now();
    };
    window.addEventListener("online", now);
    document.addEventListener("visibilitychange", onVisible);
    load();

    return () => {
      cancelled = true;
      window.clearTimeout(retry);
      window.clearTimeout(watchdog);
      window.removeEventListener("online", now);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseStyle]);

  /**
   * Put the custom layers on the map and keep them in their places.
   *
   * The funnels float above everything the survey drew; the radar sits under
   * all of it. A diffed basemap swap keeps custom layers but re-adds the data
   * layers above them, which would bury the funnels under their own damage
   * points — so the order is re-asserted every time data is attached.
   */
  const placeCustomLayers = (m: MapLibreMap) => {
    if (!funnelLayer.current) {
      funnelLayer.current = new FunnelLayer();
      // Dev only — see the note on the map handle in MapPage.
    }
    if (!iconLayer.current) iconLayer.current = new IconLayer();
    try {
      if (!m.getLayer("funnels")) m.addLayer(funnelLayer.current);
      else m.moveLayer("funnels");
      // The icon lies on the ground, so it goes directly under the funnels:
      // a funnel stands on its own swirl.
      if (!m.getLayer("tornado-icons"))
        m.addLayer(iconLayer.current, "funnels");
      else m.moveLayer("tornado-icons", "funnels");
    } catch {
      /* a style still settling; the next attach adds it */
    }

    /*
     * Radar goes *under* everything the survey drew.
     *
     * The tornado paths, the damage and the track are the subject; the radar
     * is the weather they happened in. Drawn over them it would hide the
     * damage points under the very core that caused them.
     */
    if (!radarLayer.current || !siteLayer.current) {
      radarLayer.current = new RadarLayer();
      siteLayer.current = new SiteRadarLayer();
      onRadarRef.current?.(radarLayer.current, siteLayer.current);
    }
    try {
      const under = m.getLayer("warn-fill") ? "warn-fill" : undefined;
      if (!m.getLayer("radar")) m.addLayer(radarLayer.current, under);
      else if (under) m.moveLayer("radar", under);
      if (!m.getLayer("radar-site")) m.addLayer(siteLayer.current, under);
      else if (under) m.moveLayer("radar-site", under);
    } catch {
      /* a style still settling; the next attach adds it */
    }
  };

  // --- data: once per replay, and again after a basemap swap --------------
  useEffect(() => {
    const m = map.current;
    const l = layers.current;
    if (!m || !l || !ready || !replay) return;
    try {
      l.attach(replay, photoPins);
    } catch {
      // A style mid-swap; `style.load` bumps the epoch and this runs again.
      return;
    }
    placeCustomLayers(m);

    if (loadedFor.current !== replay.id) {
      const b = boundsOf(replay);
      if (b) fitTo(m, b);
      loadedFor.current = replay.id;
      framed.current = false;
    }
    l.frame(at, photoPins);
    // `at` and the pins are deliberately absent: they are per-frame and are
    // handled below. This effect is the expensive one and runs rarely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, replay, styleEpoch]);

  // --- data: per frame ----------------------------------------------------
  useEffect(() => {
    const m = map.current;
    const l = layers.current;
    if (!m || !l || !ready || !replay) return;

    // Self-heal. If the sources have gone — a style swap that did not
    // announce itself — put the replay back rather than drawing into nothing.
    if (!l.present()) {
      try {
        l.attach(replay, photoPins);
        placeCustomLayers(m);
      } catch {
        return;
      }
    }
    l.frame(at, photoPins);

    /*
     * A hidden funnel layer is disabled, not merely invisible.
     *
     * `visibility: none` on a custom layer does not stop MapLibre calling its
     * render method — the draw call still happens and the instance buffer is
     * still built. For a raymarched volume that is the most expensive thing on
     * the map, so turning it off has to actually turn it off.
     */
    const funnelsOn = visible?.funnels !== false;
    funnelLayer.current?.setFrame(
      replay.tornadoes,
      at,
      funnelsOn ? funnels : { ...funnels, enabled: false },
    );
    iconLayer.current?.setFrame(replay.tornadoes, at, funnelsOn);
  }, [ready, replay, at, funnels, visible, photoPins]);

  /**
   * Apply the reader's layer choices.
   *
   * Runs after the data effects so a layer added this tick is hidden on the
   * same tick rather than flashing on for a frame. Wrapped because a style
   * swap can remove a layer between the check and the call. Not per frame:
   * the choices only change when the reader changes them or a swap re-adds
   * the layers.
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
  }, [visible, ready, replay, styleEpoch]);

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
        const [lat, lon] = tornadoPositionAt(strongest, at);
        m.easeTo({
          center: [lon, lat],
          ...(zoom === undefined ? {} : { zoom }),
          duration: 120,
          essential: true,
        });
      }
    }
  }, [camera, at, ready, replay]);

  // --- the storm camera (#4) ------------------------------------------------
  /*
   * The target, recomputed whenever the moment or the frame changes: every
   * tornado on the ground and where it is heading, fitted inside the part of
   * the map the interface leaves visible, never closer than STORM_MAX_ZOOM.
   * With nothing to frame the old target stands, so the camera holds.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !replay || camera !== "storm") {
      stormTarget.current = null;
      return;
    }
    const b = stormBounds(replay.tornadoes, at);
    if (!b) return;
    const W = m.getCanvas().clientWidth || 1;
    const H = m.getCanvas().clientHeight || 1;
    const pad = insets ?? { top: 80, right: 40, bottom: 200, left: 40 };
    // cameraForBounds gives up on padding larger than the canvas; keep it sane.
    // Never more than leaves a usable window: at least a fifth of the height
    // and a third of the width stay for the frame, however crowded the screen.
    const vert =
      Math.min(pad.top + pad.bottom + 48, H * 0.8) /
      Math.max(1, pad.top + pad.bottom + 48);
    const horiz =
      Math.min(pad.left + pad.right + 48, W * 0.66) /
      Math.max(1, pad.left + pad.right + 48);
    const padding = {
      top: (pad.top + 24) * vert,
      bottom: (pad.bottom + 24) * vert,
      left: (pad.left + 24) * horiz,
      right: (pad.right + 24) * horiz,
    };
    const ceiling = Math.max(
      STORM_MIN_ZOOM,
      Math.min(STORM_MAX_ZOOM, radarZoom ?? STORM_MAX_ZOOM),
    );
    let cam;
    try {
      cam = m.cameraForBounds(b, {
        padding,
        maxZoom: ceiling,
        bearing: m.getBearing(),
      });
    } catch {
      cam = undefined;
    }
    if (!cam?.center) return;
    const c = LngLat.convert(cam.center);
    stormTarget.current = {
      center: [c.lng, c.lat],
      zoom: Math.min(
        ceiling,
        Math.max(STORM_MIN_ZOOM, cam.zoom ?? m.getZoom()),
      ),
    };
  }, [camera, at, ready, replay, insets, radarZoom]);

  // Radar switched on while the map is closer than radar reads: pull back once, whatever
  // the camera, so the storm is drawn as a storm. A reader can still zoom in after.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || radarZoom == null) return;
    if (m.getZoom() > radarZoom + 0.3)
      m.easeTo({ zoom: radarZoom, duration: 900, essential: true });
  }, [ready, radarZoom]);

  /*
   * The glide: every frame, a fraction of the way to the target, by real time.
   * Tornadoes touching down and lifting move the target in steps; this turns
   * the steps into one continuous camera move, the same at 1x and 750x. A
   * target more than a couple of screens away is flown to instead. It stands
   * still while the reader is tilting or turning, so it never fights a gesture.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || camera !== "storm") return undefined;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = stormTarget.current;
      if (t && !m.isMoving()) {
        const c = m.getCenter();
        const z = m.getZoom();
        const x0 = mercatorX(c.lng),
          y0 = mercatorY(c.lat);
        const x1 = mercatorX(t.center[0]),
          y1 = mercatorY(t.center[1]);
        const px = Math.hypot(x1 - x0, y1 - y0) * 512 * 2 ** z;
        const dz = t.zoom - z;
        const W = m.getCanvas().clientWidth || 1;
        const H = m.getCanvas().clientHeight || 1;
        if (px > 2.5 * Math.max(W, H)) {
          m.flyTo({
            center: t.center,
            zoom: t.zoom,
            duration: 1400,
            essential: true,
          });
        } else if (px > 0.25 || Math.abs(dz) > 0.002) {
          const k = glide(dt);
          const x = x0 + (x1 - x0) * k;
          const y = y0 + (y1 - y0) * k;
          m.jumpTo({
            center: [
              x * 360 - 180,
              (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
            ],
            zoom: z + dz * k,
          });
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [camera, ready]);

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
    funnelLayer.current?.setSun(sun.azimuth, sun.altitude);
    onSky?.(grade);
    // `onSky` is a callback the caller may redefine each render; depending on
    // it would recompute the sky every frame for no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, replay, at, styleEpoch]);

  return <div className="map-gl" ref={host} />;
}
