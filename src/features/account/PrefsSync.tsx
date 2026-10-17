"use client";

import { useEffect } from "react";
import {
  read as readPlaces,
  subscribe,
  write as writePlaces,
} from "@/features/location/store";
import { KEYS, type Prefs } from "@/lib/prefs-keys";
import { useViewer } from "./useViewer";

/** Applies a theme to the page now (a theme is only two attributes). */
export function applyTheme(t: { palette: string; font: string }) {
  document.documentElement.dataset.palette = t.palette;
  document.documentElement.dataset.font = t.font;
}

/** Saves preferences on the device and, when signed in, to the account. */
export function savePrefs(p: Prefs, signedIn: boolean) {
  try {
    if (p.menus) localStorage.setItem(KEYS.menus, JSON.stringify(p.menus));
    if (p.theme) localStorage.setItem(KEYS.theme, JSON.stringify(p.theme));
    if (p.intro) localStorage.setItem(KEYS.intro, p.intro);
    if (p.toured) localStorage.setItem(KEYS.tour, "done");
  } catch {}
  // The menu host listens for storage events; same-tab writes don't fire one.
  if (p.menus) dispatchEvent(new StorageEvent("storage", { key: KEYS.menus }));
  if (p.theme) applyTheme(p.theme);
  if (!signedIn) return Promise.resolve(false);
  return fetch("/api/me/prefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  })
    .then((r) => r.ok)
    .catch(() => false);
}

const has = (k: string) => {
  try {
    return localStorage.getItem(k) != null;
  } catch {
    return true;
  }
};

/**
 * On sign-in, fills in whatever this device hasn't chosen from the account, then keeps
 * saved places in step with the account as they change.
 */
export function PrefsSync() {
  const viewer = useViewer();
  const on = viewer.signedIn && !viewer.pending;
  useEffect(() => {
    if (!on) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = JSON.stringify(readPlaces());
    fetch("/api/me/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((raw) => {
        if (!live) return;
        // The server already checked these against what the app offers.
        const p = raw as Prefs;
        const fill: Prefs = {};
        if (p.menus && !has(KEYS.menus)) fill.menus = p.menus;
        if (p.theme && !has(KEYS.theme)) fill.theme = p.theme;
        if (p.intro && !has(KEYS.intro)) fill.intro = p.intro;
        if (p.toured) fill.toured = true;
        savePrefs(fill, false);
        let toured = false;
        try {
          toured = localStorage.getItem(KEYS.tour) === "done";
        } catch {}
        if (toured && !p.toured) savePrefs({ toured }, true);
        if (p.places && !readPlaces().list.length) {
          writePlaces(p.places);
          last = JSON.stringify(p.places);
        } else if (!p.places && readPlaces().list.length)
          savePrefs({ places: readPlaces() }, true);
      })
      .catch(() => {})
      // The member tour waits for this, so it never replays for someone who has seen it.
      .finally(() => {
        if (live) document.documentElement.dataset.prefs = "ready";
      });
    const off = subscribe(() => {
      const now = JSON.stringify(readPlaces());
      if (now === last) return;
      last = now;
      clearTimeout(timer);
      timer = setTimeout(() => savePrefs({ places: readPlaces() }, true), 1500);
    });
    return () => {
      live = false;
      clearTimeout(timer);
      off();
    };
  }, [on]);
  return null;
}
