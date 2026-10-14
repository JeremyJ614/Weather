"use client";

import { useEffect, useState } from "react";

export type ClientViewer = {
  signedIn: boolean;
  name: string | null;
  isAdmin: boolean;
  adminShortcuts?: boolean;
  /** True until the first /api/me answer arrives. */
  pending?: boolean;
};
const SIGNED_OUT: ClientViewer = {
  signedIn: false,
  name: null,
  isAdmin: false,
};

// The Supabase session cookie changes on sign-in, refresh and sign-out; the viewer is
// re-read whenever it does (an installed app keeps one page alive across sign-ins).
const sessionKey = () =>
  document.cookie
    .split("; ")
    .filter((c) => c.startsWith("sb-"))
    .map((c) => c.split("=")[0])
    .join(",");
let cached: { key: string; p: Promise<ClientViewer> } | null = null;
const load = () => {
  const key = sessionKey();
  if (!cached || cached.key !== key)
    cached = {
      key,
      p: fetch("/api/me", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<ClientViewer>) : SIGNED_OUT))
        .catch(() => SIGNED_OUT),
    };
  return cached.p;
};

/** Display only: what to show in menus. Access is enforced on the server and in the database. */
export function useViewer(): ClientViewer {
  const [v, setV] = useState<ClientViewer>({ ...SIGNED_OUT, pending: true });
  useEffect(() => {
    let live = true;
    const refresh = () => load().then((x) => live && setV(x));
    refresh();
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    addEventListener("focus", refresh);
    // Fired after the viewer's own settings change (e.g. the admin shortcuts switch).
    const reset = () => {
      cached = null;
      refresh();
    };
    addEventListener("sswx-viewer", reset);
    const t = setInterval(refresh, 15000);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVis);
      removeEventListener("focus", refresh);
      removeEventListener("sswx-viewer", reset);
      clearInterval(t);
    };
  }, []);
  return v;
}
