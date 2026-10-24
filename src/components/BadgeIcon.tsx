"use client";

import { useEffect, useId, useState } from "react";
import { pick, type Colors } from "@/lib/colors/pick";
import { RARITY, type Badge } from "@/lib/badges";
import { AwardBadge } from "@/components/ui/award-badge";

type IconSet = typeof import("./badge-icon-set").BADGE_ICONS;
let loaded: IconSet | null = null;
let loading: Promise<IconSet> | null = null;

/**
 * The badge icon set (60 icons), fetched once after the page is up rather than with it:
 * emblems draw their frames at once and their icons a moment later.
 */
export function useBadgeIcons() {
  const [set, setSet] = useState(loaded);
  useEffect(() => {
    if (loaded) return;
    let live = true;
    loading ??= import("./badge-icon-set").then(
      (m) => (loaded = m.BADGE_ICONS),
    );
    loading.then((x) => live && setSet(x));
    return () => {
      live = false;
    };
  }, []);
  return set;
}
type ArtSet = typeof import("./badge-art").BADGE_ART;
let art: ArtSet | null = null;
let artLoading: Promise<ArtSet> | null = null;

/** The custom badge art, fetched once after the page is up, like the icon set. */
function useBadgeArt() {
  const [set, setSet] = useState(art);
  useEffect(() => {
    if (art) return;
    let live = true;
    artLoading ??= import("./badge-art").then((m) => (art = m.BADGE_ART));
    artLoading.then((x) => live && setSet(x));
    return () => {
      live = false;
    };
  }, []);
  return set;
}

