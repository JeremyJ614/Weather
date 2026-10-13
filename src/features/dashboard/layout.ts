/** Which dashboard widgets show, in what order. Saved on this device (account sync in 62b). */
export const WIDGETS = [
  { id: "now", title: "Right now" },
  { id: "hourly", title: "Next 24 hours" },
  { id: "week", title: "7-day" },
  { id: "spc", title: "SPC severe risk" },
  { id: "uv", title: "UV index" },
  { id: "sun", title: "Sunrise & sunset" },
  { id: "moon", title: "Moon phase" },
  { id: "wind", title: "Wind" },
  { id: "pressure", title: "Pressure trend" },
  { id: "feels", title: "Feels like" },
  { id: "dew", title: "Dew point & humidity" },
  { id: "aqi", title: "Air quality" },
  { id: "pollen", title: "Pollen" },
] as const;

export type WidgetId = (typeof WIDGETS)[number]["id"];
export type Layout = { order: WidgetId[]; hidden: WidgetId[] };

const ids = WIDGETS.map((w) => w.id) as WidgetId[];
export const DEFAULT_LAYOUT: Layout = { order: ids, hidden: [] };

/** Keeps known ids, drops unknown ones, and appends widgets added since the layout was saved. */
export function cleanLayout(v: unknown): Layout {
  const o = (v ?? {}) as Partial<Layout>;
  const known = (a: unknown) =>
    Array.isArray(a)
      ? a.filter((x): x is WidgetId => ids.includes(x as WidgetId))
      : [];
  const order = [...new Set(known(o.order))];
  return {
    order: [...order, ...ids.filter((i) => !order.includes(i))],
    hidden: [...new Set(known(o.hidden))],
  };
}

export function move(l: Layout, id: WidgetId, dir: -1 | 1): Layout {
  const visible = l.order.filter((i) => !l.hidden.includes(i));
  const at = visible.indexOf(id);
  const swap = visible[at + dir];
  if (at < 0 || !swap) return l;
  const order = [...l.order];
  const a = order.indexOf(id);
  const b = order.indexOf(swap);
  [order[a], order[b]] = [order[b], order[a]];
  return { ...l, order };
}

export const toggle = (l: Layout, id: WidgetId): Layout => ({
  ...l,
  hidden: l.hidden.includes(id)
    ? l.hidden.filter((i) => i !== id)
    : [...l.hidden, id],
});

const KEY = "sswx-dashboard";
let raw: string | null | undefined;
let cached: Layout = DEFAULT_LAYOUT;
export function readLayout(): Layout {
  let r: string | null = null;
  try {
    r = localStorage.getItem(KEY);
  } catch {
    return cached;
  }
  if (r !== raw) {
    raw = r;
    try {
      cached = r ? cleanLayout(JSON.parse(r)) : DEFAULT_LAYOUT;
    } catch {
      cached = DEFAULT_LAYOUT;
    }
  }
  return cached;
}
export function writeLayout(l: Layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    cached = l;
  }
  window.dispatchEvent(new Event(KEY));
}
export function subscribeLayout(cb: () => void) {
  window.addEventListener(KEY, cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(KEY, cb);
    window.removeEventListener("storage", onStorage);
  };
}
