"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ALL_PAGES } from "@/lib/nav/registry";
import { showcaseDue } from "@/features/guide/due";
import { useViewer } from "./useViewer";
import s from "./GuestGate.module.css";

const SEEN = "sswx-gate-seen";
const QUIET = /^\/(login|signup|welcome|auth|join|privacy|donate)(\/|$)/;

/**
 * A guest's first visit (after the intro) and any members' page they ask for open this:
 * Sign Up or Log In, or skip to the Homepage.
 */
export function GuestGate() {
  const { signedIn, pending } = useViewer();
  const path = usePathname();
  const want = useSearchParams().get("join");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (pending || signedIn || QUIET.test(path)) return;
    let first = false;
    try {
      first = !localStorage.getItem(SEEN);
    } catch {}
    if (!want && !first) return;
    // Wait for the launch intro, then the guest showcase, to finish before showing.
    const html = document.documentElement;
    const show = () => {
      if (
        html.dataset.intro ||
        document.getElementById("launch-intro") ||
        html.dataset.guide ||
        (!want && showcaseDue())
      )
        return false;
      queueMicrotask(() => setOpen(true));
      return true;
    };
    if (show()) return;
    const t = setInterval(() => show() && clearInterval(t), 250);
    return () => clearInterval(t);
  }, [pending, signedIn, path, want]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const close = (to?: string) => {
    try {
      localStorage.setItem(SEEN, "1");
    } catch {}
    setOpen(false);
    if (to) router.push(to);
    else if (want) router.replace("/");
  };
  const page =
    want && ALL_PAGES.find((p) => `/${p.slug}` === want.replace(/\/$/, ""));
  const next = want ? `?next=${encodeURIComponent(want)}` : "";

  return (
    <div
      className={s.back}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <div className={s.card}>
        <div className={s.rings} aria-hidden>
          <i />
          <i />
          <i />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logo */}
        <img
          src="/brand/logo-primary.webp"
          alt="StormSync"
          width={116}
          height={34}
          className={s.logo}
        />
        <h2 id="gate-title" className={s.title}>
          Your weather, synced to you
        </h2>
        <p className={s.sub}>
          Live radar, local briefs, storm timing and more, built around where
          you live.
        </p>
        {want && (
          <p className={s.note}>
            {page ? `${page.label} is` : "That page is"} for members. Sign up or
            log in to open it.
          </p>
        )}
        <Button
          variant="primary"
          live
          className="w-full"
          onClick={() => close(`/signup${next}`)}
        >
          Sign Up
        </Button>
        <Button
          className="w-full"
          still="ring"
          onClick={() => close(`/login${next}`)}
        >
          Log In
        </Button>
        <button type="button" className={s.skip} onClick={() => close()}>
          Skip to the Homepage
        </button>
      </div>
    </div>
  );
}
