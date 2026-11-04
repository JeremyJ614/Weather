"use client";

import { useEffect, useState } from "react";
import { served, type Roster, type RosterStyle } from "@/lib/sswx/types";
import s from "./Sswx.module.css";

/** Members grouped under the department of their first position, in the owner's order. */
function groups(r: Roster) {
  const pos = new Map(r.positions.map((p) => [p.id, p]));
  return r.departments
    .map((d) => ({
      d,
      members: r.members.filter(
        (m) => pos.get(m.positions[0] ?? "")?.dept === d.id,
      ),
    }))
    .filter((g) => g.members.length);
}

function Served({ joined }: { joined: string }) {
  // Counted on the device, so the numbers match the viewer's own calendar day.
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
  const cells: [string, number | undefined][] = [
    ["Years", x?.years],
    ["Months", x?.months],
    ["Weeks", x?.weeks],
    ["Days", x?.days],
  ];
  return (
    <div className={s.served} aria-label="Time as a member">
      {cells.map(([l, n]) => (
        <div key={l}>
          <b>{n ?? "–"}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

export function RosterView({
  roster,
  style,
}: {
  roster: Roster;
  style?: RosterStyle;
}) {
  const pos = new Map(roster.positions.map((p) => [p.id, p]));
  const dept = new Map(roster.departments.map((d) => [d.id, d]));
  const look = style ?? roster.style;
  const chips = (ids: string[]) => (
    <div className={s.posList}>
      {ids.map((id) => {
        const p = pos.get(id);
        return p ? (
          <span key={id} style={{ ["--p" as string]: dept.get(p.dept)?.color }}>
            {p.name}
          </span>
        ) : null;
      })}
    </div>
  );
  const vars = (c: string) => ({
    ["--d" as string]: c,
    ["--n" as string]: roster.nameColor,
  });
  const g = groups(roster);
  if (!g.length) return <p className={s.muted}>The roster is empty for now.</p>;

  if (look === "orbit")
    return (
      <div className={s.orbitWrap}>
        {g.map(({ d, members }) => (
          <section
            key={d.id}
            className={`${s.glow} ${s.orbit}`}
            style={vars(d.color)}
          >
            <span className={s.orbitRing} aria-hidden />
            <h2 className={s.deptHead}>
              {d.name} <small>{members.length}</small>
            </h2>
            <div className={s.orbitGrid}>
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className={s.sat}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className={s.name}>{m.name}</span>
                  {chips(m.positions)}
                  <span className={s.where}>
                    {m.city}, {m.state}
                  </span>
                  <Served joined={m.joined} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );

  if (look === "ribbon")
    return (
      <div className={s.ribbon}>
        {g.flatMap(({ d, members }) => [
          <h2 key={d.id} className={s.deptHead} style={vars(d.color)}>
            {d.name}
          </h2>,
          ...members.map((m, i) => (
            <div
              key={m.id}
              className={s.node}
              style={{ ...vars(d.color), animationDelay: `${i * 80}ms` }}
            >
              <span className={s.tick}>Joined {m.joined}</span>
              <span className={s.name}>{m.name}</span>
              {chips(m.positions)}
              <span className={s.where}>
                {m.city}, {m.state}
              </span>
              <Served joined={m.joined} />
            </div>
          )),
        ])}
      </div>
    );

  return (
    <div className={s.roster}>
      {g.map(({ d, members }) => (
        <section key={d.id} className={s.dept} style={vars(d.color)}>
          <h2 className={s.deptHead}>
            {d.name} <small>{members.length}</small>
          </h2>
          <div className={s.track}>
            {members.map((m, i) => (
              <article
                key={m.id}
                className={`${s.glow} ${s.card}`}
                style={{ ...vars(d.color), animationDelay: `${i * 80}ms` }}
                onPointerMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - r.left) / r.width - 0.5;
                  const y = (e.clientY - r.top) / r.height - 0.5;
                  e.currentTarget.style.setProperty("--rx", `${x * 14}deg`);
                  e.currentTarget.style.setProperty("--ry", `${-y * 14}deg`);
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.setProperty("--rx", "0deg");
                  e.currentTarget.style.setProperty("--ry", "0deg");
                }}
              >
                <span className={s.name}>{m.name}</span>
                {chips(m.positions)}
                <span className={s.where}>
                  {m.city}, {m.state}
                </span>
                <Served joined={m.joined} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
