"use client";

import { lazy, Suspense, useId } from "react";
import type { ScrubProps } from "./InfoScrubCore";
import s from "./InfoScrub.module.css";

export type { ScrubProps, ScrubSeries } from "./InfoScrubCore";

const Core = lazy(() =>
  import("./InfoScrubCore").then((m) => ({ default: m.InfoScrubCore })),
);

/**
 * The drag-to-read chart layer (post-launch B1), loaded as its own small chunk after the page
 * appears: the chart draws at once and the handle fades in a moment later, so no page pays for
 * it up front. See InfoScrubCore for how it works.
 */
export function InfoScrub(props: ScrubProps) {
  return (
    <Suspense fallback={null}>
      <Core {...props} />
    </Suspense>
  );
}

/**
 * Wraps a chart's lines so they draw in from the left the first time they render, like the
 * info graph's intro: a clip rectangle scaled from 0 to full width (transform only).
 */
export function DrawIn({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <>
      <defs>
        <clipPath id={`${id}-draw`}>
          <rect
            className={s.draw}
            x="0"
            y="-20"
            width={width}
            height={height + 40}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-draw)`}>{children}</g>
    </>
  );
}

/** Gridlines that sweep in one after another (put on the <g> holding them). */
export const gridIn = s.gridIn;
/** The same for vertical gridlines (they rise from the bottom). */
export const gridInV = s.gridInV;
