/** Turns an NWS Area Forecast Discussion into titled sections of readable paragraphs. */
export type AfdSection = { title: string; paragraphs: string[] };

const TITLES: Record<string, string> = {
  "KEY MESSAGES": "Key messages",
  SYNOPSIS: "Synopsis",
  DISCUSSION: "Discussion",
  "SHORT TERM": "Short term",
  "LONG TERM": "Long term",
  AVIATION: "Aviation",
  "FIRE WEATHER": "Fire weather",
  MARINE: "Marine",
  HYDROLOGY: "Hydrology",
  "PRELIMINARY POINT TEMPS/POPS": "Point forecasts",
  "WFO WATCHES/WARNINGS/ADVISORIES": "Watches, warnings & advisories",
  "WATCHES/WARNINGS/ADVISORIES": "Watches, warnings & advisories",
  UPDATE: "Update",
};

function nice(raw: string) {
  const key = raw.replace(/\.+$/, "").trim().toUpperCase();
  if (key.includes("WATCHES/WARNINGS")) return "Watches, warnings & advisories";
  for (const [k, v] of Object.entries(TITLES)) if (key.startsWith(k)) return v;
  return key.charAt(0) + key.slice(1).toLowerCase();
}

export function parseAfd(text: string): AfdSection[] {
  const body = text
    .replace(/\r/g, "")
    .replace(/^[\s\S]*?\n(?=\.)/, "")
    .replace(/\n\$\$[\s\S]*$/, "");
  const sections: AfdSection[] = [];
  for (const chunk of body.split(/\n(?=\.[A-Z])/)) {
    const m = /^\.([A-Z][A-Z0-9 /&()-]+?)\.{2,}\s*([\s\S]*)$/.exec(
      chunk.trim(),
    );
    if (!m) continue;
    const content = m[2]
      .replace(/\n&&\s*$/, "")
      .replace(/&&/g, "")
      .trim();
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    if (paragraphs.length) sections.push({ title: nice(m[1]), paragraphs });
  }
  return sections;
}
