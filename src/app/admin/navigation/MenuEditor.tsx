"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { Button } from "@/components/ui/Button";
import type { LayoutGroup, MenuLayout } from "@/lib/nav/layout";
import { saveMenuLayout } from "../actions";
import s from "./MenuEditor.module.css";

type Menu = "main" | "second";
type PageInfo = {
  slug: string;
  label: string;
  icon: string;
  adminOnly: boolean;
};
type IconTarget =
  { kind: "group"; menu: Menu; i: number } | { kind: "page"; slug: string };
const MENU_LABEL: Record<Menu, string> = {
  main: "Main menu",
  second: "Second menu",
};
const other = (m: Menu): Menu => (m === "main" ? "second" : "main");
const newId = () => `s${Date.now().toString(36)}`;

function swap<T>(list: T[], i: number, j: number): T[] {
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/**
 * The Menu editor: both menus as sections of pages. Everything is a tap (no dragging
 * on a phone): arrows reorder, the move picker sends a page to any section of either
 * menu, the eye hides a page, and names and icons are edited in place.
 */
export function MenuEditor({
  initial,
  builtIn,
  pages,
  icons,
  custom,
}: {
  initial: MenuLayout;
  builtIn: MenuLayout;
  pages: PageInfo[];
  icons: string[];
  custom: boolean;
}) {
  const [layout, setLayout] = useState(initial);
  const [menu, setMenu] = useState<Menu>("main");
  const [picking, setPicking] = useState<IconTarget | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [isCustom, setIsCustom] = useState(custom);
  const [pending, start] = useTransition();
  const info = new Map(pages.map((p) => [p.slug, p]));
  const placed = new Set(
    [...layout.main, ...layout.second].flatMap((g) => g.pages),
  );
  const loose = pages.filter((p) => !placed.has(p.slug));

  const update = (next: MenuLayout, moved?: string) => {
    setLayout(next);
    setDirty(true);
    setStatus(null);
    setFlash(moved ?? null);
  };
  const setGroups = (m: Menu, groups: LayoutGroup[], moved?: string) =>
    update({ ...layout, [m]: groups }, moved);
  const editGroup = (m: Menu, i: number, patch: Partial<LayoutGroup>) =>
    setGroups(
      m,
      layout[m].map((g, k) => (k === i ? { ...g, ...patch } : g)),
    );
  const editPage = (
    slug: string,
    patch: { label?: string; icon?: string; hidden?: boolean },
  ) => {
    const cur = { ...layout.pages[slug], ...patch };
    if (!cur.label) delete cur.label;
    if (!cur.icon) delete cur.icon;
    if (!cur.hidden) delete cur.hidden;
    const pagesNext = { ...layout.pages, [slug]: cur };
    if (!Object.keys(cur).length) delete pagesNext[slug];
    update({ ...layout, pages: pagesNext });
  };
  /** Sends a page to section `to` ("main:2"), or out of every section (""). */
  const movePage = (slug: string, to: string) => {
    const strip = (gs: LayoutGroup[]) =>
      gs.map((g) => ({ ...g, pages: g.pages.filter((p) => p !== slug) }));
    const next = {
      ...layout,
      main: strip(layout.main),
      second: strip(layout.second),
    };
    if (to) {
      const [m, i] = to.split(":") as [Menu, string];
      next[m] = next[m].map((g, k) =>
        k === +i ? { ...g, pages: [...g.pages, slug] } : g,
      );
    }
    update(next, slug);
  };
  const pageStep = (m: Menu, gi: number, pi: number, d: number) => {
    const g = layout[m][gi];
    editGroup(m, gi, { pages: swap(g.pages, pi, pi + d) });
    setFlash(g.pages[pi]);
  };
  const groupStep = (m: Menu, i: number, d: number) =>
    setGroups(m, swap(layout[m], i, i + d), layout[m][i].id);
  const groupToMenu = (m: Menu, i: number) => {
    const g = layout[m][i];
    update(
      {
        ...layout,
        [m]: layout[m].filter((_, k) => k !== i),
        [other(m)]: [...layout[other(m)], g],
      },
      g.id,
    );
    setMenu(other(m));
  };
  const removeGroup = (m: Menu, i: number) => {
    const g = layout[m][i];
    if (
      g.pages.length &&
      !confirm(
        `Remove “${g.label}”? Its ${g.pages.length} page(s) go back to their original sections until you place them.`,
      )
    )
      return;
    setGroups(
      m,
      layout[m].filter((_, k) => k !== i),
    );
  };
  const addGroup = () => {
    const id = newId();
    setGroups(
      menu,
      [
        ...layout[menu],
        { id, label: "New section", icon: "Folder", pages: [] },
      ],
      id,
    );
  };

  const save = (value: MenuLayout | null) =>
    start(async () => {
      const r = await saveMenuLayout(value);
      if (r?.error) setStatus(r.error);
      else {
        setDirty(false);
        setIsCustom(value !== null);
        setStatus(
          value
            ? "Saved. The menus show this arrangement now."
            : "Back to the built-in menus.",
        );
        if (!value) setLayout(builtIn);
      }
    });

  const targets = (["main", "second"] as Menu[]).flatMap((m) =>
    layout[m].map((g, i) => ({
      v: `${m}:${i}`,
      label: `${MENU_LABEL[m]} · ${g.label}`,
    })),
  );

  /** One page's row (a plain render function, so inputs keep focus while typing). */
  const pageRow = ({
    slug,
    m,
    gi,
    pi,
    count,
  }: {
    slug: string;
    m?: Menu;
    gi?: number;
    pi?: number;
    count?: number;
  }) => {
    const p = info.get(slug);
    if (!p) return null;
    const e = layout.pages[slug] ?? {};
    return (
      <li
        key={slug}
        className={`${s.page} ${e.hidden ? s.hidden : ""} ${flash === slug ? s.flash : ""}`}
      >
        <button
          type="button"
          className={s.iconBtn}
          aria-label={`Icon for ${p.label}`}
          onClick={() => setPicking({ kind: "page", slug })}
        >
          <NavIcon name={e.icon ?? p.icon} className="size-4" />
        </button>
        <input
          className={s.name}
          value={e.label ?? ""}
          placeholder={p.label}
          maxLength={40}
          aria-label={`Name for ${p.label}`}
          onChange={(ev) => editPage(slug, { label: ev.target.value })}
        />
        {p.adminOnly && <span className={s.tag}>Admins</span>}
        <span className={s.tools}>
          <button
            type="button"
            aria-label={e.hidden ? `Show ${p.label}` : `Hide ${p.label}`}
            aria-pressed={Boolean(e.hidden)}
            onClick={() => editPage(slug, { hidden: !e.hidden })}
          >
            {e.hidden ? <EyeOff /> : <Eye />}
          </button>
          {m !== undefined && gi !== undefined && pi !== undefined && (
            <>
              <button
                type="button"
                aria-label="Move up"
                disabled={pi === 0}
                onClick={() => pageStep(m, gi, pi, -1)}
              >
                <ArrowUp />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={pi === (count ?? 1) - 1}
                onClick={() => pageStep(m, gi, pi, 1)}
              >
                <ArrowDown />
              </button>
            </>
          )}
          <label
            className={s.move}
            aria-label={`Move ${p.label} to another section`}
          >
            <ArrowRightLeft />
            <select
              value={m !== undefined ? `${m}:${gi}` : ""}
              onChange={(ev) => movePage(slug, ev.target.value)}
            >
              <option value="">Original section</option>
              {targets.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </span>
      </li>
    );
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className={s.tabs} role="tablist" aria-label="Menu">
        {(["main", "second"] as Menu[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={menu === m}
            onClick={() => setMenu(m)}
            className={s.tab}
          >
            {MENU_LABEL[m]}
            <small>{layout[m].length} sections</small>
          </button>
        ))}
      </div>

      <ol className={s.groups} key={menu}>
        {layout[menu].map((g, i) => (
          <li
            key={g.id}
            className={`${s.group} ${flash === g.id ? s.flash : ""}`}
            style={{ ["--i" as string]: i }}
          >
            <div className={s.head}>
              <button
                type="button"
                className={s.iconBtn}
                aria-label={`Icon for ${g.label}`}
                onClick={() => setPicking({ kind: "group", menu, i })}
              >
                <NavIcon name={g.icon} className="size-5" />
              </button>
              <input
                className={s.groupName}
                value={g.label}
                maxLength={40}
                aria-label="Section name"
                onChange={(ev) =>
                  editGroup(menu, i, { label: ev.target.value })
                }
              />
              <span className={s.tools}>
                <button
                  type="button"
                  aria-label="Section up"
                  disabled={i === 0}
                  onClick={() => groupStep(menu, i, -1)}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  aria-label="Section down"
                  disabled={i === layout[menu].length - 1}
                  onClick={() => groupStep(menu, i, 1)}
                >
                  <ArrowDown />
                </button>
                <button
                  type="button"
                  aria-label={`Move section to the ${MENU_LABEL[other(menu)]}`}
                  onClick={() => groupToMenu(menu, i)}
                >
                  <ArrowRightLeft />
                </button>
                <button
                  type="button"
                  aria-label="Remove section"
                  onClick={() => removeGroup(menu, i)}
                >
                  <Trash2 />
                </button>
              </span>
            </div>
            {g.pages.length ? (
              <ul className={s.pages}>
                {g.pages.map((slug, pi) =>
                  pageRow({ slug, m: menu, gi: i, pi, count: g.pages.length }),
                )}
              </ul>
            ) : (
              <p className={s.empty}>
                No pages yet. Use a page’s move button to bring it here.
              </p>
            )}
          </li>
        ))}
      </ol>
      <button type="button" className={s.add} onClick={addGroup}>
        <Plus aria-hidden /> Add a section to the{" "}
        {MENU_LABEL[menu].toLowerCase()}
      </button>

      {loose.length > 0 && (
        <section className={s.group}>
          <div className={s.head}>
            <b className="flex-1">Not placed</b>
          </div>
          <p className={s.empty}>
            These show in their original section until you move them.
          </p>
          <ul className={s.pages}>
            {loose.map((p) => pageRow({ slug: p.slug }))}
          </ul>
        </section>
      )}

      <div className={s.bar}>
        {status && (
          <p role="status" className={s.status}>
            {status}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            disabled={pending || !dirty}
            onClick={() => save(layout)}
          >
            {pending ? "Saving…" : dirty ? "Save menus" : "Saved"}
          </Button>
          {(isCustom || dirty) && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (
                  confirm(
                    "Go back to the built-in menus? Your arrangement is removed.",
                  )
                )
                  save(null);
              }}
            >
              <RotateCcw className="size-4" aria-hidden /> Built-in
            </Button>
          )}
        </div>
      </div>

      {picking && (
        <div className={s.picker} role="dialog" aria-label="Pick an icon">
          <div className={s.pickerHead}>
            <b>Pick an icon</b>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPicking(null)}
            >
              <X />
            </button>
          </div>
          <div className={s.iconGrid}>
            {icons.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                title={name}
                onClick={() => {
                  if (picking.kind === "group")
                    editGroup(picking.menu, picking.i, { icon: name });
                  else editPage(picking.slug, { icon: name });
                  setPicking(null);
                }}
              >
                <NavIcon name={name} className="size-5" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
