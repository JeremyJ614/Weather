"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useViewer } from "@/features/account/useViewer";
import { savePrefs } from "@/features/account/PrefsSync";
import { SHOWCASE_LAST, showcaseDue, tourDue } from "./due";
import type { GuideProps, Mode } from "./Guide";

const QUIET =
  /^\/(login|signup|welcome|auth|join|privacy|closed|offline)(\/|$)/;

/**
 * Decides when a guide plays and loads it only then: the guest showcase on a first visit
 * (and weekly after), the member tour once, and either on request (`?showcase`, `?tour`).
 * Waits for the launch intro, and for the account's preferences before a tour.
 */
export function GuideHost({
  menus,
}: {
  menus: { main: string; second: string };
}) {
  const { signedIn, pending, name } = useViewer();
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const ask: Mode | null = params.has("showcase")
    ? "showcase"
    : params.has("tour") && signedIn
      ? "tour"
      : null;
  const [mode, setMode] = useState<Mode | null>(null);
  const [Guide, setGuide] = useState<ComponentType<GuideProps> | null>(null);
  const played = useRef(new Set<string>());

  useEffect(() => {
    if (pending || mode) return;
    // A guest sent here by the signup gate sees the gate first.
    const auto: Mode | null =
      QUIET.test(path) || params.has("join")
        ? null
        : !signedIn && showcaseDue()
          ? "showcase"
          : signedIn && tourDue()
            ? "tour"
            : null;
    const want = ask ?? auto;
    // A requested guide plays once per request; an automatic one once per page load.
    const once = ask ? `${ask}?${params.toString()}` : `auto:${want}`;
    if (!want || played.current.has(once)) return;
    const html = document.documentElement;
    let live = true;
    const go = () => {
      if (html.dataset.intro || document.getElementById("launch-intro"))
        return false;
      if (want === "tour" && !ask && html.dataset.prefs !== "ready")
        return false;
      // The account may have just said this member has toured.
      if (want === "tour" && !ask && !tourDue()) return true;
      played.current.add(once);
      if (want === "showcase")
        try {
          localStorage.setItem(SHOWCASE_LAST, String(Date.now()));
        } catch {}
      html.dataset.guide = want;
      import("./Guide")
        .then((m) => {
          if (!live) return;
          setGuide(() => m.Guide);
          setMode(want);
        })
        .catch(() => delete html.dataset.guide);
      return true;
    };
    if (go()) return;
    const t = setInterval(() => go() && clearInterval(t), 250);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [pending, signedIn, path, ask, params, mode]);

  if (!mode || !Guide) return null;
  const done = () => {
    delete document.documentElement.dataset.guide;
    if (mode === "tour") savePrefs({ toured: true }, signedIn);
    setMode(null);
    if (ask) router.replace(path, { scroll: false });
  };
  return <Guide mode={mode} name={name} menus={menus} onDone={done} />;
}
