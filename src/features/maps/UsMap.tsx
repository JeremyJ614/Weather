"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Download, Hand, Minus, Plus, Scan, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pickCities, type City } from "@/lib/map/cityLabels";
import { useZoom } from "./useZoom";
import s from "./UsMap.module.css";

/** A legend entry; `outline` draws it as an outlined box (a border color, not a fill). */
export type Swatch = { label: string; color: string; outline?: boolean };
type Base = {
  states: { id: string; d: string }[];
  nation: string;
  labels: { abbr: string; x: number; y: number }[];
};

let basePromise: Promise<Base> | null = null;
const loadBase = () =>
  (basePromise ??= fetch("/api/maps/base").then((r) => r.json()));

export const W = 975;
export const H = 610;

/** Turns the live SVG into a 2× PNG with a title band and legend. */
const PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linejoin",
  "stroke-linecap",
  "opacity",
  "display",
  "visibility",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "text-anchor",
  "paint-order",
  "filter",
  "mix-blend-mode",
  "image-rendering",
];

async function toPng(
  svg: SVGSVGElement,
  title: string,
  sub: string,
  legend: Swatch[],
) {
  const css = getComputedStyle(document.documentElement);
  // CSS-module classes do not travel with a standalone SVG, so copy each
  // element's computed presentation onto the clone (else land paints black
  // and the data layer vanishes).
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const live = [svg, ...svg.querySelectorAll("*")];
  const copy = [clone, ...clone.querySelectorAll("*")];
  live.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const out = copy[i] as SVGElement;
    out.removeAttribute("class");
    out.setAttribute(
      "style",
      PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"),
    );
  });
  clone.setAttribute("width", String(W));
  clone.setAttribute("height", String(H));
  let xml = new XMLSerializer().serializeToString(clone);
  xml = xml.replace(
    /var\(--([a-z0-9-]+)\)/gi,
    (_, v) => css.getPropertyValue(`--${v}`).trim() || "#888",
  );
  // Inline any raster so the export carries it.
  const hrefs = [
    ...new Set(
      [...xml.matchAll(/href="((?:\/|https?:)[^"]+)"/g)].map((m) => m[1]),
    ),
  ];
  for (const h of hrefs) {
    const blob = await fetch(h.replace(/&amp;/g, "&"))
      .then((r) => (r.ok ? r.blob() : null))
      .catch(() => null);
    if (!blob) continue;
    const data = await new Promise<string>((ok) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result));
      fr.readAsDataURL(blob);
    });
    xml = xml.split(h).join(data);
  }
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  await img.decode();
  const k = 2;
  const band = 92;
  const foot = legend.length ? 70 : 24;
  const c = document.createElement("canvas");
  c.width = W * k;
  c.height = (H + band + foot) * k;
  const g = c.getContext("2d")!;
  g.scale(k, k);
  g.fillStyle = css.getPropertyValue("--bg").trim() || "#0b0c14";
  g.fillRect(0, 0, W, H + band + foot);
  const font = getComputedStyle(document.body).fontFamily;
  g.fillStyle = css.getPropertyValue("--accent").trim() || "#d9b76f";
  g.font = `700 13px ${font}`;
  g.fillText("SSWX WEATHER CENTER", 28, 34);
  g.fillStyle = "#fff";
  g.font = `800 26px ${font}`;
  g.fillText(title, 28, 66);
  g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
  g.font = `500 14px ${font}`;
  g.fillText(sub, 28, 86);
  g.drawImage(img, 0, band, W, H);
  let x = 28;
  g.font = `600 13px ${font}`;
  for (const l of legend) {
    if (l.outline) {
      g.strokeStyle = l.color;
      g.lineWidth = 2;
      g.strokeRect(x + 1, H + band + 25, 14, 14);
    } else {
      g.fillStyle = l.color;
      g.fillRect(x, H + band + 24, 16, 16);
    }
    g.fillStyle = "#ddd";
    g.fillText(l.label, x + 22, H + band + 37);
    x += 30 + g.measureText(l.label).width;
    if (x > W - 120) break;
  }
  g.fillStyle = css.getPropertyValue("--muted").trim() || "#999";
  g.font = `600 11px ${font}`;
  g.fillText("weather.sswx.space", W - 140, H + band + foot - 10);
  return new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), "image/png"));
}

