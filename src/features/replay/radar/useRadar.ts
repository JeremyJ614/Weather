import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  tornadoPositionAt,
  type PreparedTornado,
} from "@/features/replay/core/chase";
import { tornadoesInFrame } from "@/features/replay/map/stormCamera";
import type { RadarLayer } from "./RadarLayer";
import type { SiteProduct, SiteRadarLayer } from "./SiteRadarLayer";
import { MOMENT_OF } from "./SiteRadarLayer";
import { INITIAL_RADAR, readsSite, type RadarState } from "./RadarPanel";
import { NoScan, scanFor, volumeFor, type SiteScan } from "./level2/scan";
import { nearestSites, siteById } from "./level2/sites";
import { stormMotion, tornadoLabel } from "./motion";
import { snapToScan, type RadarProductId } from "./source";

const SITE_PRODUCT: Record<RadarProductId, SiteProduct> = {
  reflectivity: "ref",
  velocity: "vel",
  srv: "srv",
  cc: "cc",
};

const MISSING: Record<SiteProduct, string> = {
  ref: "This scan carried no reflectivity.",
  vel: "This scan carried no velocity.",
  srv: "This scan carried no velocity.",
  cc:
    "This radar did not measure correlation yet — the network gained it with the dual-polarisation " +
    "upgrade of 2011 to 2013.",
};

/**
 * Everything the radar button does, kept out of the map page.
 *
 * Two layers sit on the map from the start and hold nothing: the national
 * mosaic and one radar's own scan (#7). What is drawn, from which radar, and
 * when to fetch the next scan all live here.
 */
