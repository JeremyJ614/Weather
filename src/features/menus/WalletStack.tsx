"use client";

import Link from "@/components/IntentLink";
import { ChevronDown } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href } from "@/lib/nav/registry";
import { Burger } from "./Burger";
import { Items, single } from "./Items";
import { placeStyle } from "./place";
import s from "./WalletStack.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const PEEK = 64;
const TUCK = 16;

/**
 * Wallet Stack: the sections are cards in a wallet, each peeking out above the next. Tap
 * one and it lifts to the top and opens to its pages while the others tuck into a stack
 * underneath; tap that stack (or the card again) to put it back.
 */
export function WalletStack({ groups, placement, role }: MenuProps) {
  const { open, setOpen, path, sub, setSub } = useMenuNav(role);
  const at = groups.findIndex((g) => g.id === sub);
  const sel = at >= 0 ? groups[at] : null;
  // The open card's height: its header plus two pages a row.
  const tall = sel ? 96 + Math.ceil(sel.pages.length / 2) * 54 : 0;
  const y = (i: number) => {
    if (!sel) return i * PEEK;
    if (i === at) return 0;
    const k = i < at ? i : i - 1;
    return tall + 18 + k * TUCK;
  };
  const height = sel
    ? tall + 18 + (groups.length - 1) * TUCK + 90
    : (groups.length - 1) * PEEK + 150;
  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.ov} onClick={() => setOpen(false)} />
      <nav
        className={s.wallet}
        aria-label={role === "main" ? "Main menu" : "Second menu"}
        aria-hidden={!open}
      >
        <div className={s.rail} style={{ height }}>
          {groups.map((g, i) => {
            const one = single(g);
            const isSel = i === at;
            const tucked = !!sel && !isSel;
            const last =
              tucked &&
              i === (at === groups.length - 1 ? at - 1 : groups.length - 1);
            const head = (
              <>
                <i className={s.chip}>
                  <NavIcon name={one?.icon ?? g.icon} className="size-5" />
                </i>
                <span className={s.name}>
                  <b>{one?.label ?? g.label}</b>
                  <small>
                    {one
                      ? "Open"
                      : `${g.pages.length} pages · •••• ${String(i + 1).padStart(2, "0")}`}
                  </small>
                </span>
                {!one && <ChevronDown className={s.chev} aria-hidden />}
                <span className={s.holo} aria-hidden />
                {last && (
                  <span className={s.more}>
                    {groups.length - 1} more sections · tap to put back
                  </span>
                )}
              </>
            );
            return (
              <section
                key={g.id}
                className={s.card}
                data-sel={isSel || undefined}
                data-tucked={tucked || undefined}
                data-last={last || undefined}
                style={{
                  transform: `translate3d(0, ${y(i)}px, 0) scale(${tucked ? 0.94 : 1})`,
                  zIndex: isSel ? 50 : tucked ? 20 + i : i,
                  ["--i" as string]: i,
                  ["--h" as string]: `${(i * 37) % 360}deg`,
                }}
              >
                {one && !tucked ? (
                  <Link
                    href={href(one)}
                    className={s.head}
                    tabIndex={open ? 0 : -1}
                    aria-current={path === href(one) ? "page" : undefined}
                  >
                    {head}
                  </Link>
                ) : (
                  <button
                    className={s.head}
                    tabIndex={open ? 0 : -1}
                    aria-expanded={isSel}
                    onClick={() => setSub(isSel || tucked ? null : g.id)}
                  >
                    {head}
                  </button>
                )}
                {isSel && (
                  <div className={s.pages}>
                    <Items
                      group={g}
                      path={path}
                      className={s.pg}
                      tabbable={open}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </nav>
      <Burger
        open={open}
        onClick={() => setOpen(!open)}
        style={placeStyle(placement.id)}
      />
    </div>
  );
}
