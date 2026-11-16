import "server-only";
import { JTWC, parseTcw, warningCodes, type WorldStorm } from "./jtwc";

/**
 * Every JTWC warning in force outside NHC's basins (West Pacific, North Indian Ocean,
 * Southern Hemisphere), or null when JTWC isn't answering. Shared by the Tropical Outlook's
 * Worldwide tab and Earth Watch so both always show the same storms.
 */
export async function worldStorms(): Promise<WorldStorm[] | null> {
  const rss = await fetch(`${JTWC}/rss/jtwc.rss`, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!rss?.ok) return null;
  const codes = warningCodes(await rss.text());
  const storms = await Promise.all(
    codes.map(async (code) => {
      const r = await fetch(`${JTWC}/products/${code}.tcw`, {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(15000),
      }).catch(() => null);
      return r?.ok ? parseTcw(await r.text(), code) : null;
    }),
  );
  return storms.filter((s): s is WorldStorm => s !== null);
}