/** `a` blended toward `b` by `t` (hex colors). */
function mix(a: string, b: string, t: number) {
  const h = (c: string) => {
    const x = c.replace("#", "");
    const v = x.length === 3 ? x.replace(/./g, "$&$&") : x.slice(0, 6);
    return [0, 2, 4].map((k) => parseInt(v.slice(k, k + 2), 16) || 0);
  };
  const [p, q] = [h(a), h(b)];
  return `#${p
    .map((v, k) =>
      Math.round(v + (q[k] - v) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

// Legendary crests turn, shine and twinkle; epic ones twinkle. Transform and opacity only,
// still for reduced motion, on low-tier devices and on badges not earned yet.
const EMBLEM_CSS =
  ".bdg-spin{transform-box:view-box;transform-origin:27px 27px;animation:bdgSpin 36s linear infinite}" +
  ".bdg-spin2{transform-box:view-box;transform-origin:27px 27px;animation:bdgSpin 54s linear infinite reverse}" +
  ".bdg-pulse{animation:bdgPulse 3.2s ease-in-out infinite}" +
  ".bdg-shine{animation:bdgShine 4.6s ease-in-out infinite}" +
  ".bdg-tw{animation:bdgTw 2.6s ease-in-out infinite}" +
  ".bdg-tw:nth-of-type(2){animation-delay:.9s}.bdg-tw:nth-of-type(3){animation-delay:1.7s}.bdg-tw:nth-of-type(4){animation-delay:2.2s}" +
  "@keyframes bdgSpin{to{transform:rotate(360deg)}}" +
  "@keyframes bdgPulse{0%,100%{opacity:.55}50%{opacity:1}}" +
  "@keyframes bdgShine{0%{transform:translateX(-46px)}55%,100%{transform:translateX(46px)}}" +
  "@keyframes bdgTw{0%,100%{opacity:.15}50%{opacity:1}}" +
  "@media (prefers-reduced-motion: reduce){.bdg-spin,.bdg-spin2,.bdg-pulse,.bdg-shine,.bdg-tw{animation:none}}" +
  "html[data-tier=low] .bdg-spin,html[data-tier=low] .bdg-spin2,html[data-tier=low] .bdg-shine,html[data-tier=low] .bdg-tw{animation:none}" +
  ".bdg-still .bdg-spin,.bdg-still .bdg-spin2,.bdg-still .bdg-pulse,.bdg-still .bdg-shine,.bdg-still .bdg-tw{animation:none}";

const ring = (n: number, r: number, cx = 27, cy = 27, rot = -Math.PI / 2) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((Math.PI * 2) / n) * i + rot;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
const poly = (pts: readonly (readonly [number, number])[]) =>
  pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
const HEX_OUT = poly(ring(6, 24));
const HEX_IN = poly(ring(6, 19.6));
/** A starburst of `n` points between radii `r0` and `r1`. */
const burst = (n: number, r0: number, r1: number, rot = 0) =>
  poly(
    Array.from({ length: n * 2 }, (_, i) => {
      const a = (Math.PI / n) * i + rot;
      const r = i % 2 ? r0 : r1;
      return [27 + r * Math.cos(a), 27 + r * Math.sin(a)] as const;
    }),
  );
const BURST_A = burst(12, 18, 25.4);
const BURST_B = burst(12, 18, 22.4, Math.PI / 12);
const TICKS = ring(44, 20.5)
  .map(([x, y]) => {
    const dx = (x - 27) / 20.5;
    const dy = (y - 27) / 20.5;
    return `M${(27 + dx * 19.3).toFixed(2)} ${(27 + dy * 19.3).toFixed(2)}L${x.toFixed(2)} ${y.toFixed(2)}`;
  })
  .join("");
/** Laurel leaves up each side of a legendary crest. */
const LAUREL = [-1, 1].flatMap((side) =>
  Array.from({ length: 7 }, (_, i) => {
    const a = Math.PI / 2 + side * (0.42 + i * 0.27);
    const x = 27 + 21.4 * Math.cos(a);
    const y = 27 + 21.4 * Math.sin(a);
    const deg = (a * 180) / Math.PI + (side > 0 ? -60 : 60);
    return { x, y, deg, k: `${side}${i}` };
  }),
);
const spark = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

/**
 * A badge's emblem in a 54 × 54 box: its own art on an enamel face inside a medallion that
 * grows with rarity. Common: a reeded silver coin. Rare: a coin with a colored rim, studs
 * and a glow. Epic: a beveled hexagon with studs and twinkles. Legendary: a gilded crest in a
 * laurel wreath on a turning starburst, with a light that sweeps across its face.
 */
export function EmblemGroup({
  icon,
  rarity,
  color,
}: {
  icon: string;
  rarity: string;
  color: string;
}) {
  const id = useId().replace(/:/g, "");
  const icons = useBadgeIcons();
  const arts = useBadgeArt();
  const tier = Math.max(
    0,
    ["common", "rare", "epic", "legendary"].indexOf(rarity),
  );
  const hi = mix(color, "#ffffff", 0.6);
  const dark = mix(color, "#000000", 0.5);
  const pal = {
    lit: `url(#${id}l)`,
    deep: `url(#${id}d)`,
    hi,
    main: color,
    dark,
    ink: "#0d0f18",
  };
  const Art = arts?.[icon];
  const I = !Art && icons ? (icons[icon] ?? icons.Award) : null;
  const size = [22, 22, 20.5, 20.5][tier];
  const at = 27 - size / 2;
  const faceR = [18.6, 18.4, 0, 16.4][tier];
  return (
    <g>
      <style>{EMBLEM_CSS}</style>
      <defs>
        <radialGradient id={`${id}g`}>
          <stop offset="0.4" stopColor={color} stopOpacity="0.6" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.3" stopColor={hi} />
          <stop offset="0.62" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${id}f`} cx="0.4" cy="0.32" r="0.75">
          <stop offset="0" stopColor={mix(color, "#1a1d2b", 0.82)} />
          <stop offset="1" stopColor="#090a10" />
        </radialGradient>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(color, "#ffffff", 0.72)} />
          <stop offset="1" stopColor={color} />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <circle cx="27" cy="27" r={faceR || 19.6} />
        </clipPath>
      </defs>

      {tier >= 1 && (
        <circle
          className={tier === 3 ? "bdg-pulse" : undefined}
          cx="27"
          cy="27"
          r="27"
          fill={`url(#${id}g)`}
        />
      )}

      {tier === 3 && (
        <>
          <polygon
            className="bdg-spin"
            points={BURST_A}
            fill={color}
            opacity="0.6"
          />
          <polygon
            className="bdg-spin2"
            points={BURST_B}
            fill={hi}
            opacity="0.45"
          />
          {LAUREL.map((l) => (
            <ellipse
              key={l.k}
              cx={l.x}
              cy={l.y}
              rx="1.5"
              ry="3.2"
              fill={`url(#${id}l)`}
              stroke={dark}
              strokeWidth="0.4"
              transform={`rotate(${l.deg} ${l.x} ${l.y})`}
            />
          ))}
        </>
      )}

      {tier === 2 ? (
        <>
          <polygon
            points={HEX_OUT}
            fill={`url(#${id}r)`}
            stroke={dark}
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <polygon points={HEX_IN} fill={`url(#${id}f)`} />
          <polygon
            points={HEX_IN}
            fill="none"
            stroke={hi}
            strokeOpacity="0.45"
            strokeWidth="0.6"
          />
          {ring(6, 21.8).map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r="1.1" fill="#fff" opacity="0.85" />
          ))}
        </>
      ) : (
        <>
          <circle
            cx="27"
            cy="27"
            r={tier === 3 ? 19.8 : 21.6}
            fill={`url(#${id}r)`}
            stroke={dark}
            strokeWidth="0.6"
          />
          {tier === 0 && (
            <path d={TICKS} stroke={dark} strokeWidth="0.6" opacity="0.45" />
          )}
          <circle cx="27" cy="27" r={faceR} fill={`url(#${id}f)`} />
          <circle
            cx="27"
            cy="27"
            r={faceR - 1.1}
            fill="none"
            stroke={hi}
            strokeOpacity={tier ? 0.5 : 0.3}
            strokeWidth="0.6"
          />
          {tier === 1 &&
            ring(4, 20).map(([x, y], k) => (
              <path
                key={k}
                d={`M${x} ${y - 1.6}L${x + 1.2} ${y}L${x} ${y + 1.6}L${x - 1.2} ${y}Z`}
                fill="#fff"
                opacity="0.9"
              />
            ))}
        </>
      )}

      {Art ? (
        <g transform={`translate(${at} ${at}) scale(${size / 24})`}>
          {Art(pal)}
        </g>
      ) : I ? (
        <I
          x={at}
          y={at}
          width={size}
          height={size}
          strokeWidth={1.9}
          color={hi}
        />
      ) : null}

      {tier === 3 && (
        <g clipPath={`url(#${id}c)`}>
          <rect
            className="bdg-shine"
            x="18"
            y="4"
            width="18"
            height="46"
            fill={`url(#${id}s)`}
            transform="rotate(20 27 27)"
          />
        </g>
      )}

      {tier >= 2 && (
        <g fill="#fff">
          <path className="bdg-tw" d={spark(8, 11, 3)} />
          <path className="bdg-tw" d={spark(46, 9, 2.4)} />
          <path className="bdg-tw" d={spark(45, 45, 2.8)} />
          {tier === 3 && <path className="bdg-tw" d={spark(9, 44, 2.2)} />}
        </g>
      )}
    </g>
  );
}

