import { SITE } from "./site";

/**
 * IndexNow (Bing, Yandex, Seznam, Naver…): tells search engines a page is new or changed so
 * they crawl it in minutes instead of days. The key is public by design; its file is
 * public/b22a68f4237256d9960adf0c9e5ad8a1.txt. Only the live site pings.
 */
export const INDEXNOW_KEY = "b22a68f4237256d9960adf0c9e5ad8a1";

export async function pingIndexNow(paths: string[]) {
  if (process.env.VERCEL_ENV !== "production" || !paths.length) return;
  const host = new URL(SITE.url).host;
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE.url}/${INDEXNOW_KEY}.txt`,
      urlList: paths.map((p) => `${SITE.url}${p}`),
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => undefined);
}
