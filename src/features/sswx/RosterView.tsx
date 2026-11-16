"use client";

import { useEffect, useState } from "react";
import {
  ROSTER_STYLES,
  served,
  type Roster,
  type RosterMember,
  type RosterStyle,
} from "@/lib/sswx/types";
import s from "./Sswx.module.css";

function Tenure({ joined }: { joined: string }) {
  // Counted on the device, so it matches the viewer's own calendar day.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(new Date()), 0);
    const iv = setInterval(() => setNow(new Date()), 60_000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, []);
  const x = now ? served(joined, now) : null;
  return (
    <span className={s.tenure} aria-label="Time as a member">
      {(
        [
          ["y", x?.years],
          ["m", x?.months],
          ["w", x?.weeks],
          ["d", x?.days],
        ] as const
      ).map(([u, n]) => (
        <span key={u}>
          <b>{n ?? "–"}</b>
          {u}
        </span>
      ))}
    </span>
  );
}

/** The roster, always vertical: Circuit Tree, Pulse Timeline or Data Stream. */
export function RosterView({
  roster,
  style,
}: {
  roster: Roster;
  style?: RosterStyle;
}) {
  const pos = new Map(roster.positions.map((p) => [p.id, p]));
  const dept = new Map(roster.departments.map((d) => [d.id, d]));
  const look = ROSTER_STYLES.includes(style ?? roster.style)
    ? (style ?? roster.style)
    : "tree";
  const deptOf = (m: RosterMember) =>
    dept.get(pos.get(m.positions[0] ?? "")?.dept ?? "");
  const row = (m: RosterMember, i: number, color: string) => (
    <li
      key={m.id}
      className={s.leaf}
      style={{
        ["--d" as string]: color,
        ["--n" as string]: roster.nameColor,
        animationDelay: `${i * 70}ms`,
      }}
    >
      <span className={s.leafName}>{m.name}</span>
      <span className={s.leafPos}>
        {m.positions.map((id) => {
          const p = pos.get(id);
          return p ? (
            <span
              key={id}
              style={{ ["--p" as string]: dept.get(p.dept)?.color }}
            >
              {p.name}
            </span>
          ) : null;
        })}
      </span>
      <span className={s.leafMeta}>
        {m.city}
        {m.state ? `, ${m.state}` : ""} <Tenure joined={m.joined} />
      </span>
    </li>
  );
  if (!roster.members.length)
    return <p className={s.muted}>The roster is empty for now.</p>;
  if (look === "pulse") {
    const byDate = [...roster.members].sort((a, b) =>
      a.joined.localeCompare(b.joined),
    );
    return (
      <ol className={`${s.rost} ${s.pulseLine}`}>
        {byDate.map((m, i) => row(m, i, deptOf(m)?.color ?? "#888"))}
      </ol>
    );
  }
  return (
    <div className={`${s.rost} ${look === "circuit" ? s.circuit : s.tree}`}>
      {roster.departments.map((d) => {
        const list = roster.members.filter((m) => deptOf(m)?.id === d.id);
        return list.length ? (
          <section
            key={d.id}
            className={s.branch}
            style={{ ["--d" as string]: d.color }}
          >
            <h2 className={s.trunk}>
              <i aria-hidden />
              {d.name}
              <small>{list.length}</small>
            </h2>
            <ul>{list.map((m, i) => row(m, i, d.color))}</ul>
          </section>
        ) : null;
      })}
    </div>
  );
}
