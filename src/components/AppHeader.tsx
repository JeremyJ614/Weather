/* eslint-disable @next/next/no-img-element -- small local logo */
import Link from "next/link";
import { HeaderLocation } from "@/features/location/LazyHeaderLocation";
import s from "./AppHeader.module.css";

/**
 * SSWX Weather Center masthead: a live radar emblem and a metal wordmark in the
 * center, the StormSync logo small in whichever top corner no menu uses, and the
 * reader's place: top right when free, else under the logo.
 */
export function AppHeader() {
  return (
    <header id="app-header" className={`${s.bar} fx-blur`}>
      <Link href="/" className={s.logo} aria-label="StormSync Media home">
        <img src="/brand/logo-primary.webp" alt="" width={88} height={26} />
      </Link>
      <Link href="/" className={s.mast} aria-label="SSWX Weather Center">
        <span className={s.radar} aria-hidden>
          <i className={s.sweep} />
          <i className={s.blip} />
        </span>
        <span className={s.words}>
          <svg className={s.sswx} viewBox="0 0 84 20" aria-hidden>
            <defs>
              <linearGradient id="sswx-metal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0.1" stopColor="#fff" />
                <stop offset="0.6" stopColor="var(--metal)" />
                <stop offset="1" stopColor="var(--accent)" />
              </linearGradient>
              <clipPath id="sswx-clip">
                <text x="0" y="16">
                  SSWX
                </text>
              </clipPath>
            </defs>
            <text x="0" y="16" fill="url(#sswx-metal)">
              SSWX
            </text>
            <g clipPath="url(#sswx-clip)">
              <rect className={s.shine} x="-30" y="-4" width="16" height="28" />
            </g>
          </svg>
          <span className={s.center}>Weather Center</span>
        </span>
      </Link>
      <HeaderLocation />
      <span className={s.rule} aria-hidden />
    </header>
  );
}
