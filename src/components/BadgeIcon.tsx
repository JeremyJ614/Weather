"use client";

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

/**
 * A badge as members see it: the owner's award-badge plate (gunmetal, multicolor stripe),
 * its icon and name in the theme, its rarity in its rarity color.
 */
export function BadgePlate({
  badge,
  colors,
}: {
  badge: Pick<Badge, "icon" | "rarity" | "name"> & { description?: string };
  colors?: Colors;
}) {
  const I = BADGE_ICONS[badge.icon] ?? Award;
  return (
    <AwardBadge
      kicker={`${badge.rarity} badge`}
      kickerColor={pick(
        colors,
        `badge:${badge.rarity}`,
        RARITY[badge.rarity] ?? RARITY.common,
      )}
      title={badge.name || "Badge name"}
      hint={badge.description || undefined}
      icon={<I x={11} y={11} width={32} height={32} strokeWidth={1.8} />}
    />
  );
}
