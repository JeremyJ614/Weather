"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { BorderBeamProps, BorderBeamSize } from "./border-beam-search";
import { useTier } from "@/features/motion/useTier";
import s from "./Beam.module.css";

export type Still = "ring" | "fade" | "under" | "edge";

type BeamComponent = (p: BorderBeamProps) => ReactNode;
let loaded: BeamComponent | null = null;
let loading: Promise<BeamComponent> | null = null;
const load = () =>
  (loading ??= import("./border-beam-search").then(
    (m) => (loaded = m.BorderBeam as unknown as BeamComponent),
  ));

/**
 * The multicolor traveling outline used on bordered buttons and menu items.
 * The effect library loads after first paint (it is decoration, so it stays
 * out of every route's startup JavaScript); slow phones keep the still outline.
 */
export function Beam({
  children,
  size = "sm",
  className,
  duration,
  strength = 0.9,
  style,
  still,
}: {
  /** A static multicolor outline instead of the moving beam (no animation, no effect library). */
  still?: Still;
  children: ReactNode;
  size?: BorderBeamSize;
  className?: string;
  duration?: number;
  strength?: number;
  style?: CSSProperties;
}) {
  const tier = useTier();
  const animate = !still;
  const [Comp, setComp] = useState<BeamComponent | null>(() => loaded);
  useEffect(() => {
    if (!animate || Comp || tier === "low") return;
    let live = true;
    load().then((c) => live && setComp(() => c));
    return () => {
      live = false;
    };
  }, [animate, Comp, tier]);
  if (still)
    return (
      <div
        className={`${s.still} ${s[still]} ${className ?? ""}`}
        style={{ position: "relative", ...style }}
      >
        {children}
      </div>
    );
  if (!Comp || tier === "low")
    return (
      <div className={className} style={{ position: "relative", ...style }}>
        {children}
      </div>
    );
  return (
    <Comp
      size={size}
      colorVariant="colorful"
      theme="dark"
      duration={duration}
      strength={strength}
      className={className}
      style={style}
    >
      {children}
    </Comp>
  );
}
