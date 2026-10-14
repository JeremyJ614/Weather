import { pick, type Colors } from "@/lib/colors/pick";

/** SPC fire weather outlook categories (by GeoJSON LABEL) with their default colors. */
export const FIRE_RISK: Record<string, { label: string; color: string }> = {
  ELEV: { label: "Elevated", color: "#ffa95c" },
  CRIT: { label: "Critical", color: "#e5484d" },
  EXTM: { label: "Extremely critical", color: "#d946ef" },
  IsoDryT: { label: "Isolated dry thunderstorms", color: "#c9a86a" },
  SctDryT: { label: "Scattered dry thunderstorms", color: "#8b5a2b" },
};
/** Fire dots by containment. */
export const CONTAIN: { key: string; label: string; color: string }[] = [
  { key: "low", label: "Under 25% contained", color: "#ef4444" },
  { key: "mid", label: "25–74% contained", color: "#f97316" },
  { key: "high", label: "75%+ contained", color: "#facc15" },
  { key: "unknown", label: "Containment not reported", color: "#a3a3a3" },
];

export function containKey(pct: number | null): string {
  return pct == null ? "unknown" : pct < 25 ? "low" : pct < 75 ? "mid" : "high";
}
export function containColor(pct: number | null, colors: Colors = {}): string {
  const c = CONTAIN.find((x) => x.key === containKey(pct))!;
  return pick(colors, `fire:contain:${c.key}`, c.color);
}

/** Great-circle miles. */
export function miles(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) *
      Math.cos(b.lat * r) *
      Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
