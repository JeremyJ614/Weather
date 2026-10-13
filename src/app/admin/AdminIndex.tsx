"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import type { AdminGroup, AdminSection } from "@/lib/admin/sections";
import { setAdminShortcuts } from "./actions";
import s from "./AdminIndex.module.css";

/** The admin overview: sections in labeled groups as list rows, with a quick filter. */
export function AdminIndex({
  groups,
  sections,
  shortcuts,
}: {
  groups: { id: AdminGroup; label: string }[];
  sections: AdminSection[];
  /** The owner's "Admin in my second menu" switch; null for other admins. */
  shortcuts: boolean | null;
}) {
  const [q, setQ] = useState("");
  const [on, setOn] = useState(shortcuts);
  const [pending, start] = useTransition();
  const needle = q.trim().toLowerCase();
  const match = (x: AdminSection) =>
    !needle || `${x.label} ${x.desc}`.toLowerCase().includes(needle);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <label className={s.search}>
        <Search aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a section"
          aria-label="Find a section"
          type="search"
        />
      </label>

      {on !== null && (
        <label className={s.switchRow}>
          <span>
            <b>Admin in my second menu</b>
            <small>Every admin section one tap away, on any page.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={on}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              setOn(next);
              start(async () => {
                const r = await setAdminShortcuts(next);
                if (r?.error) setOn(!next);
                else dispatchEvent(new Event("sswx-viewer"));
              });
            }}
            className={s.switch}
          />
        </label>
      )}

      {groups.map((g) => {
        const list = sections.filter((x) => x.group === g.id && match(x));
        if (!list.length) return null;
        return (
          <section key={g.id} className="grid gap-2">
            <h2 className={s.groupTitle}>{g.label}</h2>
            <ul className={s.list}>
              {list.map((x, i) => {
                const body = (
                  <>
                    <span className={s.icon}>
                      <NavIcon name={x.icon} className="size-5" />
                    </span>
                    <span className={s.text}>
                      <b>{x.label}</b>
                      <small>
                        {x.href ? x.desc : `Arrives with phase ${x.phase}`}
                      </small>
                    </span>
                    {x.href && <ChevronRight className={s.chev} aria-hidden />}
                  </>
                );
                return (
                  <li key={x.id} style={{ ["--i" as string]: i }}>
                    {x.href ? (
                      <Link href={x.href} className={s.row}>
                        {body}
                      </Link>
                    ) : (
                      <div className={`${s.row} ${s.later}`} aria-disabled>
                        {body}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {needle && !sections.some(match) && (
        <p className="text-sm text-muted">No section matches “{q}”.</p>
      )}
    </div>
  );
}
