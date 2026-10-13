/** Minimal RSS/Atom reading and story ranking for the Weather News tab. Pure, so it is tested alone. */
export type Story = {
  url: string;
  title: string;
  source: string;
  snippet: string | null;
  severity: number;
  published_at: string | null;
};

const ENT: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}

export const stripTags = (s: string) =>
  decode(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tag = (block: string, name: string) => {
  const m = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,
    "i",
  ).exec(block);
  return m ? m[1] : "";
};

export type RawItem = {
  title: string;
  link: string;
  date: string | null;
  text: string;
};

export function parseFeed(xml: string): RawItem[] {
  const blocks =
    xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];
  return blocks.map((b) => {
    const atomLink = /<link[^>]*href="([^"]+)"/i.exec(b)?.[1];
    const date =
      tag(b, "pubDate") ||
      tag(b, "updated") ||
      tag(b, "published") ||
      tag(b, "dc:date");
    return {
      title: stripTags(tag(b, "title")),
      link: decode(atomLink ?? tag(b, "link")).trim(),
      date:
        date && !Number.isNaN(Date.parse(decode(date)))
          ? new Date(decode(date)).toISOString()
          : null,
      text: stripTags(
        tag(b, "description") || tag(b, "summary") || tag(b, "content"),
      ),
    };
  });
}

/** How severe a story is (higher first). Official hazard products outrank general news. */
export function severityOf(source: string, title: string): number | null {
  const t = title.toLowerCase();
  if (source === "SPC") {
    if (/^spc - no /.test(t) || t === "spc forecast products") return null;
    if (t.includes("tornado watch")) return 90;
    if (t.includes("severe thunderstorm watch")) return 80;
    if (/\bmd\b|mesoscale discussion/.test(t)) return 65;
    if (t.includes("day 1 convective")) return 55;
    if (t.includes("convective") || t.includes("severe thunderstorm outlook"))
      return 45;
    if (t.includes("fire weather")) return 35;
    return 30;
  }
  if (source === "NHC") {
    if (
      /^nhc /.test(t) ||
      t.startsWith("summary for") ||
      t.includes("no tropical cyclones")
    )
      return null;
    if (
      /forecast advisory|discussion|wind speed probabilities|graphics/.test(t)
    )
      return null;
    if (t.includes("public advisory"))
      return t.includes("hurricane")
        ? 92
        : t.includes("tropical storm")
          ? 78
          : 60;
    if (t.includes("tropical weather outlook")) return 40;
    return 35;
  }
  return 25;
}

export function snippet(text: string, max = 220): string | null {
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  // Drop a word cut in half.
  return `${/\s/.test(text[max]) ? cut : cut.replace(/\s+\S*$/, "")}…`;
}

/** Highest severity first, then newest; at most `perSource` from each source. */
export function rank(stories: Story[], limit = 40, perSource = 6): Story[] {
  const sorted = [...stories].sort(
    (a, b) =>
      b.severity - a.severity ||
      Date.parse(b.published_at ?? "1970-01-01") -
        Date.parse(a.published_at ?? "1970-01-01"),
  );
  const seen = new Set<string>();
  const per = new Map<string, number>();
  const out: Story[] = [];
  for (const s of sorted) {
    if (seen.has(s.url)) continue;
    const n = per.get(s.source) ?? 0;
    if (n >= perSource) continue;
    seen.add(s.url);
    per.set(s.source, n + 1);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Applies the admin's pins (in order) and hides to today's ranked stories. */
export function curate(
  stories: Story[],
  curation: { url: string; action: string; position: number }[],
  top = 15,
): (Story & { pinned: boolean })[] {
  const hidden = new Set(
    curation.filter((c) => c.action === "hide").map((c) => c.url),
  );
  const pins = curation
    .filter((c) => c.action === "pin")
    .sort((a, b) => a.position - b.position);
  const byUrl = new Map(stories.map((s) => [s.url, s]));
  const pinned = pins.flatMap((p) =>
    byUrl.has(p.url) && !hidden.has(p.url)
      ? [{ ...byUrl.get(p.url)!, pinned: true }]
      : [],
  );
  const pinnedUrls = new Set(pinned.map((p) => p.url));
  const rest = stories
    .filter((s) => !hidden.has(s.url) && !pinnedUrls.has(s.url))
    .map((s) => ({ ...s, pinned: false }));
  return [...pinned, ...rest].slice(0, top);
}
