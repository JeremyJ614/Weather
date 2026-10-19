"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/IntentLink";
import { Clock, CornerDownLeft, Search, X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { href, type NavGroup } from "@/lib/nav/registry";
import f from "./Fab.module.css";
import { fabPlace } from "./place";
import s from "./CommandPalette.module.css";
import type { MenuProps } from "./types";
import { useMenuNav } from "./useMenuNav";

const RECENT = "sswx-recent";
type Hit = { to: string; label: string; icon: string; where: string };

const flat = (groups: NavGroup[]) =>
  groups.flatMap((g) =>
    g.pages.map((pg) => ({
      to: href(pg),
      label: pg.label,
      icon: pg.icon,
      where: g.label,
    })),
  );
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** Best matches first: names that start with the words, then names and sections that contain them. */
function rank(pages: Hit[], q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return pages
    .map((p) => {
      const name = p.label.toLowerCase();
      const all = `${name} ${p.where.toLowerCase()}`;
      if (!words.every((w) => all.includes(w))) return null;
      const score =
        (name.startsWith(words[0]) ? 4 : 0) +
        words.filter((w) => name.includes(w)).length * 2 +
        (name.split(/\s+/).some((t) => t.startsWith(words[0])) ? 1 : 0);
      return { p, score };
    })
    .filter((x): x is { p: Hit; score: number } => !!x)
    .sort((a, b) => b.score - a.score || a.p.label.localeCompare(b.p.label))
    .map((x) => x.p)
    .slice(0, 30);
}

function Mark({ text, q }: { text: string; q: string }) {
  const w = q.trim().split(/\s+/)[0]?.toLowerCase();
  const at = w ? text.toLowerCase().indexOf(w) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + w.length)}</mark>
      {text.slice(at + w.length)}
    </>
  );
}

/**
 * Command Palette: a search button that opens a sheet over the page. Type to find any page
 * in the app; empty, it shows your recent pages and quick shortcuts. Arrow keys and Enter
 * work, and Ctrl/⌘ + K opens it from anywhere.
 */
export function CommandPalette({ groups, placement, role, all }: MenuProps) {
  const { open, setOpen, path } = useMenuNav(role);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const pages = useMemo(() => {
    const seen = new Set<string>();
    return [...flat(groups), ...flat(all ?? [])].filter(
      (p) => !p.to.includes("?") && !seen.has(p.to) && seen.add(p.to),
    );
  }, [groups, all]);
  const quick = useMemo(() => flat(groups).slice(0, 8), [groups]);
  const hits = q.trim() ? rank(pages, q) : [];
  const recents = recent
    .map((to) => pages.find((p) => p.to === to))
    .filter((p): p is Hit => !!p && p.to !== path)
    .slice(0, 5);
  const list = q.trim() ? hits : recents;

  // Remember the pages this member opens, newest first.
  useEffect(() => {
    if (!pages.some((p) => p.to === path)) return;
    const next = [path, ...readRecent().filter((x) => x !== path)].slice(0, 8);
    try {
      localStorage.setItem(RECENT, JSON.stringify(next));
    } catch {}
  }, [path, pages]);
  const show = () => {
    setRecent(readRecent());
    setQ("");
    setAt(0);
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        showRef.current();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
  const go = (to: string) => {
    setOpen(false);
    router.push(to);
  };

  return (
    <div className={open ? s.on : undefined} data-menu-role={role}>
      <div className={s.scrim} onClick={() => setOpen(false)} />
      <div
        className={s.sheet}
        role="dialog"
        aria-label="Search pages"
        aria-hidden={!open}
      >
        <label className={s.field}>
          <Search aria-hidden />
          <input
            ref={input}
            value={q}
            tabIndex={open ? 0 : -1}
            onChange={(e) => {
              setQ(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAt((i) => Math.min(i + 1, list.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAt((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && list[at]) go(list[at].to);
            }}
            placeholder="Search every page"
            aria-label="Search every page"
            enterKeyHint="go"
            autoComplete="off"
          />
          <button
            type="button"
            className={s.x}
            tabIndex={open ? 0 : -1}
            aria-label="Close search"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden />
          </button>
        </label>
        {!q.trim() && quick.length > 0 && (
          <div className={s.chips}>
            {quick.map((p, i) => (
              <Link
                key={p.to}
                href={p.to}
                tabIndex={open ? 0 : -1}
                style={{ ["--i" as string]: i }}
                aria-current={path === p.to ? "page" : undefined}
              >
                <NavIcon name={p.icon} className="size-3.5" />
                {p.label}
              </Link>
            ))}
          </div>
        )}
        {list.length > 0 && (
          <p className={s.head}>
            {q.trim() ? (
              `${hits.length} ${hits.length === 1 ? "page" : "pages"}`
            ) : (
              <>
                <Clock aria-hidden /> Recent
              </>
            )}
          </p>
        )}
        <ul className={s.list} role="listbox" aria-label="Pages">
          {list.map((p, i) => (
            <li key={p.to} role="option" aria-selected={i === at}>
              <Link
                href={p.to}
                tabIndex={open ? 0 : -1}
                style={{ ["--i" as string]: i }}
                onMouseEnter={() => setAt(i)}
                aria-current={path === p.to ? "page" : undefined}
              >
                <i>
                  <NavIcon name={p.icon} className="size-4" />
                </i>
                <span>
                  <b>
                    <Mark text={p.label} q={q} />
                  </b>
                  <small>{p.where}</small>
                </span>
                {i === at && <CornerDownLeft className={s.enter} aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>
        {q.trim() && !hits.length && (
          <p className={s.none}>No page matches “{q.trim()}”.</p>
        )}
      </div>
      <button
        className={`${f.fab} ${fabPlace(placement.id, f)}`}
        aria-label={open ? "Close search" : "Search pages"}
        aria-expanded={open}
        aria-keyshortcuts="Control+K Meta+K"
        onClick={() => (open ? setOpen(false) : show())}
      >
        <Search aria-hidden />
      </button>
    </div>
  );
}
