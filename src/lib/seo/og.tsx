import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { SITE } from "./site";

/** Share images are 1200×630, the size every network crops to. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

// The default (VIP Gold) palette: share images can't read the theme's CSS variables.
const C = {
  bg: "#0b0c14",
  surface: "#13141f",
  line: "#23253a",
  text: "#eceef5",
  muted: "#8f92a8",
  accent: "#d9b76f",
};

let icon: Promise<string> | null = null;
const iconSrc = () =>
  (icon ??= readFile(
    join(process.cwd(), "public", "icons", "icon-192.png"),
    "base64",
  ).then((b) => `data:image/png;base64,${b}`));

/**
 * A share card: the app's mark and name, an eyebrow, a big title and a line under it, with
 * optional art (a map) on the right. Dark surface, gold text and outline, no fills.
 */
export async function ogCard({
  eyebrow,
  title,
  sub,
  art,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  art?: ReactNode;
}) {
  const logo = await iconSrc();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: `radial-gradient(circle at 85% 20%, #1c1e2c, ${C.bg} 60%)`,
        color: C.text,
        padding: 56,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: art ? 560 : "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori draws plain img */}
          <img
            src={logo}
            width={64}
            height={64}
            alt=""
            style={{ borderRadius: 16 }}
          />
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>
            {SITE.name.toUpperCase()}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span
            style={{
              fontSize: 24,
              color: C.accent,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              fontSize: art ? 64 : 76,
              fontWeight: 800,
              lineHeight: 1.05,
            }}
          >
            {title}
          </span>
          {sub && (
            <span style={{ fontSize: 28, color: C.muted, lineHeight: 1.35 }}>
              {sub}
            </span>
          )}
        </div>
        <span
          style={{
            display: "flex",
            alignSelf: "flex-start",
            border: `2px solid ${C.accent}`,
            borderRadius: 999,
            padding: "10px 24px",
            fontSize: 24,
            color: C.accent,
          }}
        >
          {SITE.url.replace("https://", "")}
        </span>
      </div>
      {art && (
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            marginLeft: 24,
          }}
        >
          {art}
        </div>
      )}
    </div>,
    OG_SIZE,
  );
}

/** An SVG string as an image satori can draw. */
export const svgImg = (svg: string, w: number, h: number) => (
  // eslint-disable-next-line @next/next/no-img-element -- satori draws plain img
  <img
    src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
    width={w}
    height={h}
    alt=""
  />
);