/**
 * A static national map in the app's style: dark land on a dark sea, the data
 * layer clipped to the country, state lines and labels over it, the outline
 * glowing in the primary color. Not interactive by design: it opens framed on
 * the whole country, and saves as a titled PNG.
 */
export function UsMap({
  title,
  sub,
  legend,
  status,
  file,
  children,
  overlay,
  onTap,
  actions = true,
  zoomable = true,
  view,
  maxZoom = 10,
  focus,
  towns = false,
}: {
  /** Deepest zoom (10× by default; tornado tracks go to 60×). */
  maxZoom?: number;
  /** Glides here whenever `key` changes (a picked track, say). */
  focus?: { x: number; y: number; w: number; key: string };
  /** Load small towns too, for maps that zoom far in. */
  towns?: boolean;
  /** Open framed on a part of the canvas instead of the whole country. */
  view?: { x: number; y: number; w: number };
  /** Still at first; "Zoom & pan" makes it grab-, pinch- and wheel-zoomable. */
  zoomable?: boolean;
  /** Tap handler in canvas coordinates (975×610); makes the map a picker. */
  onTap?: (x: number, y: number) => void;
  /** Show the Download/Share buttons. */
  actions?: boolean;
  title: string;
  sub?: string | null;
  legend: Swatch[];
  status: "loading" | "ready" | "error" | "empty";
  /** Download file name, without extension. */
  file: string;
  /** SVG content in canvas coordinates (975×610), drawn clipped to the US. */
  children?: ReactNode;
  /** SVG content drawn above the state lines (dots, markers). */
  overlay?: ReactNode;
}) {
  const [base, setBase] = useState<Base | null>(null);
  // Unique per map: a shared id resolves to the first map, which may sit in a hidden tab and stop clipping.
  const uid = useId().replace(/:/g, "");
  const [busy, setBusy] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const [live, setLive] = useState(false);
  const z = useZoom(svg, W, H, live, onTap, view, maxZoom);
  const now = useRef({ view: z.view, jump: z.jump });
  useEffect(() => {
    now.current = { view: z.view, jump: z.jump };
  });
  useEffect(() => {
    if (!focus) return;
    let stop = () => {};
    let gone = false;
    import("./glide").then((m) => {
      if (!gone)
        stop = m.glide(now.current.view, focus, now.current.jump, H / W);
    });
    return () => {
      gone = true;
      stop();
    };
    // Only a new key moves the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);
  const [cities, setCities] = useState<City[] | null>(null);
  const deep = zoomable && z.view.w < W / 1.4;
  useEffect(() => {
    if (!deep || cities) return;
    let off = false;
    fetch(towns ? "/api/maps/cities?n=12000" : "/api/maps/cities")
      .then((r) => (r.ok ? r.json() : []))
      .then((c: City[]) => !off && setCities(c))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [deep, cities, towns]);
  // Canvas units per screen pixel, so city names stay a readable 11px at any zoom.
  const [cssW, setCssW] = useState(360);
  useEffect(() => {
    const el = svg.current;
    if (!el || !zoomable) return;
    const ro = new ResizeObserver(([e]) => setCssW(e.contentRect.width || 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, [zoomable]);
  const px = z.view.w / cssW;
  const shown =
    deep && cities
      ? pickCities(
          cities,
          { x: z.view.x, y: z.view.y, w: z.view.w, h: (z.view.w * H) / W },
          W,
          11 * px,
        )
      : [];
  const vb = zoomable
    ? `${z.view.x} ${z.view.y} ${z.view.w} ${(z.view.w * H) / W}`
    : `0 0 ${W} ${H}`;
  useEffect(() => {
    let live = true;
    loadBase().then((b) => live && setBase(b));
    return () => {
      live = false;
    };
  }, []);

  const save = async (share: boolean) => {
    if (!svg.current) return;
    setBusy(true);
    try {
      const blob = await toPng(svg.current, title, sub ?? "", legend);
      const name = `${file}.png`;
      const f = new File([blob], name, { type: "image/png" });
      if (share && navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } catch {
      /* the user closed the share sheet */
    } finally {
      setBusy(false);
    }
  };

  return (
    <figure className={s.frame}>
      <figcaption className={s.cap}>
        <span className={s.title}>{title}</span>
        {sub && <span className={s.sub}>Valid {sub}</span>}
      </figcaption>
      <div className={s.stage}>
        <svg
          ref={svg}
          viewBox={vb}
          xmlns="http://www.w3.org/2000/svg"
          className={`${s.svg} ${onTap ? s.picker : ""} ${live ? s.live : ""}`}
          style={{
            ["--zs" as string]: z.view.w / W,
            // Canvas units per screen pixel: lines sized in screen pixels at any zoom.
            ["--px" as string]: (zoomable ? z.view.w : W) / cssW,
          }}
          {...(zoomable ? z.handlers : {})}
          onClick={(e) => {
            const el = svg.current;
            const m = el?.getScreenCTM();
            if (live || !onTap || !el || !m) return;
            const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
              m.inverse(),
            );
            onTap(p.x, p.y);
          }}
          role="img"
          aria-label={`${title} map of the United States`}
        >
          <defs>
            <radialGradient id={`${uid}-sea`} cx="50%" cy="40%" r="75%">
              <stop offset="0" stopColor="var(--surface)" />
              <stop offset="1" stopColor="var(--bg)" />
            </radialGradient>
            {base && (
              <clipPath id={`${uid}-nation`}>
                <path d={base.nation} />
              </clipPath>
            )}
          </defs>
          <rect width={W} height={H} fill={`url(#${uid}-sea)`} />
          {base && (
            <>
              <path d={base.nation} className={s.land} />
              <g
                clipPath={`url(#${uid}-nation)`}
                className={s.data}
                key={title}
              >
                {children}
              </g>
              <g className={s.states}>
                {base.states.map((st) => (
                  <path key={st.id} d={st.d} />
                ))}
              </g>
              <path d={base.nation} className={s.glow} />
              <path d={base.nation} className={s.outline} />
              <g className={s.labels}>
                {base.labels.map((l) => (
                  <text key={l.abbr} x={l.x} y={l.y}>
                    {l.abbr}
                  </text>
                ))}
              </g>
              {shown.length > 0 && (
                <g className={s.cities} aria-hidden>
                  {shown.map(([name, x, y]) => (
                    <g
                      key={`${name}${x}`}
                      transform={`translate(${x} ${y}) scale(${px})`}
                    >
                      <circle r={2.2} />
                      <text x={4.5}>{name}</text>
                    </g>
                  ))}
                </g>
              )}
              {overlay}
            </>
          )}
          <text x="18" y={H - 16} className={s.mark}>
            WEATHER.SSWX.SPACE
          </text>
        </svg>
        {zoomable && base && (
          <div className={s.zoom}>
            {live ? (
              <>
                <button onClick={z.zoomIn} aria-label="Zoom in">
                  <Plus aria-hidden />
                </button>
                <button onClick={z.zoomOut} aria-label="Zoom out">
                  <Minus aria-hidden />
                </button>
                {z.zoomed && (
                  <button onClick={z.reset} aria-label="Whole country">
                    <Scan aria-hidden />
                  </button>
                )}
                <button
                  className={s.zoomDone}
                  onClick={() => setLive(false)}
                  aria-label="Done moving the map"
                >
                  <Check aria-hidden /> Done
                </button>
              </>
            ) : (
              <button className={s.zoomGrab} onClick={() => setLive(true)}>
                <Hand aria-hidden /> Zoom &amp; pan
              </button>
            )}
          </div>
        )}
        {(status === "loading" || !base) && (
          <div className={s.loading} aria-label="Loading map" />
        )}
        {status === "error" && (
          <p className={s.note}>
            NOAA&apos;s map service isn&apos;t answering right now.
          </p>
        )}
        {status === "empty" && (
          <p className={s.note}>Nothing in effect on this map.</p>
        )}
      </div>
      {legend.length > 0 && (
        <ul className={s.legend}>
          {legend.map((l) => (
            <li key={l.label}>
              <i
                style={
                  l.outline
                    ? {
                        background: "transparent",
                        boxShadow: `inset 0 0 0 2px ${l.color}`,
                      }
                    : { background: l.color }
                }
              />
              {l.label}
            </li>
          ))}
        </ul>
      )}
      {actions && (
        <div className={s.actions}>
          <Button
            onClick={() => save(false)}
            disabled={busy || status !== "ready"}
          >
            <Download className="size-4" aria-hidden /> Download PNG
          </Button>
          <Button
            onClick={() => save(true)}
            disabled={busy || status !== "ready"}
          >
            <Share2 className="size-4" aria-hidden /> Share
          </Button>
        </div>
      )}
    </figure>
  );
}
