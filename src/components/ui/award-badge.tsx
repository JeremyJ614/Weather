"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Award badge (after the owner's 21st.dev pick): a gunmetal plate with the
 * multicolor stripe sweeping through it and a 3D tilt that follows the pointer.
 * Title and icon follow the theme; the kicker may carry a color (a badge's rarity).
 * Every badge in the app is drawn with this.
 */
export interface AwardBadgeProps {
  /** Small line above the title, e.g. "STORMSYNC". */
  kicker: string;
  title: string;
  /** Rank shown as "#n" after the title. */
  place?: number;
  link?: string;
  /** SVG path data for a 36×36 icon; defaults to a laurel. */
  iconPath?: string;
  /** An icon element (e.g. a Lucide icon) drawn instead of iconPath. */
  icon?: ReactNode;
  /** Kicker color; defaults to the theme's muted text. */
  kickerColor?: string;
  /** Read out and shown on hover. */
  hint?: string;
}

const IDENTITY = "1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1";
const MAX_ROT = 0.25;
const MIN_ROT = -0.25;
const MAX_SCALE = 1;
const MIN_SCALE = 0.97;
const STRIPES = [
  "hsl(358, 100%, 62%)",
  "hsl(30, 100%, 50%)",
  "hsl(60, 100%, 50%)",
  "hsl(96, 100%, 50%)",
  "hsl(233, 85%, 47%)",
  "hsl(271, 85%, 47%)",
  "hsl(300, 20%, 35%)",
  "transparent",
  "transparent",
  "white",
];
const LAUREL =
  "M14.963 9.075c.787-3-.188-5.887-.188-5.887S12.488 5.175 11.7 8.175c-.787 3 .188 5.887.188 5.887s2.25-1.987 3.075-4.987m-4.5 1.987c.787 3-.188 5.888-.188 5.888S7.988 14.962 7.2 11.962c-.787-3 .188-5.887.188-5.887s2.287 1.987 3.075 4.987m.862 10.388s-.6-2.962-2.775-5.175C6.337 14.1 3.375 13.5 3.375 13.5s.6 2.962 2.775 5.175c2.213 2.175 5.175 2.775 5.175 2.775m3.3 3.413s-1.988-2.288-4.988-3.075-5.887.187-5.887.187 1.987 2.287 4.988 3.075c3 .787 5.887-.188 5.887-.188Zm6.75 0s1.988-2.288 4.988-3.075c3-.826 5.887.187 5.887.187s-1.988 2.287-4.988 3.075c-3 .787-5.887-.188-5.887-.188ZM32.625 13.5s-2.963.6-5.175 2.775c-2.213 2.213-2.775 5.175-2.775 5.175s2.962-.6 5.175-2.775c2.175-2.213 2.775-5.175 2.775-5.175M28.65 6.075s.975 2.887.188 5.887c-.826 3-3.076 4.988-3.076 4.988s-.974-2.888-.187-5.888c.788-3 3.075-4.987 3.075-4.987m-4.5 7.987s.975-2.887.188-5.887c-.788-3-3.076-4.988-3.076-4.988s-.974 2.888-.187 5.888c.788 3 3.075 4.988 3.075 4.988ZM18 26.1c.975-.225 3.113-.6 5.325 0 3 .788 5.063 3.038 5.063 3.038s-2.888.975-5.888.187a13 13 0 0 1-1.425-.525c.563.788 1.125 1.425 2.288 1.913l-.863 2.062c-2.063-.862-2.925-2.137-3.675-3.262-.262-.375-.525-.713-.787-1.05-.26.293-.465.586-.686.903l-.102.147-.048.068c-.775 1.108-1.643 2.35-3.627 3.194l-.862-2.062c1.162-.488 1.725-1.125 2.287-1.913-.45.225-.938.375-1.425.525-3 .788-5.887-.187-5.887-.187s1.987-2.288 4.987-3.075c2.212-.563 4.35-.188 5.325.037";

const OVERLAY_KEYFRAMES =
  STRIPES.map(
    (_, e) =>
      `@keyframes awardOverlay${e + 1}{0%{transform:rotate(${e * 10}deg)}50%{transform:rotate(${(e + 1) * 10}deg)}100%{transform:rotate(${e * 10}deg)}}`,
  ).join("") +
  // The stripe holds still for reduced motion and on low-tier devices.
  "@media (prefers-reduced-motion: reduce){.award-stripe{animation:none!important}}html[data-tier=low] .award-stripe{animation:none!important}";

/*
 * Phone tilt (post-launch A5 "holo"): on touch screens the plates follow the phone's own
 * motion, with a foil sheen sliding across. iPhone asks once, on the first tap of a badge;
 * Android needs no permission. Only plates on screen listen; still for low-tier phones and
 * Reduce Motion.
 */
const HoloSheen = lazy(() => import("./HoloSheen"));

type Tilt = { x: number; y: number };
function useGyro(el: React.RefObject<HTMLSpanElement | null>) {
  const [tilt, setTilt] = useState<Tilt | null>(null);
  useEffect(() => {
    const node = el.current;
    if (
      !node ||
      !matchMedia("(hover: none)").matches ||
      matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.tier === "low"
    )
      return;
    let stop: (() => void) | null = null;
    let live = true;
    void import("./gyro").then((m) => {
      if (live) stop = m.listenTilt(node, setTilt);
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [el]);
  return tilt;
}

export function AwardBadge({
  kicker,
  title,
  place,
  link,
  iconPath = LAUREL,
  icon,
  kickerColor,
  hint,
}: AwardBadgeProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Several badges share a page; each needs its own filter and mask ids.
  const uid = useId().replace(/:/g, "");
  const [overlayPos, setOverlayPos] = useState(0);
  const [matrix, setMatrix] = useState(IDENTITY);
  const [current, setCurrent] = useState(IDENTITY);
  const [inOutOff, setInOutOff] = useState(true);
  const [overlayOff, setOverlayOff] = useState(false);
  const [ready, setReady] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const gyro = useGyro(ref);
  const [sheen, setSheen] = useState(0);

  const box = () => {
    const r = ref.current?.getBoundingClientRect();
    return {
      left: r?.left ?? 0,
      right: r?.right ?? 0,
      top: r?.top ?? 0,
      bottom: r?.bottom ?? 0,
    };
  };
  const later = (fn: () => void, ms: number) =>
    timers.current.push(setTimeout(fn, ms));

  const getMatrix = (x: number, y: number) => {
    const { left, right, top, bottom } = box();
    const xc = (left + right) / 2;
    const yc = (top + bottom) / 2;
    const sc = [
      MAX_SCALE - ((MAX_SCALE - MIN_SCALE) * Math.abs(xc - x)) / (xc - left),
      MAX_SCALE - ((MAX_SCALE - MIN_SCALE) * Math.abs(yc - y)) / (yc - top),
      MAX_SCALE -
        ((MAX_SCALE - MIN_SCALE) * (Math.abs(xc - x) + Math.abs(yc - y))) /
          (xc - left + yc - top),
    ];
    const x1 = 0.25 * ((yc - y) / yc - (xc - x) / xc);
    const x2 =
      MAX_ROT - ((MAX_ROT - MIN_ROT) * Math.abs(right - x)) / (right - left);
    const y2 = MAX_ROT - ((MAX_ROT - MIN_ROT) * (top - y)) / (top - bottom);
    const z0 = -x2;
    const z1 = 0.2 - ((0.2 + 0.6) * (top - y)) / (top - bottom);
    return `${sc[0]}, 0, ${z0}, 0, ${x1}, ${sc[1]}, ${z1}, 0, ${x2}, ${y2}, ${sc[2]}, 0, 0, 0, 0, 1`;
  };

  const opposite = (m: string, y: number, entering: boolean) => {
    const { top, bottom } = box();
    const oy = bottom - y + top;
    const weak = entering ? 0.7 : 4;
    const mult = entering ? -1 : 1;
    const tilt = MAX_ROT - ((MAX_ROT - MIN_ROT) * (top - oy)) / (top - bottom);
    return m
      .split(", ")
      .map((v, i) => {
        if (i === 2 || i === 4 || i === 8)
          return (-parseFloat(v) * mult) / weak;
        if (i === 0 || i === 5 || i === 10) return "1";
        if (i === 6) return (mult * tilt) / weak;
        if (i === 9) return tilt / weak;
        return v;
      })
      .join(", ");
  };

  const spread = (e: MouseEvent) => {
    const { left, right, top, bottom } = box();
    return (
      (Math.abs((left + right) / 2 - e.clientX) +
        Math.abs((top + bottom) / 2 - e.clientY)) /
      1.5
    );
  };

  const onEnter = (e: MouseEvent<HTMLSpanElement>) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setOverlayOff(true);
    setInOutOff(false);
    later(() => setInOutOff(true), 350);
    const pos = spread(e);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setOverlayPos(pos)),
    );
    setMatrix(opposite(getMatrix(e.clientX, e.clientY), e.clientY, true));
    setReady(false);
    later(() => setReady(true), 200);
  };
  const onMove = (e: MouseEvent<HTMLSpanElement>) => {
    const { left, right } = box();
    setSheen(((e.clientX - left) / Math.max(1, right - left)) * 2 - 1);
    const pos = spread(e);
    later(() => setOverlayPos(pos), 150);
    if (ready) setCurrent(getMatrix(e.clientX, e.clientY));
  };
  const onLeave = (e: MouseEvent<HTMLSpanElement>) => {
    setSheen(0);
    setCurrent(opposite(shown, e.clientY, false));
    later(() => setCurrent(IDENTITY), 200);
    const pos = overlayPos;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setInOutOff(false);
        later(() => setOverlayPos(-pos / 4), 150);
        later(() => setOverlayPos(0), 300);
        later(() => {
          setOverlayOff(false);
          setInOutOff(true);
        }, 500);
      }),
    );
  };

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  // Once the entry tilt settles, the plate follows the pointer.
  const shown = ready ? current : matrix;

  const full = `${title}${place ? ` #${place}` : ""}`;
  // Spans, so a plate can sit inside a button (admin's badge toggles).
  const plate = (
    <span
      ref={ref}
      className="block h-auto w-[180px] cursor-pointer sm:w-[260px]"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
      onClick={() => void import("./gyro").then((m) => m.askTilt())}
    >
      <style>{OVERLAY_KEYFRAMES}</style>
      <span
        className="block"
        style={{
          transform: gyro
            ? `perspective(700px) rotateY(${gyro.x * 14}deg) rotateX(${-gyro.y * 12}deg)`
            : `perspective(700px) matrix3d(${shown})`,
          transformOrigin: "center center",
          transition: gyro
            ? "transform 120ms linear"
            : "transform 200ms ease-out",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 260 54"
          className="h-auto w-[180px] sm:w-[260px]"
          role="img"
          aria-label={`${kicker} ${full}${hint ? `. ${hint}` : ""}`}
        >
          {hint && <title>{hint}</title>}
          <defs>
            <filter id={`${uid}b`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            <mask id={`${uid}m`}>
              <rect width="260" height="54" fill="white" rx="10" />
            </mask>
            <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a4f58" />
              <stop offset="0.5" stopColor="#30343b" />
              <stop offset="1" stopColor="#24272d" />
            </linearGradient>
          </defs>
          <rect width="260" height="54" rx="10" fill={`url(#${uid}g)`} />
          <rect
            x="4"
            y="4"
            width="252"
            height="46"
            rx="8"
            fill="transparent"
            stroke="#6b717c"
            strokeWidth="1"
          />
          <text
            fontFamily="var(--font-body)"
            fontSize="9"
            fontWeight="bold"
            letterSpacing="1.4"
            style={{ fill: kickerColor ?? "var(--muted)" }}
            x="53"
            y="20"
          >
            {kicker.toUpperCase()}
          </text>
          <text
            fontFamily="var(--font-display)"
            fontSize="16"
            fontWeight="bold"
            style={{ fill: "var(--accent)" }}
            x="52"
            y="40"
            // Long names squeeze to fit the plate rather than run off it.
            {...(full.length > 19
              ? { textLength: 196, lengthAdjust: "spacingAndGlyphs" }
              : {})}
          >
            {full}
          </text>
          {icon ? (
            <g style={{ color: "var(--accent)" }}>{icon}</g>
          ) : (
            <g transform="translate(8, 9)" style={{ fill: "var(--accent)" }}>
              <path d={iconPath} />
            </g>
          )}
          <g style={{ mixBlendMode: "overlay" }} mask={`url(#${uid}m)`}>
            {STRIPES.map((fill, i) => (
              <g
                key={i}
                className="award-stripe"
                style={{
                  transform: `rotate(${overlayPos + i * 10}deg)`,
                  transformOrigin: "center center",
                  transition: !inOutOff ? "transform 200ms ease-out" : "none",
                  animation: overlayOff
                    ? "none"
                    : `awardOverlay${i + 1} 5s infinite`,
                  willChange: "transform",
                }}
              >
                <polygon
                  points="0,0 260,54 260,0 0,54"
                  fill={fill}
                  filter={`url(#${uid}b)`}
                  opacity="0.5"
                />
              </g>
            ))}
          </g>
          <Suspense fallback={null}>
            <HoloSheen
              id={uid}
              x={gyro ? gyro.x : sheen}
              on={Boolean(gyro || sheen)}
            />
          </Suspense>
        </svg>
      </span>
    </span>
  );
  return link ? (
    <a href={link} target="_blank" rel="noreferrer" className="block w-fit">
      {plate}
    </a>
  ) : (
    plate
  );
}
