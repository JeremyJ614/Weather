/**
 * Date formatters, made once.
 *
 * Building an Intl.DateTimeFormat is the expensive part of formatting a time —
 * it loads and resolves the zone's rules — and `toLocaleTimeString(…, options)`
 * builds a fresh one on every call. The replay formats the clock, the zone and
 * the axis labels on every frame, which a profile showed costing more than
 * everything else the app itself does per frame. The same options always give
 * the same formatter, so each is made once and kept.
 */
const cache = new Map<string, Intl.DateTimeFormat>();

export function dateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    // Throws on an unknown zone, before anything is cached — callers catch it.
    f = new Intl.DateTimeFormat(locale, options);
    cache.set(key, f);
  }
  return f;
}
