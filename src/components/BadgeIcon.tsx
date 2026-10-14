import type { LucideIcon } from "lucide-react";
import {
  Award,
  CloudLightning,
  Crown,
  Droplets,
  Flame,
  Gem,
  Heart,
  Medal,
  Moon,
  Rocket,
  Shield,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Target,
  Tornado,
  Trophy,
  Wind,
  Zap,
} from "lucide-react";
import { pick, type Colors } from "@/lib/colors/pick";
import { RARITY, type Badge } from "@/lib/badges";

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
  Snowflake,
  Sun,
  Moon,
  Wind,
  Droplets,
  Target,
  Shield,
  Heart,
  Rocket,
};

/** A badge medallion: its icon, ringed and lit in its rarity color. */
export function BadgeIcon({
  badge,
  colors,
  size = 40,
}: {
  badge: Pick<Badge, "icon" | "rarity" | "name">;
  colors?: Colors;
  size?: number;
}) {
  const I = BADGE_ICONS[badge.icon] ?? Award;
  const c = pick(
    colors,
    `badge:${badge.rarity}`,
    RARITY[badge.rarity] ?? RARITY.common,
  );
  return (
    <span
      title={badge.name}
      className="grid shrink-0 place-items-center rounded-full border-2 bg-bg"
      style={{
        width: size,
        height: size,
        borderColor: c,
        color: c,
        boxShadow: `0 0 14px color-mix(in srgb, ${c} 35%, transparent)`,
      }}
    >
      <I style={{ width: size * 0.5, height: size * 0.5 }} aria-hidden />
    </span>
  );
}
