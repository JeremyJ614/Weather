"use client";

import { useEffect, useState } from "react";
import { W, H } from "@/features/maps/UsMap";
import type { WarnPoly } from "@/lib/history/data";

/**
 * Many thousands of warnings (a year of them) as one picture on the map instead of thousands
 * of SVG shapes, so panning stays smooth on a phone (Fix list 2026-10-30 #7). Drawn once per
 * data change at up to 4× the map's size, sharp at the national view and well zoomed in.
 */
export function RasterPaths({
  polys,
  fill,
  line,
}: {
  polys: WarnPoly[];
  fill: (p: WarnPoly) => string;
  line: (p: WarnPoly) => string | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    let made: string | null = null;
    const tier = document.documentElement.dataset.tier;
    const k = tier === "low" ? 2 : tier === "mid" ? 3 : 4;
    const cv = document.createElement("canvas");
    cv.width = W * k;
    cv.height = H * k;
    const g = cv.getContext("2d");
    if (!g) return;
    g.scale(k, k);
    g.lineJoin = "round";
    for (const p of polys) {
      const path = new Path2D(p.d);
      g.globalAlpha = 0.5;
      g.fillStyle = fill(p);
      g.fill(path);
      g.globalAlpha = 1;
      const c = line(p);
      g.strokeStyle = c ?? fill(p);
      g.lineWidth = c ? 0.4 + p.tier * 0.5 : 0.3;
      g.stroke(path);
    }
    cv.toBlob((b) => {
      if (!b || gone) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    }, "image/png");
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
    };
    // The color helpers follow the same colors as `polys`' page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polys]);
  return url ? <image href={url} x={0} y={0} width={W} height={H} /> : null;
}