export function useRadar({
  replay,
  at,
  mapRef,
}: {
  replay: { T0: number; tornadoes: PreparedTornado[] } | null;
  /** Seconds from the replay's T0. */
  at: number;
  mapRef: RefObject<MapLibreMap | null>;
}) {
  const mosaic = useRef<RadarLayer | null>(null);
  const site = useRef<SiteRadarLayer | null>(null);
  const scanRef = useRef<SiteScan | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const [state, setState] = useState<RadarState>(INITIAL_RADAR);
  const stateRef = useRef(state);
  stateRef.current = state;
  const epoch = replay ? replay.T0 + at : null;
  const epochRef = useRef(epoch);
  epochRef.current = epoch;

  /** Where the storm is: the tornado on the ground (or next to be), else the middle of the map. */
  const focusAt = useCallback((): {
    lat: number;
    lon: number;
    what: string;
  } | null => {
    const c = mapRef.current?.getCenter();
    if (replay) {
      // Of the tornadoes about, the one the viewer is looking at.
      const live = tornadoesInFrame(replay.tornadoes, at, 1800)
        .map((t) => {
          const [lat, lon] = tornadoPositionAt(
            t,
            Math.max(t.start, Math.min(t.end, at)),
          );
          return {
            t,
            d: c
              ? (lat - c.lat) ** 2 +
                ((lon - c.lng) * Math.cos((lat * Math.PI) / 180)) ** 2
              : 0,
          };
        })
        .sort((a, b) => a.d - b.d);
      const t = live[0]?.t;
      if (t) {
        const [lat, lon] = tornadoPositionAt(
          t,
          Math.max(t.start, Math.min(t.end, at)),
        );
        return { lat, lon, what: tornadoLabel(t.name) };
      }
    }
    return c ? { lat: c.lat, lon: c.lng, what: "the middle of the map" } : null;
  }, [replay, at, mapRef]);

  const motion = useMemo(
    () => (replay ? stormMotion(replay.tornadoes, at) : null),
    // Half a minute of replay does not move a storm's track enough to matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replay, Math.floor(at / 30)],
  );
  const motionRef = useRef(motion);
  motionRef.current = motion;
  useEffect(() => {
    site.current?.setMotion(motion?.east ?? 0, motion?.north ?? 0);
  }, [motion]);

  /** Put a scan on the site layer and describe it. */
  const show = useCallback((scan: SiteScan | null, product: RadarProductId) => {
    scanRef.current = scan;
    const layer = site.current;
    if (!layer) return;
    layer.setScan(scan);
    layer.setProduct(SITE_PRODUCT[product]);
    layer.setMotion(
      motionRef.current?.east ?? 0,
      motionRef.current?.north ?? 0,
    );
  }, []);

  const describe = (scan: SiteScan): RadarState["scan"] => {
    const lowest = scan.sweeps.REF ?? scan.sweeps.VEL ?? scan.sweeps.RHO!;
    const known = siteById(scan.site);
    return {
      site: scan.site,
      place: known ? `${known.name}, ${known.state}` : scan.site,
      scanTime: Math.round(
        Math.min(...Object.values(scan.sweeps).map((s) => s!.start)) / 1000,
      ),
      angle: lowest.angle,
      nyquist: scan.sweeps.VEL?.nyquist ?? null,
      bytes: scan.bytes,
      has: {
        ref: Boolean(scan.sweeps.REF),
        vel: Boolean(scan.sweeps.VEL),
        cc: Boolean(scan.sweeps.RHO),
      },
    };
  };

  const fetchNow = useCallback(async () => {
    const s = stateRef.current;
    const when = epochRef.current;
    if (when === null) return;
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;

    if (!readsSite(s)) {
      // The national mosaic.
      show(null, s.product);
      const layer = mosaic.current;
      if (!layer) return;
      setState((r) => ({
        ...r,
        loading: true,
        note: null,
        progress: "Fetching the mosaic tiles…",
        scan: null,
      }));
      const { tiles, withData } = await layer.load(when);
      if (ctl.signal.aborted) return;
      setState((r) => ({
        ...r,
        loading: false,
        progress: null,
        loadedAt: withData ? when : r.loadedAt,
        note:
          withData === 0
            ? `Nothing came back for this moment. ${tiles} tiles were asked for and all were ` +
              "empty — either the archive has no scan here, or there was genuinely nothing to see."
            : `${withData} of ${tiles} tiles carried returns.`,
      }));
      return;
    }

    // One radar's own scan.
    mosaic.current?.clear();
    const f = focusAt();
    const id = s.site ?? (f ? nearestSites(f.lat, f.lon, 1)[0]?.id : undefined);
    if (!id) return;
    setState((r) => ({
      ...r,
      loading: true,
      note: null,
      progress: `Finding ${id}’s scans…`,
    }));
    let last = 0;
    try {
      const scan = await scanFor(id, when, {
        signal: ctl.signal,
        onProgress: (p) => {
          const now = performance.now();
          if (now - last < 150) return;
          last = now;
          setState((r) => ({
            ...r,
            progress:
              p.stage === "listing"
                ? `Finding ${id}’s scans…`
                : `Reading ${id}’s lowest scan… ${(p.bytes / 1e6).toFixed(1)} MB`,
          }));
        },
      });
      if (ctl.signal.aborted) return;
      const product = stateRef.current.product;
      show(scan, product);
      const missing = !scan.sweeps[MOMENT_OF[SITE_PRODUCT[product]]];
      setState((r) => ({
        ...r,
        loading: false,
        progress: null,
        loadedAt: when,
        scan: describe(scan),
        note: missing ? MISSING[SITE_PRODUCT[product]] : null,
      }));
    } catch (err) {
      if (
        ctl.signal.aborted ||
        (err instanceof DOMException && err.name === "AbortError")
      )
        return;
      setState((r) => ({
        ...r,
        loading: false,
        progress: null,
        note:
          err instanceof NoScan
            ? err.message
            : "The radar archive could not be reached. Check the connection and try again.",
      }));
    }
  }, [focusAt, show]);

  const clear = useCallback(() => {
    inflight.current?.abort();
    mosaic.current?.clear();
    show(null, stateRef.current.product);
    setState((r) => ({
      ...r,
      loadedAt: null,
      loading: false,
      note: null,
      scan: null,
      progress: null,
    }));
  }, [show]);

  // A different chase: nothing loaded carries over, but the choices do.
  useEffect(() => {
    inflight.current?.abort();
    mosaic.current?.clear();
    show(null, stateRef.current.product);
    setState((r) => ({
      ...INITIAL_RADAR,
      product: r.product,
      source: r.source,
      opacity: r.opacity,
      follow: r.follow,
    }));
  }, [replay, show]);

  const setProduct = useCallback(
    (p: RadarProductId) => {
      const s = stateRef.current;
      const scan = scanRef.current;
      // With a radar's scan already on hand, reflectivity comes from it too.
      const source = p === "reflectivity" && scan ? "site" : s.source;
      const next = { ...s, product: p, source } as RadarState;
      setState((r) => ({ ...r, product: p, source, note: null }));
      stateRef.current = next;
      if (readsSite(next) && scan) {
        site.current?.setProduct(SITE_PRODUCT[p]);
        if (!scan.sweeps[MOMENT_OF[SITE_PRODUCT[p]]])
          setState((r) => ({ ...r, note: MISSING[SITE_PRODUCT[p]] }));
        return;
      }
      // Radar was already asked for at this moment; the new product is fetched without asking twice.
      if (s.loadedAt !== null) void fetchNow();
    },
    [fetchNow],
  );

  const setSource = useCallback(
    (src: "mosaic" | "site") => {
      const s = stateRef.current;
      if (src === s.source) return;
      stateRef.current = { ...s, source: src };
      setState((r) => ({ ...r, source: src, note: null }));
      if (src === "site" && scanRef.current) {
        site.current?.setScan(scanRef.current);
        site.current?.setProduct("ref");
        return;
      }
      if (s.loadedAt !== null) void fetchNow();
    },
    [fetchNow],
  );

  const setSite = useCallback(
    (id: string | null) => {
      stateRef.current = { ...stateRef.current, site: id };
      setState((r) => ({ ...r, site: id }));
      if (stateRef.current.loadedAt !== null) void fetchNow();
    },
    [fetchNow],
  );

  const setOpacity = useCallback((v: number) => {
    setState((r) => ({ ...r, opacity: v }));
    mosaic.current?.setSettings({ opacity: v });
    site.current?.setOpacity(Math.min(1, v * 1.15));
  }, []);

  const setSmooth = useCallback((on: boolean) => {
    setState((r) => ({ ...r, smooth: on }));
    site.current?.setSmooth(on);
    mosaic.current?.setSettings({ smooth: on });
  }, []);

  const setFollow = useCallback(
    (on: boolean) => {
      stateRef.current = { ...stateRef.current, follow: on };
      setState((r) => ({ ...r, follow: on }));
      if (on && stateRef.current.loadedAt === null && !stateRef.current.loading)
        void fetchNow();
    },
    [fetchNow],
  );

  /*
   * Keeping up with the replay. Checked every half-minute of replay time,
   * and only fetched when the scan that covers the moment is a different one
   * from what is drawn. Scrubbing fast only fetches where it settles.
   */
  const bucket = epoch === null ? null : Math.floor(epoch / 30);
  useEffect(() => {
    const s = stateRef.current;
    if (!s.follow || s.loading || s.loadedAt === null || bucket === null)
      return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const when = epochRef.current;
      if (when === null) return;
      if (!readsSite(s)) {
        if (snapToScan(when) !== snapToScan(s.loadedAt!)) void fetchNow();
        return;
      }
      const scan = scanRef.current;
      if (!scan) return;
      const next = await volumeFor(s.site ?? scan.site, when).catch(() => null);
      if (!cancelled && next && next.key !== scan.volume.key) void fetchNow();
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, state.follow, state.loading]);

  /** The map made its layers (again, after a lost context): give them back what they held. */
  const attach = useCallback((m: RadarLayer, s: SiteRadarLayer) => {
    mosaic.current = m;
    site.current = s;
    const st = stateRef.current;
    m.setSettings({ opacity: st.opacity, smooth: st.smooth });
    s.setOpacity(Math.min(1, st.opacity * 1.15));
    s.setSmooth(st.smooth);
    s.setMotion(motionRef.current?.east ?? 0, motionRef.current?.north ?? 0);
    if (scanRef.current) {
      s.setScan(scanRef.current);
      s.setProduct(SITE_PRODUCT[st.product]);
    }
    if (st.loadedAt !== null && !readsSite(st))
      window.setTimeout(() => void m.load(st.loadedAt!), 0);
  }, []);

  useEffect(() => () => inflight.current?.abort(), []);

  return {
    state,
    motion,
    focus: focusAt(),
    attach,
    fetch: fetchNow,
    clear,
    setProduct,
    setSource,
    setSite,
    setOpacity,
    setSmooth,
    setFollow,
  };
}
