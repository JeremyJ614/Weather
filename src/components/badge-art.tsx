/**
 * Custom badge art (Final List #1): an illustration for every icon a badge uses, drawn on a
 * 24 × 24 grid in the badge's rarity color, lit from the top left. Loaded on its own, after
 * the page, like the icon set; an icon without art falls back to the plain icon.
 */
import type { ReactNode } from "react";

export type Pal = {
  /** Gradients: `lit` (light to color, top to bottom), `deep` (color to dark). */
  lit: string;
  deep: string;
  /** Flat tones. */
  hi: string;
  main: string;
  dark: string;
  ink: string;
};

type Art = (p: Pal) => ReactNode;

const star = (cx: number, cy: number, r: number, k = 0.38) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const rr = i % 2 ? r * k : r;
    return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }).join(" ");

export const BADGE_ART: Record<string, Art> = {
  Eye: (p) => (
    <>
      <path
        d="M1.5 12C4.6 6.6 8.2 4.6 12 4.6s7.4 2 10.5 7.4c-3.1 5.4-6.7 7.4-10.5 7.4S4.6 17.4 1.5 12Z"
        fill={p.hi}
      />
      <path
        d="M1.5 12C4.6 6.6 8.2 4.6 12 4.6s7.4 2 10.5 7.4"
        fill="none"
        stroke={p.dark}
        strokeWidth="1.2"
      />
      <circle cx="12" cy="12" r="5.2" fill={p.deep} />
      <circle cx="12" cy="12" r="3.6" fill={p.lit} opacity="0.55" />
      <circle cx="12" cy="12" r="2.2" fill={p.ink} />
      <circle cx="13.8" cy="10.2" r="1.2" fill="#fff" />
    </>
  ),
  Compass: (p) => (
    <>
      <circle cx="12" cy="12" r="10.5" fill={p.lit} />
      <circle cx="12" cy="12" r="8.6" fill={p.ink} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={i}
          x="11.6"
          y="3.8"
          width="0.8"
          height={i % 3 ? 1.2 : 2}
          fill={p.hi}
          transform={`rotate(${i * 30} 12 12)`}
        />
      ))}
      <path d="M12 4.8 14.6 12H9.4Z" fill="#ff6b5e" />
      <path d="M12 19.2 9.4 12h5.2Z" fill={p.hi} />
      <path d="M12 4.8 12 12H9.4Z" fill="#000" opacity="0.2" />
      <circle
        cx="12"
        cy="12"
        r="1.6"
        fill={p.lit}
        stroke={p.ink}
        strokeWidth="0.6"
      />
    </>
  ),
  BellRing: (p) => (
    <>
      <path
        d="M12 3.2c3.6 0 6 2.8 6 6.6v3.6l2 3.1H4l2-3.1V9.8c0-3.8 2.4-6.6 6-6.6Z"
        fill={p.lit}
      />
      <path
        d="M8.2 7.4c.7-1.7 2-2.6 3.8-2.6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.8"
      />
      <rect x="3.6" y="15.8" width="16.8" height="2.2" rx="1.1" fill={p.deep} />
      <circle cx="12" cy="20.2" r="1.9" fill={p.dark} />
      <circle cx="12" cy="2.6" r="1.1" fill={p.dark} />
      <path
        d="M2.2 6.8c.6-1.6 1.5-2.8 2.8-3.8M21.8 6.8c-.6-1.6-1.5-2.8-2.8-3.8"
        fill="none"
        stroke={p.hi}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  ),
  Flame: (p) => (
    <>
      <path
        d="M12 1.6c1 3.6 6.8 6.4 6.8 12.2A6.8 6.8 0 0 1 5.2 13.8c0-3 1.6-4.6 2.8-6.2.3 1.8 1.2 2.8 2.2 3.2C10 7.4 10.8 4.2 12 1.6Z"
        fill={p.deep}
      />
      <path
        d="M12.2 7.6c.6 2.4 4.4 4.2 4.4 8a4.6 4.6 0 0 1-9.2 0c0-1.9 1-3 1.8-4 .2 1.1.8 1.8 1.4 2.1-.1-2.4.6-4.3 1.6-6.1Z"
        fill={p.lit}
      />
      <path
        d="M12 13.4c.4 1.2 2.2 2.1 2.2 4a2.2 2.2 0 0 1-4.4 0c0-1 .5-1.6 1-2.1.1.6.4.9.7 1 0-1.1.2-2 .5-2.9Z"
        fill="#fff"
        opacity="0.9"
      />
    </>
  ),
  Orbit: (p) => (
    <>
      <path
        d="M10.6 7.4C9 4.6 6.2 3 2.8 3.2c2.4 1 4 2.6 4.8 4.8"
        fill="none"
        stroke={p.lit}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M13.4 16.6c1.6 2.8 4.4 4.4 7.8 4.2-2.4-1-4-2.6-4.8-4.8"
        fill="none"
        stroke={p.deep}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="5.2"
        fill="none"
        stroke={p.lit}
        strokeWidth="3.2"
      />
      <circle cx="12" cy="12" r="2.6" fill={p.ink} />
      <path
        d="M8.6 9.6a4.4 4.4 0 0 1 2.4-2.2"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="12" cy="12" r="1" fill={p.hi} opacity="0.6" />
    </>
  ),
  BookOpen: (p) => (
    <>
      <path
        d="M12 6.2C9.4 4.4 6 4 2.2 4.6v14c3.8-.6 7.2-.2 9.8 1.6Z"
        fill={p.hi}
      />
      <path
        d="M12 6.2c2.6-1.8 6-2.2 9.8-1.6v14c-3.8-.6-7.2-.2-9.8 1.6Z"
        fill={p.lit}
      />
      <path d="M12 6.2v14" stroke={p.dark} strokeWidth="1.2" />
      <path
        d="M2.2 18.6c3.8-.6 7.2-.2 9.8 1.6 2.6-1.8 6-2.2 9.8-1.6v1.6c-3.8-.6-7.2-.2-9.8 1.6-2.6-1.8-6-2.2-9.8-1.6Z"
        fill={p.deep}
      />
      <path
        d="M17.4 7.2 14.6 12h2.2l-1.6 4.4 3.6-5.4h-2.3l1.6-3.8Z"
        fill={p.ink}
      />
      <path
        d="M4.4 8.2c1.8-.2 3.6 0 5.4.8M4.4 11c1.8-.2 3.6 0 5.4.8M4.4 13.8c1.8-.2 3.6 0 5.4.8"
        stroke={p.dark}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
    </>
  ),
  Car: (p) => (
    <>
      <path
        d="M1.8 12.6 4 8.4c.5-1 1.4-1.6 2.5-1.6h8.2c1 0 1.9.5 2.4 1.4l2.2 3.6 1.6.6c.7.3 1.1.9 1.1 1.6v2.4c0 .7-.5 1.2-1.2 1.2H2.6c-.7 0-1.2-.5-1.2-1.2v-2.4c0-.4.2-.8.4-1Z"
        fill={p.lit}
      />
      <path
        d="M6 8.4h4.6v3.8H4.2Z M12 8.4h3c.5 0 .9.2 1.1.6l1.8 3.2H12Z"
        fill={p.ink}
      />
      <path
        d="M6.6 9.2 5.4 11.4"
        stroke="#fff"
        strokeWidth="0.8"
        opacity="0.7"
        strokeLinecap="round"
      />
      <rect x="7.4" y="5.2" width="5.2" height="1.4" rx="0.7" fill={p.hi} />
      <path
        d="M1.4 15.2h21.2v.8c0 .7-.5 1.2-1.2 1.2H2.6c-.7 0-1.2-.5-1.2-1.2Z"
        fill={p.deep}
      />
      <circle cx="6.4" cy="17.2" r="2.6" fill={p.ink} />
      <circle cx="6.4" cy="17.2" r="1.1" fill={p.hi} />
      <circle cx="17.6" cy="17.2" r="2.6" fill={p.ink} />
      <circle cx="17.6" cy="17.2" r="1.1" fill={p.hi} />
      <path
        d="M19.6 4.2 17.8 7l1.4.2-1 2.2"
        fill="none"
        stroke={p.hi}
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </>
  ),
  Tornado: (p) => (
    <>
      <path
        d="M3 4.4c0-1.4 4-2.4 9-2.4s9 1 9 2.4c0 1.3-4 2.4-9 2.4S3 5.7 3 4.4Z"
        fill={p.deep}
      />
      <path
        d="M3 4.4c0 1.3 4 2.4 9 2.4s9-1.1 9-2.4l-1.8 3.4c-.6 1.2-3.6 2-7.2 2S5.4 9 4.8 7.8Z"
        fill={p.lit}
      />
      <path
        d="M5.2 8.6c1.2.9 3.8 1.4 6.8 1.4s5.4-.5 6.4-1.4l-1.9 3.4c-.6 1-2.4 1.6-4.7 1.6s-4.3-.6-4.9-1.6Z"
        fill={p.main}
      />
      <path
        d="M7.4 12.8c1 .7 2.6 1 4.4 1s3.2-.3 4-1l-1.6 3c-.5.8-1.4 1.2-2.6 1.2s-2.2-.4-2.6-1.2Z"
        fill={p.lit}
      />
      <path
        d="M9.8 17c.6.4 1.2.6 2 .6s1.2-.2 1.6-.6l-1 2.4c-.2.6-.6.9-1 .9s-.6-.3-.8-.8Z"
        fill={p.main}
      />
      <circle cx="16.8" cy="18.6" r="0.9" fill={p.hi} />
      <circle cx="7.2" cy="19.8" r="0.7" fill={p.hi} />
      <rect
        x="18.2"
        y="20.6"
        width="1.6"
        height="1"
        rx="0.3"
        fill={p.hi}
        transform="rotate(25 19 21)"
      />
      <path
        d="M6.4 3.6c1.8-.6 4-.8 6-.7"
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.7"
      />
    </>
  ),
  BadgeCheck: (p) => (
    <>
      <polygon
        points={Array.from({ length: 24 }, (_, i) => {
          const a = (Math.PI / 12) * i;
          const r = i % 2 ? 9.6 : 11.2;
          return `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`;
        }).join(" ")}
        fill={p.deep}
      />
      <circle cx="12" cy="12" r="8" fill={p.lit} />
      <path
        d="M7.2 9.2a5.6 5.6 0 0 1 4-3"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="m8.2 12.2 2.6 2.6 5-5.4"
        fill="none"
        stroke={p.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  Infinity: (p) => (
    <>
      <path
        d="M12 12c-2.2-3-4-4.6-6.2-4.6a4.6 4.6 0 0 0 0 9.2c2.2 0 4-1.6 6.2-4.6Z"
        fill="none"
        stroke={p.deep}
        strokeWidth="3.4"
      />
      <path
        d="M12 12c2.2 3 4 4.6 6.2 4.6a4.6 4.6 0 0 0 0-9.2c-2.2 0-4 1.6-6.2 4.6Z"
        fill="none"
        stroke={p.lit}
        strokeWidth="3.4"
      />
      <path
        d="M12 12c-2.2 3-4 4.6-6.2 4.6"
        fill="none"
        stroke={p.lit}
        strokeWidth="3.4"
      />
      <path
        d="M3.2 10.4c.6-1.2 1.6-1.9 2.8-2"
        fill="none"
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M18.4 8.2c1 .1 1.8.6 2.3 1.4"
        fill="none"
        stroke="#fff"
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.8"
      />
    </>
  ),
  Crown: (p) => (
    <>
      <path
        d="M3 8.4 7.6 12 12 4.6 16.4 12 21 8.4l-1.6 9.4H4.6Z"
        fill={p.lit}
      />
      <path
        d="M12 4.6 16.4 12 21 8.4l-1.6 9.4H12Z"
        fill="#000"
        opacity="0.14"
      />
      <rect x="4.2" y="17.2" width="15.6" height="2.8" rx="0.8" fill={p.deep} />
      <circle cx="12" cy="13.6" r="1.7" fill="#ff5c7a" />
      <circle cx="7.6" cy="15" r="1.1" fill="#5ad1ff" />
      <circle cx="16.4" cy="15" r="1.1" fill="#5ad1ff" />
      <circle cx="3" cy="8.4" r="1.2" fill={p.hi} />
      <circle cx="12" cy="4.4" r="1.3" fill={p.hi} />
      <circle cx="21" cy="8.4" r="1.2" fill={p.hi} />
      <path
        d="M11.4 13c.2-.3.5-.4.8-.4"
        stroke="#fff"
        strokeWidth="0.6"
        strokeLinecap="round"
      />
    </>
  ),
  Sparkles: (p) => (
    <>
      <path
        d="M10 2.4c.7 4.2 2.6 6.1 6.8 6.8-4.2.7-6.1 2.6-6.8 6.8-.7-4.2-2.6-6.1-6.8-6.8 4.2-.7 6.1-2.6 6.8-6.8Z"
        fill={p.lit}
      />
      <path d="M10 2.4c.7 4.2 2.6 6.1 6.8 6.8H10Z" fill="#fff" opacity="0.35" />
      <path
        d="M18 12.6c.4 2.3 1.4 3.3 3.7 3.7-2.3.4-3.3 1.4-3.7 3.7-.4-2.3-1.4-3.3-3.7-3.7 2.3-.4 3.3-1.4 3.7-3.7Z"
        fill={p.main}
      />
      <path
        d="M6.2 15.6c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z"
        fill={p.hi}
      />
    </>
  ),
  CalendarCheck: (p) => (
    <>
      <rect x="3" y="4.6" width="18" height="16.4" rx="2.4" fill={p.hi} />
      <path
        d="M3 7a2.4 2.4 0 0 1 2.4-2.4h13.2A2.4 2.4 0 0 1 21 7v2.6H3Z"
        fill={p.deep}
      />
      <rect x="7" y="2.6" width="1.8" height="4.4" rx="0.9" fill={p.ink} />
      <rect x="15.2" y="2.6" width="1.8" height="4.4" rx="0.9" fill={p.ink} />
      <path
        d="m8.2 15 2.6 2.6 5-5.2"
        fill="none"
        stroke={p.main}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  Crosshair: (p) => (
    <>
      <circle
        cx="12"
        cy="12"
        r="9.2"
        fill="none"
        stroke={p.lit}
        strokeWidth="2.2"
      />
      <circle
        cx="12"
        cy="12"
        r="5"
        fill="none"
        stroke={p.main}
        strokeWidth="1.4"
      />
      <path
        d="M12 1.2v5.4M12 17.4v5.4M1.2 12h5.4M17.4 12h5.4"
        stroke={p.hi}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2" fill="#ff6b5e" />
      <circle cx="11.4" cy="11.4" r="0.6" fill="#fff" />
    </>
  ),
  Lightbulb: (p) => (
    <>
      <circle cx="12" cy="9.4" r="7.6" fill={p.main} opacity="0.25" />
      <path
        d="M12 2.6a6.6 6.6 0 0 0-3.8 12c.7.5 1.2 1.3 1.2 2.2v.6h5.2v-.6c0-.9.5-1.7 1.2-2.2A6.6 6.6 0 0 0 12 2.6Z"
        fill={p.lit}
      />
      <path
        d="M9.6 5.4c-1 .7-1.6 1.8-1.7 3"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M10.4 14.4 12 10.4l1.6 4"
        fill="none"
        stroke={p.dark}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
      <rect x="9.2" y="17.4" width="5.6" height="1.6" rx="0.6" fill={p.deep} />
      <rect x="9.6" y="19.2" width="4.8" height="1.5" rx="0.6" fill={p.ink} />
      <path d="M10.6 21h2.8l-.6 1.2h-1.6Z" fill={p.deep} />
    </>
  ),
  Route: (p) => (
    <>
      <path
        d="M6 18.4c3.6 0 2-6.8 6-6.8s2.4-6 6-6"
        fill="none"
        stroke={p.hi}
        strokeWidth="2"
        strokeDasharray="2.2 1.8"
        strokeLinecap="round"
      />
      <path
        d="M6 13.4a3 3 0 0 0-3 3c0 2.2 3 5 3 5s3-2.8 3-5a3 3 0 0 0-3-3Z"
        fill={p.lit}
      />
      <circle cx="6" cy="16.4" r="1.1" fill={p.ink} />
      <path
        d="M18 1.8a3 3 0 0 0-3 3c0 2.2 3 5 3 5s3-2.8 3-5a3 3 0 0 0-3-3Z"
        fill={p.deep}
      />
      <circle cx="18" cy="4.8" r="1.1" fill="#fff" />
    </>
  ),
  Smartphone: (p) => (
    <>
      <rect x="5.4" y="1.6" width="13.2" height="20.8" rx="2.6" fill={p.deep} />
      <rect x="6.8" y="4" width="10.4" height="15.4" rx="1" fill={p.ink} />
      <circle
        cx="12"
        cy="11.7"
        r="4.6"
        fill="none"
        stroke={p.main}
        strokeWidth="0.6"
        opacity="0.6"
      />
      <circle
        cx="12"
        cy="11.7"
        r="2.4"
        fill="none"
        stroke={p.main}
        strokeWidth="0.6"
        opacity="0.6"
      />
      <path
        d="M12 11.7 16.2 9.6A4.6 4.6 0 0 0 12 7.1Z"
        fill={p.lit}
        opacity="0.9"
      />
      <circle cx="14.4" cy="13.4" r="0.9" fill="#ff6b5e" />
      <circle cx="9.6" cy="9.8" r="0.7" fill="#5fd9a8" />
      <rect x="10.4" y="20.2" width="3.2" height="0.9" rx="0.45" fill={p.hi} />
    </>
  ),
  Sunrise: (p) => (
    <>
      <path d="M4.6 15.8a7.4 7.4 0 0 1 14.8 0Z" fill={p.lit} />
      <path
        d="M8.2 11.4a5 5 0 0 1 3.8-1.8"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.8"
      />
      {[-60, -30, 0, 30, 60].map((a) => (
        <rect
          key={a}
          x="11.3"
          y="2.6"
          width="1.4"
          height="3"
          rx="0.7"
          fill={p.hi}
          transform={`rotate(${a} 12 15.8)`}
        />
      ))}
      <rect x="1.6" y="15.8" width="20.8" height="1.8" rx="0.9" fill={p.deep} />
      <rect x="4.6" y="19.2" width="14.8" height="1.4" rx="0.7" fill={p.dark} />
    </>
  ),
  Vote: (p) => (
    <>
      <rect
        x="7"
        y="2.4"
        width="10"
        height="11"
        rx="1.2"
        fill="#fff"
        transform="rotate(-6 12 8)"
      />
      <path
        d="m9.6 8.4 1.8 1.8 3.4-3.8"
        fill="none"
        stroke={p.deep}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(-6 12 8)"
      />
      <path
        d="M3 12.4h18v7.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 20Z"
        fill={p.lit}
      />
      <rect x="3" y="11.4" width="18" height="2.4" rx="0.6" fill={p.deep} />
      <rect x="7.6" y="12.1" width="8.8" height="1" rx="0.5" fill={p.ink} />
      <path
        d="M5.2 15.6v3.6"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.6"
      />
    </>
  ),
  GraduationCap: (p) => (
    <>
      <path d="M12 3.4 1.6 8.6 12 13.8l10.4-5.2Z" fill={p.lit} />
      <path d="M12 3.4 22.4 8.6 12 13.8Z" fill="#000" opacity="0.12" />
      <path
        d="M5.6 10.6v4.6c0 1.8 2.8 3.4 6.4 3.4s6.4-1.6 6.4-3.4v-4.6L12 13.8Z"
        fill={p.deep}
      />
      <path d="M20.6 9.6v6.6" stroke={p.hi} strokeWidth="0.9" />
      <path d="M19.6 16.2h2l.6 3.4h-3.2Z" fill={p.hi} />
      <circle cx="12" cy="8.6" r="0.9" fill={p.ink} />
    </>
  ),
  Shield: (p) => (
    <>
      <path
        d="M12 1.8 20.4 5v6.4c0 5.4-3.6 9-8.4 10.8C7.2 20.4 3.6 16.8 3.6 11.4V5Z"
        fill={p.lit}
      />
      <path
        d="M12 1.8 20.4 5v6.4c0 5.4-3.6 9-8.4 10.8Z"
        fill="#000"
        opacity="0.16"
      />
      <path
        d="M12 4.6 18 7v4.6c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V7Z"
        fill={p.ink}
      />
      <polygon points={star(12, 11.6, 4.6)} fill={p.lit} />
    </>
  ),
  UserPlus: (p) => (
    <>
      <circle cx="9" cy="7.6" r="3.8" fill={p.lit} />
      <path d="M1.8 20.4c0-4 3.2-6.8 7.2-6.8s7.2 2.8 7.2 6.8Z" fill={p.deep} />
      <circle
        cx="9"
        cy="7.6"
        r="3.8"
        fill="none"
        stroke="#fff"
        strokeWidth="0.6"
        opacity="0.4"
      />
      <circle cx="18" cy="8.4" r="4.2" fill={p.hi} />
      <path
        d="M18 6.2v4.4M15.8 8.4h4.4"
        stroke={p.ink}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  Zap: (p) => (
    <>
      <path d="M13.6 1.4 4 13.2h6.4l-2 9.4L20 9.8h-6.6Z" fill={p.lit} />
      <path
        d="M13.6 1.4 11.4 9.8H20L8.4 22.6l2-9.4Z"
        fill="#000"
        opacity="0.14"
      />
      <path
        d="M12.6 3.6 6.8 11"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />
    </>
  ),
  Gem: (p) => (
    <>
      <path d="M6.4 3.4h11.2L22 9.2 12 21.4 2 9.2Z" fill={p.main} />
      <path d="M2 9.2h20L12 21.4Z" fill={p.deep} />
      <path d="M6.4 3.4 9 9.2 12 3.4l3 5.8 2.6-5.8" fill={p.hi} />
      <path d="M9 9.2 12 21.4 15 9.2Z" fill={p.lit} />
      <path d="M2 9.2 6.4 3.4 9 9.2Z" fill="#fff" opacity="0.5" />
      <path d="M12 3.4 9 9.2h6Z" fill="#fff" opacity="0.75" />
    </>
  ),
  Hourglass: (p) => (
    <>
      <rect x="4" y="1.6" width="16" height="2.4" rx="1" fill={p.deep} />
      <rect x="4" y="20" width="16" height="2.4" rx="1" fill={p.deep} />
      <path
        d="M6 4h12c0 4-2.6 6.2-4.6 8 2 1.8 4.6 4 4.6 8H6c0-4 2.6-6.2 4.6-8C8.6 10.2 6 8 6 4Z"
        fill={p.hi}
        opacity="0.5"
      />
      <path
        d="M8 6.4h8c-.5 1.8-2.2 3.2-4 4.4-1.8-1.2-3.5-2.6-4-4.4Z"
        fill={p.lit}
      />
      <path
        d="M7.6 19.2c.6-2.2 2.4-3.6 4.4-4.4 2 .8 3.8 2.2 4.4 4.4Z"
        fill={p.main}
      />
      <path
        d="M12 11v6"
        stroke={p.lit}
        strokeWidth="0.8"
        strokeDasharray="0.8 0.9"
      />
      <path
        d="M7.4 5.4c.3 1.6 1.2 2.8 2.2 3.8"
        stroke="#fff"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.7"
      />
    </>
  ),
  Megaphone: (p) => (
    <>
      <path d="M3 9.6h4l9-5.2v15.2l-9-5.2H3Z" fill={p.lit} />
      <path d="M16 4.4v15.2l-9-5.2V9.6Z" fill="#000" opacity="0.12" />
      <rect x="1.8" y="9" width="3.6" height="6" rx="1.2" fill={p.deep} />
      <path d="M7.4 14.4 9 20.2h2.4l-1-5.2Z" fill={p.deep} />
      <path
        d="M18.6 8.6c1 .9 1.6 2.1 1.6 3.4s-.6 2.5-1.6 3.4M20.4 6.2c1.6 1.5 2.4 3.6 2.4 5.8s-.8 4.3-2.4 5.8"
        fill="none"
        stroke={p.hi}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),
  Mountain: (p) => (
    <>
      <path d="M1.4 20.6 8.6 7.4l3.6 5.6 3-4.2 7.4 11.8Z" fill={p.deep} />
      <path d="M8.6 7.4 1.4 20.6h6.4l3.4-9.2Z" fill={p.lit} />
      <path d="M8.6 7.4 6.4 11.4l1.4-.4 1 1.2 1.2-1.6Z" fill="#fff" />
      <path d="m15.2 8.8-1.6 2.4 1.1-.2.8.9.9-1.2Z" fill="#fff" />
      <path
        d="M12 20.6c.6-2.6 3.4-2.6 4-4.6s2-2 2.6-2.6"
        fill="none"
        stroke={p.hi}
        strokeWidth="1.2"
        strokeDasharray="1.4 1"
        strokeLinecap="round"
      />
    </>
  ),
  HandHeart: (p) => (
    <>
      <path
        d="M12 12.6S6.8 9.4 6.8 5.9A2.9 2.9 0 0 1 12 4.3a2.9 2.9 0 0 1 5.2 1.6c0 3.5-5.2 6.7-5.2 6.7Z"
        fill="#ff5c7a"
      />
      <path
        d="M8.6 5.2c.6-.5 1.4-.6 2-.3"
        stroke="#fff"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M1.6 15.6 5 14.2c1.2-.5 2.4-.4 3.4.2l2.8 1.6h3.2a1.4 1.4 0 0 1 0 2.8h-3.6l4.4.2 4.6-3a1.6 1.6 0 0 1 2 2.4l-4.8 4.2c-.8.7-1.8 1-2.8 1H5.4l-3.8-1Z"
        fill={p.lit}
      />
      <path
        d="M1.6 15.6 5 14.2c1.2-.5 2.4-.4 3.4.2l2.8 1.6"
        fill="none"
        stroke={p.dark}
        strokeWidth="0.6"
        opacity="0.6"
      />
    </>
  ),
  MapPinned: (p) => (
    <>
      <path d="m2 7.8 6.2-2 7.6 2 6.2-2v14.4l-6.2 2-7.6-2-6.2 2Z" fill={p.hi} />
      <path d="M8.2 5.8v14.4l7.6 2V7.8Z" fill={p.main} opacity="0.55" />
      <path
        d="M4 15.4c2.4-.4 3.6 1.8 6.2 1.2s3.6-2.6 6.4-2"
        fill="none"
        stroke={p.deep}
        strokeWidth="1"
        strokeDasharray="1.4 1"
      />
      <path
        d="M15.6 1.4a3.6 3.6 0 0 0-3.6 3.6c0 2.7 3.6 6.4 3.6 6.4s3.6-3.7 3.6-6.4a3.6 3.6 0 0 0-3.6-3.6Z"
        fill="#ff5c5c"
      />
      <circle cx="15.6" cy="5" r="1.3" fill="#fff" />
    </>
  ),
  Target: (p) => (
    <>
      <circle cx="11" cy="13" r="9.4" fill={p.lit} />
      <circle cx="11" cy="13" r="6.8" fill={p.ink} />
      <circle cx="11" cy="13" r="4.4" fill={p.lit} />
      <circle cx="11" cy="13" r="2" fill="#ff5c5c" />
      <path
        d="M11 13 20.6 3.4"
        stroke={p.hi}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="m18.4 2.4 1.6 1.6.4-2.4ZM21.6 5.6 20 4l2.4-.4Z" fill={p.deep} />
    </>
  ),
  Award: (p) => (
    <>
      <path
        d="m7.4 13.6-3 8.2 3.6-1.2 2 3 2.4-7.4ZM16.6 13.6l3 8.2-3.6-1.2-2 3-2.4-7.4Z"
        fill={p.deep}
      />
      <circle cx="12" cy="9.2" r="7.4" fill={p.lit} />
      <circle cx="12" cy="9.2" r="5" fill={p.main} />
      <polygon points={star(12, 9.2, 3.6)} fill="#fff" opacity="0.9" />
    </>
  ),
};
