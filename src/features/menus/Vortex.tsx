"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Tornado } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href, type NavGroup } from "@/lib/nav/registry";
import { placeStyle } from "./place";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";
import s from "./Vortex.module.css";

/** StormSync Vortex: a particle tornado spins up and flings the sections out along a spiral. */
export function Vortex({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const [sel, setSel] = useState<NavGroup | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const energy = useRef({ target: 0, now: 0 });

  // Particle funnel, drawn only while open (and never on low-tier phones).
  useEffect(() => {
    energy.current.target = open ? 1 : 0;
    const cv = canvas.current;
    if (!open || !cv || document.documentElement.dataset.tier === "low") return;
    const css = getComputedStyle(document.documentElement);
    const A = css.getPropertyValue("--accent").trim(),
      B = css.getPropertyValue("--accent2").trim();
    const c = cv.getContext("2d")!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = (cv.width = innerWidth * dpr),
      H = (cv.height = innerHeight * dpr);
    const bx = W / 2,
      by = H - 60 * dpr;
    const parts = Array.from({ length: 240 }, () => ({
      y: Math.random(),
      a: Math.random() * 6.28,
      s: (0.6 + Math.random() * 1.4) * dpr,
      v: 0.002 + Math.random() * 0.004,
      col: Math.random() < 0.5 ? A : B,
    }));
    let raf = 0;
    const frame = () => {
      const e = energy.current;
      e.now += (e.target - e.now) * 0.06;
      c.clearRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter";
      for (const p of parts) {
        p.y += p.v * (0.5 + e.now);
        p.a += (0.05 + 0.12 * (1 - p.y)) * (0.4 + e.now);
        if (p.y > 1) p.y = 0;
        const h = p.y * H * 0.78,
          r =
            (14 * dpr + Math.pow(p.y, 1.6) * W * 0.48) * (0.25 + 0.75 * e.now);
        c.globalAlpha = (1 - p.y) * 0.55 * e.now;
        c.fillStyle = p.col;
        c.beginPath();
        c.arc(
          bx + Math.cos(p.a) * r,
          by - h + Math.sin(p.a) * r * 0.18,
          p.s * (1 + p.y),
          0,
          6.283,
        );
        c.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // Fling items out of the funnel whenever the list changes.
  useEffect(() => {
    if (
      !open ||
      !list.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const nodes = [...list.current.querySelectorAll<HTMLElement>("[data-vb]")];
    nodes.forEach((n, i) => {
      const k = i % 2 ? 1 : -1;
      n.animate(
        [
          {
            transform: `translate(${k * 60}px, ${innerHeight - n.getBoundingClientRect().top}px) rotate(${k * -140}deg) scale(.2)`,
            opacity: 0,
          },
          {
            transform: `translate(${k * -24}px, 0) rotate(${k * 12}deg) scale(1.04)`,
            opacity: 1,
            offset: 0.7,
          },
          { transform: "none", opacity: 1 },
        ],
        {
          duration: 760,
          delay: i * 55,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "backwards",
        },
      );
    });
  }, [open, sel]);

  const close = () => {
    setSel(null);
    setOpen(false);
  };
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.veil} onClick={close} />
      <canvas ref={canvas} className={s.cv} aria-hidden />
      <nav
        className={s.list}
        ref={list}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        {open &&
          !sel &&
          groups.map((g) =>
            g.pages.length === 1 ? (
              <Link key={g.id} data-vb href={href(g.pages[0])} className={s.vb}>
                <NavIcon name={g.icon} />
                <span>{g.label}</span>
              </Link>
            ) : (
              <button
                key={g.id}
                data-vb
                className={s.vb}
                onClick={() => setSel(g)}
              >
                <NavIcon name={g.icon} />
                <span>{g.label}</span>
                <em>{g.pages.length}</em>
              </button>
            ),
          )}
        {open && sel && (
          <>
            <p className={s.h}>
              <button
                aria-label="Back to sections"
                onClick={() => setSel(null)}
              >
                <ArrowLeft className="size-5" aria-hidden />
              </button>
              {sel.label}
            </p>
            {sel.pages.map((pg) => (
              <Link
                key={pg.slug}
                data-vb
                href={href(pg)}
                className={s.vb}
                aria-current={path === href(pg) ? "page" : undefined}
              >
                <NavIcon name={pg.icon} />
                <span>{pg.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>
      <button
        className={s.core}
        style={placeStyle(placement.id, 70)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Tornado className="size-8" aria-hidden />
      </button>
    </div>
  );
}
