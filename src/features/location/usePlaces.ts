"use client";

import { useSyncExternalStore } from "react";
import { EMPTY, read, subscribe } from "./store";

export function usePlaces() {
  const places = useSyncExternalStore(subscribe, read, () => EMPTY);
  const active = places.list.find((p) => p.id === places.active) ?? null;
  return { places, active };
}
