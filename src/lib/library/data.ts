import "server-only";
import LIB from "./library.json";

/**
 * The Free Content Library (ported from the Academy): NOAA National Weather Service
 * JetStream, converted whole into our own blocks. Public domain (17 U.S.C. § 105), so the
 * full text lives here and every article names and links its source. 14 shelves, 118
 * articles, figures mirrored as WebP in /public/library.
 */
export type Block =
  | { type: "rich-text"; props: { body: string } }
  | { type: "heading"; props: { text: string; level: number } }
  | {
      type: "figure";
      props: {
        src: string;
        alt: string;
        caption: string;
        credit: string;
        width: number;
        height: number;
      };
    }
  | { type: "bulleted-list" | "numbered-list"; props: { items: string[] } }
  | {
      type: "table";
      props: { caption: string; headers: string[]; rows: string[][] };
    }
  | { type: "callout"; props: { tone: string; title: string; body: string } };

export type Article = {
  slug: string;
  section: string;
  title: string;
  summary: string;
  source_name: string;
  source_url: string;
  licence: string;
  reading_minutes: string;
  position: string;
  body: Block[];
};
export type Section = {
  slug: string;
  title: string;
  blurb: string;
  position: number;
};

const ARTICLES = LIB.articles as unknown as Article[];
const SECTIONS = (LIB.sections as Section[]).sort(
  (a, b) => a.position - b.position,
);
export const SOURCE = LIB.source as {
  name: string;
  home: string;
  licence: string;
};

const plain = (b: Block) =>
  b.type === "rich-text"
    ? b.props.body
    : b.type === "heading"
      ? b.props.text
      : b.type === "bulleted-list" || b.type === "numbered-list"
        ? b.props.items.join(" ")
        : b.type === "callout"
          ? b.props.body
          : b.type === "figure"
            ? b.props.alt
            : "";
const TEXT = new Map(
  ARTICLES.map((a) => [
    a.slug,
    a.body
      .map(plain)
      .join(" ")
      .replace(/[*[\]()]/g, "")
      .toLowerCase(),
  ]),
);

/** Shelves in order, each with its articles in order. */
export function shelves() {
  return SECTIONS.map((s) => ({
    ...s,
    articles: ARTICLES.filter((a) => a.section === s.slug)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map(({ body: _b, ...rest }) => (void _b, rest)),
  })).filter((s) => s.articles.length);
}

export const article = (slug: string) =>
  ARTICLES.find((a) => a.slug === slug) ?? null;
export const sectionOf = (slug: string) =>
  SECTIONS.find((s) => s.slug === slug) ?? null;
export const slugs = () => ARTICLES.map((a) => a.slug);

/** Ranked search: title hits first, then summary, then body; every word must appear. */
export function search(q: string) {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (!words.length) return [];
  return ARTICLES.map((a) => {
    const t = a.title.toLowerCase();
    const s = a.summary.toLowerCase();
    const body = TEXT.get(a.slug) ?? "";
    if (!words.every((w) => t.includes(w) || s.includes(w) || body.includes(w)))
      return null;
    const score = words.reduce(
      (n, w) =>
        n +
        (t.includes(w) ? 10 : 0) +
        (s.includes(w) ? 4 : 0) +
        Math.min(5, body.split(w).length - 1),
      0,
    );
    const at = body.indexOf(words[0]);
    const snippet =
      at >= 0
        ? `…${body.slice(Math.max(0, at - 70), at + 130).trim()}…`
        : a.summary;
    return { slug: a.slug, title: a.title, section: a.section, score, snippet };
  })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
}
