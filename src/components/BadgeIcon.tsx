"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  BellRing,
  Binoculars,
  BookOpen,
  Brain,
  CalendarCheck,
  Car,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Crosshair,
  Crown,
  Droplets,
  Eye,
  Flag,
  Flame,
  Footprints,
  Gem,
  GraduationCap,
  HandHeart,
  Heart,
  Hourglass,
  Infinity as InfinityIcon,
  Lightbulb,
  MapPinned,
  Medal,
  Megaphone,
  Moon,
  MoonStar,
  Mountain,
  Orbit,
  Radar,
  Rainbow,
  Rocket,
  Route,
  Satellite,
  Shield,
  Smartphone,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Sunset,
  Target,
  Telescope,
  Thermometer,
  Tornado,
  Trophy,
  Umbrella,
  UserPlus,
  Users,
  Vote,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { pick, type Colors } from "@/lib/colors/pick";
import { RARITY, type Badge } from "@/lib/badges";
import { AwardBadge } from "@/components/ui/award-badge";

/** Keep in step with BADGE_ICON_NAMES (src/lib/badge-icons.ts). */
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Award,
  Trophy,
  Medal,
  Star,
  Crown,
  Gem,
  Sparkles,
  Zap,
  Flame,
  Tornado,
  CloudLightning,
  CloudRain,
  CloudHail,
  CloudSnow,
  CloudSun,
  Rainbow,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Moon,
  MoonStar,
  Wind,
  Waves,
  Droplets,
  Thermometer,
  Umbrella,
  Radar,
  Satellite,
  Orbit,
  Telescope,
  Binoculars,
  Eye,
  Compass,
  MapPinned,
  Route,
  Car,
  Mountain,
  Flag,
  Footprints,
  Target,
  Crosshair,
  Shield,
  BadgeCheck,
  Infinity: InfinityIcon,
  Hourglass,
  CalendarCheck,
  Lightbulb,
  BookOpen,
  GraduationCap,
  Brain,
  Vote,
  Megaphone,
  UserPlus,
  Users,
  HandHeart,
  Heart,
  BellRing,
  Smartphone,
  Rocket,
};

// Turning rays and twinkles: transform and opacity only, still for reduced motion and
// on low-tier devices.
const EMBLEM_CSS =
  ".bdg-spin{transform-box:view-box;transform-origin:27px 27px;animation:bdgSpin 24s linear infinite}" +
  ".bdg-tw{animation:bdgTw 2.6s ease-in-out infinite}" +
  ".bdg-tw:nth-of-type(2){animation-delay:.9s}.bdg-tw:nth-of-type(3){animation-delay:1.7s}" +
  "@keyframes bdgSpin{to{transform:rotate(360deg)}}" +
  "@keyframes bdgTw{0%,100%{opacity:.15}50%{opacity:1}}" +
  "@media (prefers-reduced-motion: reduce){.bdg-spin,.bdg-tw{animation:none}}" +
  "html[data-tier=low] .bdg-spin,html[data-tier=low] .bdg-tw{animation:none}";

const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return `${27 + 22 * Math.cos(a)},${27 + 22 * Math.sin(a)}`;
}).join(" ");
const RAYS = Array.from({ length: 12 }, (_, i) => {
  const a = (Math.PI / 6) * i;
  const p = (r: number, d: number) =>
    `${27 + r * Math.cos(a + d)},${27 + r * Math.sin(a + d)}`;
  return `M${p(17, -0.16)}L${p(27, 0)}L${p(17, 0.16)}Z`;
}).join("");
const spark = (x: number, y: number, r: number) =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

/**
 * A badge's emblem in a 54 × 54 box: its icon on a dark disc inside a frame that grows with
 * rarity: a ring (common), a double ring with a glow (rare), a hexagon with twinkles (epic),
 * and turning rays round a gilded ring (legendary). The frame takes the rarity's color.
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
  const I = BADGE_ICONS[icon] ?? Award;
  const tier = ["common", "rare", "epic", "legendary"].indexOf(rarity);
  return (
    <g>
      <style>{EMBLEM_CSS}</style>
      <defs>
        <radialGradient id={`${id}g`}>
          <stop offset="0.45" stopColor={color} stopOpacity="0.55" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="0.35" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {tier >= 1 && <circle cx="27" cy="27" r="27" fill={`url(#${id}g)`} />}
      {tier === 3 && (
        <path className="bdg-spin" d={RAYS} fill={color} opacity="0.55" />
      )}
      {tier === 2 ? (
        <polygon
          points={HEX}
          fill="var(--bg)"
          stroke={`url(#${id}r)`}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      ) : (
        <circle
          cx="27"
          cy="27"
          r={tier === 3 ? 17.5 : 20}
          fill="var(--bg)"
          stroke={tier >= 1 ? `url(#${id}r)` : color}
          strokeWidth={tier === 3 ? 2.4 : 1.6}
        />
      )}
      {tier === 1 && (
        <circle
          cx="27"
          cy="27"
          r="23.5"
          fill="none"
          stroke={color}
          strokeWidth="0.9"
          strokeDasharray="2 3"
          opacity="0.8"
        />
      )}
      <I
        x={tier === 3 ? 18 : 16}
        y={tier === 3 ? 18 : 16}
        width={tier === 3 ? 18 : 22}
        height={tier === 3 ? 18 : 22}
        strokeWidth={1.9}
        color={tier >= 2 ? color : "var(--accent)"}
      />
      {tier >= 2 && (
        <g fill="#fff">
          <path className="bdg-tw" d={spark(9, 12, 3)} />
          <path className="bdg-tw" d={spark(45, 10, 2.4)} />
          <path className="bdg-tw" d={spark(44, 44, 2.8)} />
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
