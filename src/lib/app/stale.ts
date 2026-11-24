/**
 * After a deploy the site answers 404 for the previous build's chunks, while the installed app may still run an
 * earlier page, so the first lazy load (the radar decoders, a chart) fails until a reload (Fix It List #35, 1 and 2).
 * Then the page reloads itself once, at most every ten minutes, so it can never loop.
 */
export const isStaleChunk = (e: unknown) =>
  /chunk|dynamically imported|module script/i.test(
    String((e as { message?: string })?.message ?? e),
  );

export function reloadForUpdate() {
  try {
    if (Date.now() - Number(sessionStorage.sswxStale || 0) < 6e5) return false;
    sessionStorage.sswxStale = Date.now();
  } catch {
    return false;
  }
  location.reload();
  return true;
}
