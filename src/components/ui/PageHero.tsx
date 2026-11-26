import type { ReactNode } from "react";
import { Morph } from "./Morph";
import { getSiteDefaults } from "@/lib/settings";
import { EVERY_PAGE } from "@/lib/nav/extras";

/**
 * The page's name as the owner saved it in admin → Menu editor (owner's list #41: renaming
 * "Atmospheric Ingredients" to "Atmospheric Parameters" only changed the menus). The header's
 * built-in title is matched to its page, then the saved name is used. Read on the server
 * from the same cached settings the menus use, so it costs the page no JavaScript.
 */
async function savedName(title: string) {
  const { layout } = await getSiteDefaults();
  const pages = layout?.pages;
  if (!pages) return title;
  const t = title.trim().toLowerCase();
  const page = EVERY_PAGE.find((p) => p.label.trim().toLowerCase() === t);
  return (page && pages[page.slug]?.label) || title;
}
import s from "./PageHero.module.css";

const RINGS = [96, 148, 200, 252, 304, 356];
const CX = 370;
const CY = -40;

/**
 * Every page opens with this: a measuring-plate apparatus (arcs, spokes, a tick
 * ladder and one warm trace) behind a sourced eyebrow, the title and a drawn rule.
 * Everything animates once, with transform and opacity only.
 */
export async function PageHero({
  icon,
  eyebrow,
  title,
  subtitle,
  action,
}: {
  icon?: ReactNode;
  /** Data sources or a kicker, shown as a letter-spaced line. */
  eyebrow?: string[];
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  const name = await savedName(title);
  return (
    <Morph name="page-hero">
      <header className={s.hero}>
        <svg
          className={s.plate}
          viewBox="0 0 520 190"
          preserveAspectRatio="xMaxYMin meet"
          aria-hidden
        >
          <defs>
            <linearGradient id="hero-fade" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.7" />
              <stop offset="1" stopColor="#fff" />
            </linearGradient>
            <mask id="hero-mask">
              <rect width="520" height="190" fill="url(#hero-fade)" />
            </mask>
          </defs>
          <g mask="url(#hero-mask)">
            {RINGS.map((r, i) => (
              <circle
                key={r}
                className={s.ring}
                style={{ ["--i" as string]: i }}
                cx={CX}
                cy={CY}
                r={r}
              />
            ))}
            {Array.from({ length: 13 }, (_, i) => {
              const th = ((96 + i * 15) * Math.PI) / 180;
              return (
                <line
                  key={i}
                  className={i % 3 ? s.spoke : s.spokeMajor}
                  style={{ ["--i" as string]: i }}
                  x1={CX + Math.cos(th) * 96}
                  y1={CY + Math.sin(th) * 96}
                  x2={CX + Math.cos(th) * 356}
                  y2={CY + Math.sin(th) * 356}
                />
              );
            })}
            <g className={s.trace}>
              <circle
                cx={CX}
                cy={CY}
                r={252}
                strokeDasharray={`${2 * Math.PI * 252 * 0.11} ${2 * Math.PI * 252}`}
                transform={`rotate(118 ${CX} ${CY})`}
              />
            </g>
          </g>
        </svg>
        <div className={s.ladder} aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <i
              key={i}
              className={i % 5 ? undefined : s.long}
              style={{ ["--i" as string]: i }}
            />
          ))}
        </div>

        <div className={s.body}>
          {eyebrow && eyebrow.length > 0 && (
            <p className={s.eyebrow}>
              <span className={s.dot} aria-hidden />
              {eyebrow.join(" · ")}
            </p>
          )}
          <div className={s.titleRow}>
            {icon && <span className={s.icon}>{icon}</span>}
            <h1 className={s.title} data-decode="">
              {name}
            </h1>
            {action && <div className={s.action}>{action}</div>}
          </div>
          {subtitle && <p className={s.sub}>{subtitle}</p>}
          <span className={s.rule} aria-hidden />
        </div>
      </header>
    </Morph>
  );
}
