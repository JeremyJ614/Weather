/**
 * The daily data the site builds without a deploy (.github/workflows/data.yml): the History
 * Globe's tracks and the 7-day rain and snow maps, rebuilt on GitHub Actions and kept on this
 * repository's `data` branch. Browsers read them straight from jsDelivr's CDN (free, and none
 * of it counts against Vercel's bandwidth), pinned to the exact commit `latest.json` names so a
 * cached file can never be mixed with a newer one.
 */
const REPO = "JeremyJ614/Weather";

export type Latest = {
  /** The commit holding this build's files. */
  sha: string;
  built: string;
  tracks?: { built: string; storms: number };
  rain?: { built: string; end: string };
  snow?: { built: string; end: string };
};

async function get(url: string, ms: number) {
  const r = await fetch(url, {
    cache: "no-cache",
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json() as Promise<Latest>;
}

let memo: Promise<Latest | null> | null = null;

/** Which build is newest (GitHub's raw file first, the CDN's copy if that fails), or null. */
export function latest(): Promise<Latest | null> {
  memo ??= get(
    `https://raw.githubusercontent.com/${REPO}/data/latest.json`,
    5000,
  )
    .catch(() =>
      get(`https://cdn.jsdelivr.net/gh/${REPO}@data/latest.json`, 6000),
    )
    .then((l) => (l && /^[0-9a-f]{40}$/.test(l.sha) ? l : null))
    .catch(() => null);
  memo.then((l) => {
    if (!l) memo = null;
  });
  return memo;
}

/** Where a file of a build lives: the CDN first, GitHub itself after. */
export const dataUrls = (l: Latest, path: string) => [
  `https://cdn.jsdelivr.net/gh/${REPO}@${l.sha}/${path}`,
  `https://raw.githubusercontent.com/${REPO}/${l.sha}/${path}`,
];

/** A file of a build, from the CDN (the same file on GitHub when the CDN fails). */
export async function dataFetch(l: Latest, path: string) {
  const urls = dataUrls(l, path);
  let err: unknown;
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
      if (r.ok) return r;
      err = new Error(`${u} ${r.status}`);
    } catch (e) {
      err = e;
    }
  }
  throw err;
}
