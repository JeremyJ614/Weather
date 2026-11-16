import { ImageResponse } from "next/og";
import states from "@/lib/map/data/usStatesAlbers.json";
import { project } from "@/lib/map/usAlbers";
import { archiveEvent, severeToday } from "@/lib/stories/build";

/**
 * Web Story pictures (B8), portrait for phones: `k=map` draws the event's surveyed tracks over
 * state lines, zoomed to the tracks; `cover` and `poster` add the title. Static per event, so
 * the CDN keeps each one for a week.
 */
export const revalidate = 604800;

const EF: Record<string, string> = {
  EF0: "#7dd3fc",
  EF1: "#a3e635",
  EF2: "#facc15",
  EF3: "#fb923c",
  EF4: "#f43f5e",
  EF5: "#e879f9",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const k = new URL(req.url).searchParams.get("k") ?? "map";
  const [W, H] = k === "poster" ? [640, 853] : [720, 1280];
  let title = "";
  let sub = "";
  let tracks: { ef: string; pts: { x: number; y: number }[] }[] = [];
  if (id === "severe-today") {
    const st = await severeToday();
    title = st?.title ?? "Severe storms today";
    sub = st?.description ?? "";
  } else {
    const f = await archiveEvent(id);
    if (!f) return new Response("Not found", { status: 404 });
    title = f.name;
    sub = f.region;
    tracks = (f.torn ?? []).map((t) => ({
      ef: t.ef,
      pts: t.coords.map(([lon, lat]) => project(lon, lat)),
    }));
  }
  // The view: the tracks' box (at least ~300 km across), padded, shaped to the picture.
  const all = tracks.flatMap((t) => t.pts);
  const [bx0, bx1, by0, by1] = all.length
    ? [
        Math.min(...all.map((p) => p.x)),
        Math.max(...all.map((p) => p.x)),
        Math.min(...all.map((p) => p.y)),
        Math.max(...all.map((p) => p.y)),
      ]
    : [0, 975, 0, 610];
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  let w = Math.max(60, (bx1 - bx0) * 1.5);
  let h = Math.max(60, (by1 - by0) * 1.5);
  if (w / h > W / H) h = (w * H) / W;
  else w = (h * W) / H;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  const scale = w / W;
  const showTitle = k !== "map";
  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        position: "relative",
        background: "#0b0c14",
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`${x0} ${y0} ${w} ${h}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {(states as { states: { d: string }[] }).states.map((s, i) => (
          <path
            key={i}
            d={s.d}
            fill="#13141f"
            stroke="#3a3f5c"
            strokeWidth={1.2 * scale}
          />
        ))}
        {tracks.map((t, i) => (
          <polyline
            key={i}
            points={t.pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={EF[t.ef] ?? "#d9b76f"}
            strokeWidth={Math.max(2.4, 5 - tracks.length / 40) * scale}
            strokeLinecap="round"
          />
        ))}
      </svg>
      {showTitle && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            padding: "40px 36px 64px",
            background:
              "linear-gradient(180deg, rgba(11,12,20,0) 0%, rgba(11,12,20,0.95) 45%)",
          }}
        >
          <div
            style={{
              color: "#d9b76f",
              fontSize: 22,
              letterSpacing: 3,
              fontWeight: 700,
            }}
          >
            STORMSYNC WEATHER
          </div>
          <div
            style={{
              color: "#eceef5",
              fontSize: k === "poster" ? 50 : 58,
              fontWeight: 800,
              lineHeight: 1.05,
              marginTop: 10,
            }}
          >
            {title}
          </div>
          <div style={{ color: "#8f92a8", fontSize: 26, marginTop: 10 }}>
            {sub.slice(0, 90)}
          </div>
        </div>
      )}
    </div>,
    {
      width: W,
      height: H,
      headers: {
        "Cache-Control":
          "public, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
