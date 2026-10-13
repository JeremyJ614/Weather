/** IEM Local Storm Reports: what people on the ground reported (ported from VIP). */

export type ReportKind =
  | "tornado"
  | "funnel"
  | "hail"
  | "wind"
  | "flood"
  | "snow"
  | "fire"
  | "lightning"
  | "other";

/** LSR type text is free-ish; substrings keep new phrasings out of the void. */
export function classify(text: string): ReportKind {
  const t = text.toUpperCase();
  if (t.includes("TORNADO")) return "tornado";
  if (t.includes("FUNNEL")) return "funnel";
  if (t.includes("HAIL")) return "hail";
  if (t.includes("WND") || t.includes("WIND")) return "wind";
  if (t.includes("FLOOD")) return "flood";
  if (/SNOW|SLEET|ICE|BLIZZARD/.test(t)) return "snow";
  if (t.includes("FIRE")) return "fire";
  if (t.includes("LIGHTNING")) return "lightning";
  return "other";
}

export const KIND: Record<ReportKind, { label: string; color: string }> = {
  tornado: { label: "Tornado", color: "#ef4444" },
  funnel: { label: "Funnel cloud", color: "#f97316" },
  hail: { label: "Hail", color: "#e8bb4d" },
  wind: { label: "Wind", color: "#c084fc" },
  flood: { label: "Flooding", color: "#38bdf8" },
  snow: { label: "Snow & ice", color: "#c7d2fe" },
  fire: { label: "Fire", color: "#fb923c" },
  lightning: { label: "Lightning", color: "#fde047" },
  other: { label: "Other", color: "#8f8fb0" },
};

export type Report = {
  kind: ReportKind;
  type: string;
  mag: number | null;
  unit: string;
  city: string;
  county: string;
  st: string;
  lat: number;
  lon: number;
  valid: string;
  remark: string;
  source: string;
};

/** "1.75 in" hail, "70 mph" wind; nothing when the report has no magnitude. */
export function magnitude(r: Pick<Report, "kind" | "mag" | "unit">) {
  if (r.mag === null || r.mag <= 0) return null;
  const u = r.unit.toUpperCase();
  if (r.kind === "hail") return `${r.mag}" hail`;
  if (u === "MPH") return `${Math.round(r.mag)} mph`;
  if (u === "INCH") return `${r.mag}"`;
  return `${r.mag} ${r.unit.toLowerCase()}`;
}

export const milesBetween = (a: number, b: number, c: number, d: number) => {
  const r = Math.PI / 180;
  const x =
    Math.sin(((c - a) * r) / 2) ** 2 +
    Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
  return 7917.6 * Math.asin(Math.sqrt(x));
};
