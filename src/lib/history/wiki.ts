import "server-only";
import type { OtdFeature } from "./onthisday";

/**
 * Wikipedia for On This Day's featured event: the article about it (its text grounds the
 * write-up) and up to three freely licensed photos from it, each with its credit. When no
 * article fits, or it has no usable photos, there are none: nothing is ever made up.
 */
const API = "https://en.wikipedia.org/w/api.php";
const REST = "https://en.wikipedia.org/api/rest_v1";
const UA = {
  "User-Agent":
    "StormSync Weather (https://weather.sswx.space; weather history)",
};
const MONTHS =
  "January February March April May June July August September October November December".split(
    " ",
  );

export type Photo = {
  src: string;
  w: number;
  h: number;
  /** The file's page on Wikimedia Commons, for the credit link. */
  page: string;
  credit: string;
  caption: string;
};
export type Article = { title: string; url: string; text: string };

async function json<T>(url: string, retry = true): Promise<T | null> {
  const r = await fetch(url, {
    headers: UA,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  // Rate limited: wait a moment and ask once more.
  if (r?.status === 429 && retry) {
    await new Promise((ok) => setTimeout(ok, 2000));
    return json<T>(url, false);
  }
  return r?.ok ? ((await r.json()) as T) : null;
}

const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The article that covers this event, checked to name its year (or storm), month and a state.
 * Null when there is none; throws when Wikipedia didn't answer, so the caller can try later.
 */
export async function findArticle(f: OtdFeature, md: string) {
  const month = MONTHS[Number(md.slice(0, 2)) - 1];
  let failed = false;
  for (const q of f.query) {
    const s = await json<{ query?: { search?: { title: string }[] } }>(
      `${API}?action=query&list=search&format=json&srlimit=4&srsearch=${encodeURIComponent(q)}`,
    );
    if (!s) failed = true;
    for (const { title } of s?.query?.search ?? []) {
      if (!f.accept.every((w) => title.includes(w))) continue;
      if (/^List of|disambiguation/i.test(title)) continue;
      const x = await json<{
        query?: {
          pages?: Record<string, { extract?: string; fullurl?: string }>;
        };
      }>(
        `${API}?action=query&format=json&prop=extracts|info&inprop=url&explaintext=1&redirects=1&titles=${encodeURIComponent(title)}`,
      );
      if (!x) failed = true;
      const page = Object.values(x?.query?.pages ?? {})[0];
      const text = page?.extract ?? "";
      // The whole article (exchars stops at 1,200): it must be about this day, its month and
      // year in the text.
      if (!text.includes(month) || !text.includes(String(f.year))) continue;
      // ...and about this country's event: it names a state the event touched.
      if (f.places.length && !f.places.some((p) => text.includes(p))) continue;
      return {
        title,
        url:
          page?.fullurl ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        text: text.slice(0, 6000),
      } satisfies Article;
    }
  }
  if (failed) throw new Error("Wikipedia didn't answer");
  return null;
}

/** Up to three photos from the article, freely licensed, maps and logos left out (throws when Wikipedia didn't answer). */
export async function articlePhotos(title: string): Promise<Photo[]> {
  const m = await json<{ items?: { title: string; type: string }[] }>(
    `${REST}/page/media-list/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  );
  if (!m) throw new Error("Wikipedia didn't answer");
  const files = (m?.items ?? [])
    .filter(
      (i) =>
        i.type === "image" &&
        /\.(jpe?g|png)$/i.test(i.title) &&
        !/map|track|path|logo|seal|flag|icon|chart|graph|diagram|locator|outline/i.test(
          i.title,
        ),
    )
    .slice(0, 8)
    .map((i) => i.title);
  if (!files.length) return [];
  const info = await json<{
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: {
            thumburl?: string;
            thumbwidth?: number;
            thumbheight?: number;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }[];
        }
      >;
    };
  }>(
    `${API}?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&titles=${encodeURIComponent(files.join("|"))}`,
  );
  const out: Photo[] = [];
  for (const name of files) {
    const p = Object.values(info?.query?.pages ?? {}).find(
      (x) =>
        x.title === name ||
        x.title.replace(/_/g, " ") === name.replace(/_/g, " "),
    );
    const ii = p?.imageinfo?.[0];
    const meta = ii?.extmetadata ?? {};
    const license = plain(meta.LicenseShortName?.value ?? "");
    // Public domain and Creative Commons only, credited as their licenses ask.
    if (!ii?.thumburl || !/public domain|^pd|cc[ -]/i.test(license)) continue;
    const artist = plain(meta.Artist?.value ?? "").slice(0, 80);
    out.push({
      src: ii.thumburl,
      w: ii.thumbwidth ?? 900,
      h: ii.thumbheight ?? 600,
      page: ii.descriptionurl ?? "",
      credit: `${artist ? `${artist}, ` : ""}${license}, via Wikimedia Commons`,
      caption: plain(meta.ImageDescription?.value ?? "").slice(0, 160),
    });
    if (out.length >= 3) break;
  }
  return out;
}
