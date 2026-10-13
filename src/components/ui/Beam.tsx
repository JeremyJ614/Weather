"use client";

import type { CSSProperties, ReactNode } from "react";
import { BorderBeam, type BorderBeamSize } from "./border-beam-search";
import { useTier } from "@/features/motion/useTier";

/**
 * The multicolor traveling outline used on bordered buttons and menu items.
 * Slow phones get the still outline (the beam pauses).
 */
export function Beam({
  children,
  size = "sm",
  className,
  duration,
  strength = 0.9,
  style,
}: {
  style?: CSSProperties;
  children: ReactNode;
  size?: BorderBeamSize;
  className?: string;
  duration?: number;
  strength?: number;
}) {
  const tier = useTier();
  return (
    <BorderBeam
      size={size}
      colorVariant="colorful"
      theme="dark"
      duration={duration}
      strength={strength}
      active={tier !== "low"}
      className={className}
      style={style}
    >
      {children}
    </BorderBeam>
  );
}