/** The emblem on its own (lists, progress rows). */
export function BadgeEmblem({
  badge,
  colors,
  size = 44,
  dim,
}: {
  badge: Pick<Badge, "icon" | "rarity">;
  colors?: Colors;
  size?: number;
  /** Not earned yet: drawn faded and still. */
  dim?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 54 54"
      width={size}
      height={size}
      aria-hidden
      className={dim ? "bdg-still" : undefined}
      style={dim ? { opacity: 0.45, filter: "grayscale(0.6)" } : undefined}
    >
      <EmblemGroup
        icon={badge.icon}
        rarity={badge.rarity}
        color={pick(
          colors,
          `badge:${badge.rarity}`,
          RARITY[badge.rarity] ?? RARITY.common,
        )}
      />
    </svg>
  );
}

/**
 * A badge as members see it: the owner's award-badge plate (gunmetal, multicolor stripe)
 * with the badge's emblem, its name in the theme, its rarity in its rarity color.
 */
export function BadgePlate({
  badge,
  colors,
}: {
  badge: Pick<Badge, "icon" | "rarity" | "name"> & { description?: string };
  colors?: Colors;
}) {
  const color = pick(
    colors,
    `badge:${badge.rarity}`,
    RARITY[badge.rarity] ?? RARITY.common,
  );
  return (
    <AwardBadge
      kicker={`${badge.rarity} badge`}
      kickerColor={color}
      title={badge.name || "Badge name"}
      hint={badge.description || undefined}
      icon={
        <EmblemGroup icon={badge.icon} rarity={badge.rarity} color={color} />
      }
    />
  );
}
