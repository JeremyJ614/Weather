/**
 * Saved places (up to five) and which one is active, kept on this device. Phase 08 syncs them
 * to the signed-in account. Coordinates are always the snapped grid point.
 */
import { snap } from "@/lib/weather/geo";

export const MAX_PLACES = 5;
const KEY = "sswx-places";
const EVENT = "sswx-places";

export type Place = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  source: "gps" | "zip" | "search";
};
export type Places = { list: Place[]; active: string | null };

export const EMPTY: Places = { list: [], active: null };

export function placeId(lat: number, lon: number) {
  const [a, b] = snap(lat, lon);
  return `${a},${b}`;
}

/** Adds (or re-activates) a place. Returns null when the list is full. */
export function addPlace(state: Places, p: Omit<Place, "id">): Places | null {
  const [lat, lon] = snap(p.lat, p.lon);
  const id = placeId(lat, lon);
  if (state.list.some((x) => x.id === id)) return { ...state, active: id };
  if (state.list.length >= MAX_PLACES) return null;
  return { list: [...state.list, { ...p, lat, lon, id }], active: id };
}

export function removePlace(state: Places, id: string): Places {
  const list = state.list.filter((x) => x.id !== id);
  const active = state.active === id ? (list[0]?.id ?? null) : state.active;
  return { list, active };
}

export function setActive(state: Places, id: string): Places {
  return state.list.some((x) => x.id === id) ? { ...state, active: id } : state;
}

export function parse(raw: string | null): Places {
  try {
    const v = JSON.parse(raw ?? "") as Places;
    if (!Array.isArray(v.list)) return EMPTY;
    const list = v.list
      .filter(
        (x) =>
          x &&
          typeof x.lat === "number" &&
          typeof x.lon === "number" &&
          typeof x.label === "string",
      )
      .slice(0, MAX_PLACES);
    const active = list.some((x) => x.id === v.active)
      ? v.active
      : (list[0]?.id ?? null);
    return { list, active };
  } catch {
    return EMPTY;
  }
}

// External store for useSyncExternalStore. The snapshot is cached by raw string so React
// sees a stable object between changes.
let cacheRaw: string | null | undefined;
let cacheVal: Places = EMPTY;

export function read(): Places {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheVal = parse(raw);
  }
  return cacheVal;
}

export function write(next: Places) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: the choice lasts for this page view only.
    cacheRaw = JSON.stringify(next);
    cacheVal = next;
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}
