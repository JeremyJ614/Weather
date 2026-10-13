"use client";

import { useEffect, useState } from "react";

export type ClientViewer = {
  signedIn: boolean;
  name: string | null;
  isAdmin: boolean;
};
const SIGNED_OUT: ClientViewer = {
  signedIn: false,
  name: null,
  isAdmin: false,
};

// One request per page load, shared by every caller.
let pending: Promise<ClientViewer> | null = null;
const load = () =>
  (pending ??= fetch("/api/me")
    .then((r) => (r.ok ? (r.json() as Promise<ClientViewer>) : SIGNED_OUT))
    .catch(() => SIGNED_OUT));

/** Display only: what to show in menus. Access is enforced on the server and in the database. */
export function useViewer(): ClientViewer {
  const [v, setV] = useState(SIGNED_OUT);
  useEffect(() => {
    let live = true;
    load().then((x) => live && setV(x));
    return () => {
      live = false;
    };
  }, []);
  return v;
}
