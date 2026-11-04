"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  FIELD_TYPES,
  IDEAS,
  uid,
  type Answer,
  type AppCenter,
  type Application,
  type Field,
  type FieldType,
  type Roster,
  type RosterStyle,
  type Submission,
} from "@/lib/sswx/types";
import { RosterView } from "@/features/sswx/RosterView";
import { ApplyForm, StatusBadge } from "@/features/sswx/AppCenterView";
import type { Ctx } from "@/features/sswx/Fields";
import {
  removeSubmission,
  saveCenterAction,
  saveRosterAction,
  setSubmission,
} from "./actions";
import a from "./Admin.module.css";

type Tab = "roster" | "styles" | "apps" | "subs" | "lists" | "ideas";
const TABS: [Tab, string][] = [
  ["roster", "Active Roster"],
  ["styles", "Roster drafts"],
  ["apps", "Application builder"],
  ["subs", "Submissions"],
  ["lists", "Statuses & lists"],
  ["ideas", "Upgrade ideas"],
];
const STYLES: [RosterStyle, string, string][] = [
  [
    "holo",
    "Holo Cards",
    "3D-tilting glass cards with a light racing around each rim; swipe each department sideways.",
  ],
  [
    "orbit",
    "Orbit Deck",
    "Each department a glowing panel with a satellite ring circling it; members laid out in a grid.",
  ],
  [
    "ribbon",
    "Neon Ribbon",
    "One glowing timeline down the page, a lit node for every member.",
  ],
];

function move<T>(arr: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}
function Row({
  children,
  onUp,
  onDown,
  onDel,
}: {
  children: ReactNode;
  onUp: () => void;
  onDown: () => void;
  onDel: () => void;
}) {
  return (
    <div className={a.item}>
      {children}
      <div className={a.line}>
        <button
          type="button"
          className={a.icon}
          aria-label="Move up"
          onClick={onUp}
        >
          ↑
        </button>
        <button
          type="button"
          className={a.icon}
          aria-label="Move down"
          onClick={onDown}
        >
          ↓
        </button>
        <button
          type="button"
          className={a.icon}
          aria-label="Remove"
          onClick={onDel}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
const Color = ({ v, set }: { v: string; set: (c: string) => void }) => (
  <>
    <input
      type="color"
      value={/^#[0-9a-f]{6}$/i.test(v) ? v : "#888888"}
      onChange={(e) => set(e.target.value)}
      aria-label="Pick color"
    />
    <input
      value={v}
      onChange={(e) => set(e.target.value)}
      aria-label="Hex code"
      style={{ maxWidth: 110 }}
    />
  </>
);

export function SswxAdmin(p: {
  roster: Roster;
  center: AppCenter;
  subs: Submission[];
}) {
  const [tab, setTab] = useState<Tab>("roster");
  const [r, setR] = useState(p.roster);
  const [c, setC] = useState(p.center);
  const [msg, setMsg] = useState("");
  const [busy, go] = useTransition();
  const save = (what: "roster" | "center", next?: AppCenter) =>
    go(async () => {
      try {
        if (what === "roster") await saveRosterAction(r);
        else await saveCenterAction(next ?? c);
        setMsg("Saved.");
      } catch (e) {
        setMsg(`Not saved: ${(e as Error).message}`);
      }
    });
  const dept = new Map(r.departments.map((d) => [d.id, d.color]));
  const ctx: Ctx = {
    team: c.team,
    socials: c.socials,
    positions: r.positions.map((x) => ({
      ...x,
      color: dept.get(x.dept) ?? "#888",
    })),
  };
  const saveBtn = (what: "roster" | "center") => (
    <div className={a.line}>
      <button
        type="button"
        className={`${a.btn} ${a.primary}`}
        disabled={busy}
        onClick={() => save(what)}
      >
        {busy ? "Saving…" : "Save"}
      </button>
      {msg && <span className={a.saved}>{msg}</span>}
    </div>
  );

  return (
    <div className={a.wrap}>
      <h1 className="text-2xl font-bold">SSWX section</h1>
      <p className={a.muted}>
        Only SSWX Members, Recruits and admins can see the section. Make someone
        a Recruit or a Member from admin → Members → their page.
      </p>
      <div className={a.tabs} role="group" aria-label="SSWX admin">
        {TABS.map(([id, l]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setMsg("");
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "roster" && (
        <div className={a.split}>
          <div className={a.wrap}>
            <section className={a.panel}>
              <h2>Departments (in roster order)</h2>
              {r.departments.map((d, i) => (
                <Row
                  key={d.id}
                  onUp={() =>
                    setR({ ...r, departments: move(r.departments, i, -1) })
                  }
                  onDown={() =>
                    setR({ ...r, departments: move(r.departments, i, 1) })
                  }
                  onDel={() =>
                    setR({
                      ...r,
                      departments: r.departments.filter((x) => x.id !== d.id),
                    })
                  }
                >
                  <div className={a.line}>
                    <input
                      value={d.name}
                      aria-label="Department name"
                      onChange={(e) =>
                        setR({
                          ...r,
                          departments: r.departments.map((x) =>
                            x.id === d.id ? { ...x, name: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <Color
                      v={d.color}
                      set={(col) =>
                        setR({
                          ...r,
                          departments: r.departments.map((x) =>
                            x.id === d.id ? { ...x, color: col } : x,
                          ),
                        })
                      }
                    />
                  </div>
                </Row>
              ))}
              <button
                type="button"
                className={a.btn}
                onClick={() =>
                  setR({
                    ...r,
                    departments: [
                      ...r.departments,
                      { id: uid(), name: "New department", color: "#38bdf8" },
                    ],
                  })
                }
              >
                + Department
              </button>
            </section>
            <section className={a.panel}>
              <h2>Positions</h2>
              {r.positions.map((x, i) => (
                <Row
                  key={x.id}
                  onUp={() =>
                    setR({ ...r, positions: move(r.positions, i, -1) })
                  }
                  onDown={() =>
                    setR({ ...r, positions: move(r.positions, i, 1) })
                  }
                  onDel={() =>
                    setR({
                      ...r,
                      positions: r.positions.filter((y) => y.id !== x.id),
                    })
                  }
                >
                  <div className={a.line}>
                    <input
                      value={x.name}
                      aria-label="Position name"
                      onChange={(e) =>
                        setR({
                          ...r,
                          positions: r.positions.map((y) =>
                            y.id === x.id ? { ...y, name: e.target.value } : y,
                          ),
                        })
                      }
                    />
                    <select
                      value={x.dept}
                      aria-label="Department"
                      onChange={(e) =>
                        setR({
                          ...r,
                          positions: r.positions.map((y) =>
                            y.id === x.id ? { ...y, dept: e.target.value } : y,
                          ),
                        })
                      }
                    >
                      {r.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    value={x.about}
                    placeholder="Description (shown in the Position Interest field)"
                    onChange={(e) =>
                      setR({
                        ...r,
                        positions: r.positions.map((y) =>
                          y.id === x.id ? { ...y, about: e.target.value } : y,
                        ),
                      })
                    }
                  />
                </Row>
              ))}
              <button
                type="button"
                className={a.btn}
                onClick={() =>
                  setR({
                    ...r,
                    positions: [
                      ...r.positions,
                      {
                        id: uid(),
                        name: "New position",
                        dept: r.departments[0]?.id ?? "",
                        about: "",
                      },
                    ],
                  })
                }
              >
                + Position
              </button>
            </section>
            <section className={a.panel}>
              <h2>Members</h2>
              <div className={a.line}>
                <span className={a.muted}>Name color (everyone)</span>
                <Color
                  v={r.nameColor}
                  set={(col) => setR({ ...r, nameColor: col })}
                />
              </div>
              {r.members.map((m, i) => (
                <Row
                  key={m.id}
                  onUp={() => setR({ ...r, members: move(r.members, i, -1) })}
                  onDown={() => setR({ ...r, members: move(r.members, i, 1) })}
                  onDel={() =>
                    setR({
                      ...r,
                      members: r.members.filter((y) => y.id !== m.id),
                    })
                  }
                >
                  {(() => {
                    const up = (k: Partial<typeof m>) =>
                      setR({
                        ...r,
                        members: r.members.map((y) =>
                          y.id === m.id ? { ...y, ...k } : y,
                        ),
                      });
                    return (
                      <>
                        <div className={a.line}>
                          <input
                            value={m.name}
                            aria-label="Name"
                            onChange={(e) => up({ name: e.target.value })}
                          />
                          <input
                            type="date"
                            value={m.joined}
                            aria-label="Join date"
                            onChange={(e) => up({ joined: e.target.value })}
                          />
                        </div>
                        <div className={a.line}>
                          <input
                            value={m.city}
                            placeholder="City"
                            aria-label="City"
                            onChange={(e) => up({ city: e.target.value })}
                          />
                          <input
                            value={m.state}
                            placeholder="State"
                            aria-label="State"
                            onChange={(e) => up({ state: e.target.value })}
                          />
                        </div>
                        <div className={a.line}>
                          {r.positions.map((x) => (
                            <label key={x.id} className={a.line}>
                              <input
                                type="checkbox"
                                checked={m.positions.includes(x.id)}
                                onChange={() =>
                                  up({
                                    positions: m.positions.includes(x.id)
                                      ? m.positions.filter((y) => y !== x.id)
                                      : [...m.positions, x.id],
                                  })
                                }
                              />
                              {x.name}
                            </label>
                          ))}
                        </div>
                        <span className={a.muted}>
                          The first position ticked decides the department they
                          show under.
                        </span>
                      </>
                    );
                  })()}
                </Row>
              ))}
              <button
                type="button"
                className={a.btn}
                onClick={() =>
                  setR({
                    ...r,
                    members: [
                      ...r.members,
                      {
                        id: uid(),
                        name: "New member",
                        city: "",
                        state: "",
                        joined: new Date().toISOString().slice(0, 10),
                        positions: r.positions[0] ? [r.positions[0].id] : [],
                      },
                    ],
                  })
                }
              >
                + Member
              </button>
            </section>
            {saveBtn("roster")}
          </div>
          <div className={a.sticky}>
            <RosterView roster={r} />
          </div>
        </div>
      )}

      {tab === "styles" && (
        <div className={a.drafts}>
          <p className={a.muted}>
            Three looks, drawn with your roster. Pick one and save; the live
            roster switches to it.
          </p>
          {STYLES.map(([id, name, text]) => (
            <section
              key={id}
              className={a.draft}
              data-on={r.style === id ? "" : undefined}
            >
              <div className={a.line}>
                <b>{name}</b>
                <span className={a.muted}>{text}</span>
                <button
                  type="button"
                  className={`${a.btn} ${r.style === id ? a.primary : ""}`}
                  onClick={() => setR({ ...r, style: id })}
                >
                  {r.style === id ? "Chosen" : "Use this look"}
                </button>
              </div>
              <RosterView roster={r} style={id} />
            </section>
          ))}
          {saveBtn("roster")}
        </div>
      )}

      {tab === "apps" && (
        <Builder
          c={c}
          setC={setC}
          ctx={ctx}
          save={() => save("center")}
          busy={busy}
          msg={msg}
        />
      )}
      {tab === "subs" && <Subs subs={p.subs} c={c} ctx={ctx} />}

      {tab === "lists" && (
        <div className={a.wrap}>
          <section className={a.panel}>
            <h2>Application statuses (badge colors)</h2>
            {c.statuses.map((x, i) => (
              <Row
                key={x.id}
                onUp={() => setC({ ...c, statuses: move(c.statuses, i, -1) })}
                onDown={() => setC({ ...c, statuses: move(c.statuses, i, 1) })}
                onDel={() =>
                  setC({
                    ...c,
                    statuses: c.statuses.filter((y) => y.id !== x.id),
                  })
                }
              >
                <div className={a.line}>
                  <input
                    value={x.label}
                    aria-label="Status"
                    onChange={(e) =>
                      setC({
                        ...c,
                        statuses: c.statuses.map((y) =>
                          y.id === x.id ? { ...y, label: e.target.value } : y,
                        ),
                      })
                    }
                  />
                  <Color
                    v={x.color}
                    set={(col) =>
                      setC({
                        ...c,
                        statuses: c.statuses.map((y) =>
                          y.id === x.id ? { ...y, color: col } : y,
                        ),
                      })
                    }
                  />
                  <StatusBadge st={x} />
                </div>
              </Row>
            ))}
            <span className={a.muted}>
              The first status is what a new application starts as.
            </span>
            <button
              type="button"
              className={a.btn}
              onClick={() =>
                setC({
                  ...c,
                  statuses: [
                    ...c.statuses,
                    { id: uid(), label: "New status", color: "#38bdf8" },
                  ],
                })
              }
            >
              + Status
            </button>
          </section>
          <section className={a.panel}>
            <h2>Team Referral list</h2>
            {c.team.map((x, i) => (
              <Row
                key={x.id}
                onUp={() => setC({ ...c, team: move(c.team, i, -1) })}
                onDown={() => setC({ ...c, team: move(c.team, i, 1) })}
                onDel={() =>
                  setC({ ...c, team: c.team.filter((y) => y.id !== x.id) })
                }
              >
                <input
                  value={x.name}
                  aria-label="Team member"
                  onChange={(e) =>
                    setC({
                      ...c,
                      team: c.team.map((y) =>
                        y.id === x.id ? { ...y, name: e.target.value } : y,
                      ),
                    })
                  }
                />
              </Row>
            ))}
            <button
              type="button"
              className={a.btn}
              onClick={() =>
                setC({
                  ...c,
                  team: [...c.team, { id: uid(), name: "New teammate" }],
                })
              }
            >
              + Teammate
            </button>
          </section>
          <section className={a.panel}>
            <h2>Social profiles</h2>
            {c.socials.map((x, i) => (
              <Row
                key={x.id}
                onUp={() => setC({ ...c, socials: move(c.socials, i, -1) })}
                onDown={() => setC({ ...c, socials: move(c.socials, i, 1) })}
                onDel={() =>
                  setC({
                    ...c,
                    socials: c.socials.filter((y) => y.id !== x.id),
                  })
                }
              >
                <div className={a.line}>
                  <input
                    value={x.name}
                    aria-label="Network"
                    onChange={(e) =>
                      setC({
                        ...c,
                        socials: c.socials.map((y) =>
                          y.id === x.id ? { ...y, name: e.target.value } : y,
                        ),
                      })
                    }
                  />
                  <input
                    value={x.prefix}
                    placeholder="Profile link start (optional)"
                    aria-label="Link prefix"
                    onChange={(e) =>
                      setC({
                        ...c,
                        socials: c.socials.map((y) =>
                          y.id === x.id ? { ...y, prefix: e.target.value } : y,
                        ),
                      })
                    }
                  />
                  <Color
                    v={x.color}
                    set={(col) =>
                      setC({
                        ...c,
                        socials: c.socials.map((y) =>
                          y.id === x.id ? { ...y, color: col } : y,
                        ),
                      })
                    }
                  />
                </div>
              </Row>
            ))}
            <button
              type="button"
              className={a.btn}
              onClick={() =>
                setC({
                  ...c,
                  socials: [
                    ...c.socials,
                    {
                      id: uid(),
                      name: "New network",
                      color: "#38bdf8",
                      prefix: "",
                    },
                  ],
                })
              }
            >
              + Network
            </button>
          </section>
          {saveBtn("center")}
        </div>
      )}

      {tab === "ideas" && (
        <div className={a.wrap}>
          <p className={a.muted}>
            Tap the upgrades you want for the Application Center, then save.
            Picked: {c.ideas.length}.
          </p>
          <div className={a.ideas}>
            {IDEAS.map((x) => (
              <button
                key={x.id}
                type="button"
                className={a.idea}
                aria-pressed={c.ideas.includes(x.id)}
                onClick={() =>
                  setC({
                    ...c,
                    ideas: c.ideas.includes(x.id)
                      ? c.ideas.filter((y) => y !== x.id)
                      : [...c.ideas, x.id],
                  })
                }
              >
                <b>
                  {c.ideas.includes(x.id) ? "✓ " : ""}
                  {x.title}
                </b>
                <span>{x.text}</span>
              </button>
            ))}
          </div>
          {saveBtn("center")}
        </div>
      )}
    </div>
  );
}

function Builder({
  c,
  setC,
  ctx,
  save,
  busy,
  msg,
}: {
  c: AppCenter;
  setC: (c: AppCenter) => void;
  ctx: Ctx;
  save: () => void;
  busy: boolean;
  msg: string;
}) {
  const [sel, setSel] = useState(c.applications[0]?.id ?? "");
  const [add, setAdd] = useState<FieldType>("short");
  const app = c.applications.find((x) => x.id === sel);
  const upApp = (k: Partial<Application>) =>
    setC({
      ...c,
      applications: c.applications.map((x) =>
        x.id === sel ? { ...x, ...k } : x,
      ),
    });
  const upField = (id: string, k: Partial<Field>) =>
    app &&
    upApp({
      fields: app.fields.map((f) => (f.id === id ? { ...f, ...k } : f)),
    });
  const newApp = () => {
    const x: Application = {
      id: uid(),
      title: "New application",
      blurb: "",
      accent: "#38bdf8",
      open: false,
      fields: [],
    };
    setC({ ...c, applications: [...c.applications, x] });
    setSel(x.id);
  };
  return (
    <div className={a.wrap}>
      <div className={a.line}>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          aria-label="Application"
        >
          {c.applications.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
              {x.open ? "" : " (closed)"}
            </option>
          ))}
        </select>
        <button type="button" className={a.btn} onClick={newApp}>
          + New application
        </button>
        {app && (
          <button
            type="button"
            className={a.btn}
            onClick={() => {
              const x = {
                ...app,
                id: uid(),
                title: `${app.title} (copy)`,
                open: false,
                fields: app.fields.map((f) => ({ ...f, id: uid() })),
              };
              setC({ ...c, applications: [...c.applications, x] });
              setSel(x.id);
            }}
          >
            Duplicate
          </button>
        )}
        {app && (
          <button
            type="button"
            className={a.btn}
            onClick={() => {
              setC({
                ...c,
                applications: c.applications.filter((x) => x.id !== sel),
              });
              setSel("");
            }}
          >
            Delete
          </button>
        )}
      </div>
      {!app ? (
        <p className={a.muted}>Create an application to start building.</p>
      ) : (
        <div className={a.split}>
          <div className={a.wrap}>
            <section className={a.panel}>
              <div className={a.line}>
                <input
                  value={app.title}
                  aria-label="Title"
                  onChange={(e) => upApp({ title: e.target.value })}
                />
                <Color v={app.accent} set={(col) => upApp({ accent: col })} />
                <label className={a.line}>
                  <input
                    type="checkbox"
                    checked={app.open}
                    onChange={(e) => upApp({ open: e.target.checked })}
                  />{" "}
                  Open to applicants
                </label>
              </div>
              <textarea
                value={app.blurb}
                placeholder="What this application is for"
                onChange={(e) => upApp({ blurb: e.target.value })}
              />
            </section>
            {app.fields.map((f, i) => (
              <Row
                key={f.id}
                onUp={() => upApp({ fields: move(app.fields, i, -1) })}
                onDown={() => upApp({ fields: move(app.fields, i, 1) })}
                onDel={() =>
                  upApp({ fields: app.fields.filter((x) => x.id !== f.id) })
                }
              >
                <div className={a.line}>
                  <b className={a.muted}>
                    {FIELD_TYPES.find((t) => t.type === f.type)?.label}
                  </b>
                  {f.type !== "section" && (
                    <label className={a.line}>
                      <input
                        type="checkbox"
                        checked={!!f.required}
                        onChange={(e) =>
                          upField(f.id, { required: e.target.checked })
                        }
                      />{" "}
                      Required
                    </label>
                  )}
                </div>
                <input
                  value={f.label}
                  aria-label="Question"
                  onChange={(e) => upField(f.id, { label: e.target.value })}
                />
                {f.type !== "section" && (
                  <input
                    value={f.help ?? ""}
                    placeholder="Help text (optional)"
                    onChange={(e) => upField(f.id, { help: e.target.value })}
                  />
                )}
                {["short", "paragraph", "email", "phone", "url"].includes(
                  f.type,
                ) && (
                  <input
                    value={f.placeholder ?? ""}
                    placeholder="Placeholder (optional)"
                    onChange={(e) =>
                      upField(f.id, { placeholder: e.target.value })
                    }
                  />
                )}
                {["radio", "checkbox", "dropdown"].includes(f.type) && (
                  <>
                    <textarea
                      value={(f.options ?? []).join("\n")}
                      placeholder="One choice per line"
                      onChange={(e) =>
                        upField(f.id, { options: e.target.value.split("\n") })
                      }
                      onBlur={(e) =>
                        upField(f.id, {
                          options: e.target.value
                            .split("\n")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                    {f.type !== "dropdown" && (
                      <label className={a.line}>
                        <input
                          type="checkbox"
                          checked={
                            f.type === "checkbox"
                              ? f.multi !== false
                              : !!f.multi
                          }
                          onChange={(e) =>
                            upField(f.id, { multi: e.target.checked })
                          }
                        />{" "}
                        Allow more than one choice
                      </label>
                    )}
                  </>
                )}
                {["number", "range", "stars"].includes(f.type) && (
                  <div className={a.line}>
                    {f.type !== "stars" && (
                      <input
                        type="number"
                        value={f.min ?? ""}
                        placeholder="Min"
                        aria-label="Min"
                        onChange={(e) =>
                          upField(f.id, {
                            min:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    )}
                    <input
                      type="number"
                      value={f.max ?? ""}
                      placeholder={f.type === "stars" ? "Stars (5)" : "Max"}
                      aria-label="Max"
                      onChange={(e) =>
                        upField(f.id, {
                          max:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                    {f.type !== "stars" && (
                      <input
                        type="number"
                        value={f.step ?? ""}
                        placeholder="Step"
                        aria-label="Step"
                        onChange={(e) =>
                          upField(f.id, {
                            step:
                              e.target.value === ""
                                ? undefined
                                : Number(e.target.value),
                          })
                        }
                      />
                    )}
                  </div>
                )}
                {f.type === "terms" && (
                  <textarea
                    value={f.terms ?? ""}
                    placeholder="The full terms (shown when they open the title)"
                    onChange={(e) => upField(f.id, { terms: e.target.value })}
                  />
                )}
                {f.type === "referral" && (
                  <span className={a.muted}>
                    Lists your Team Referral names (Statuses & lists).
                  </span>
                )}
                {f.type === "positions" && (
                  <span className={a.muted}>
                    Lists every roster position with its description.
                  </span>
                )}
                {f.type === "social" && (
                  <span className={a.muted}>
                    Lists your Social profiles (Statuses & lists).
                  </span>
                )}
              </Row>
            ))}
            <section className={a.panel}>
              <div className={a.line}>
                <select
                  value={add}
                  onChange={(e) => setAdd(e.target.value as FieldType)}
                  aria-label="Question type"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`${a.btn} ${a.primary}`}
                  onClick={() =>
                    upApp({
                      fields: [
                        ...app.fields,
                        {
                          id: uid(),
                          type: add,
                          label: FIELD_TYPES.find((t) => t.type === add)!.label,
                          options: ["radio", "checkbox", "dropdown"].includes(
                            add,
                          )
                            ? ["Option 1", "Option 2"]
                            : undefined,
                        },
                      ],
                    })
                  }
                >
                  + Add question
                </button>
              </div>
            </section>
            <div className={a.line}>
              <button
                type="button"
                className={`${a.btn} ${a.primary}`}
                disabled={busy}
                onClick={save}
              >
                {busy ? "Saving…" : "Save applications"}
              </button>
              {msg && <span className={a.saved}>{msg}</span>}
            </div>
          </div>
          <div className={a.sticky}>
            <p className={a.muted}>
              Live preview (submitting here only tests the button).
            </p>
            <ApplyForm
              key={app.id + app.fields.length}
              app={app}
              ctx={ctx}
              preview
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Subs({
  subs,
  c,
  ctx,
}: {
  subs: Submission[];
  c: AppCenter;
  ctx: Ctx;
}) {
  const [list, setList] = useState(subs);
  const [open, setOpen] = useState("");
  const [, go] = useTransition();
  const st = new Map(c.statuses.map((x) => [x.id, x]));
  const team = new Map(c.team.map((x) => [x.id, x.name]));
  const pos = new Map(ctx.positions.map((x) => [x.id, x.name]));
  const tally = new Map<string, number>();
  for (const s of list)
    for (const f of c.applications.find((x) => x.id === s.app)?.fields ?? [])
      if (f.type === "referral" && Array.isArray(s.answers[f.id]))
        for (const t of s.answers[f.id] as string[])
          tally.set(t, (tally.get(t) ?? 0) + 1);
  const show = (f: Field, v: Answer | undefined): ReactNode => {
    if (v === undefined || v === "") return "—";
    if (f.type === "signature")
      // A data URL from the applicant's own pad; nothing for the image optimizer to do.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={String(v)} alt="Signature" />;
    if (f.type === "referral")
      return (v as string[]).map((t) => team.get(t) ?? t).join(", ");
    if (f.type === "positions")
      return (v as string[]).map((t) => pos.get(t) ?? t).join(", ");
    if (f.type === "social")
      return Object.entries(v as Record<string, string>)
        .filter(([, x]) => x)
        .map(
          ([k, x]) => `${c.socials.find((s) => s.id === k)?.name ?? k}: ${x}`,
        )
        .join(" · ");
    if (f.type === "yesno") return v ? "Yes" : "No";
    if (f.type === "terms") return v ? "Agreed" : "Not agreed";
    return Array.isArray(v) ? v.join(", ") : String(v);
  };
  return (
    <div className={a.wrap}>
      <section className={a.panel}>
        <h2>Referrals</h2>
        <div className={a.tally}>
          {c.team.map((t) => (
            <span key={t.id}>
              {t.name}: <b>{tally.get(t.id) ?? 0}</b>
            </span>
          ))}
        </div>
      </section>
      {!list.length && <p className={a.muted}>No applications yet.</p>}
      {list.map((s) => {
        const app = c.applications.find((x) => x.id === s.app);
        const up = (k: Partial<Submission>) => {
          const n = { ...s, ...k };
          setList(list.map((x) => (x.id === s.id ? n : x)));
          go(() => setSubmission(s.id, n.status, n.note));
        };
        return (
          <div key={s.id} className={a.sub}>
            <div className={a.line}>
              <b>{s.name}</b>
              <span className={a.muted}>
                {s.appTitle} · {new Date(s.at).toLocaleString()} · {s.email}
              </span>
              <StatusBadge st={st.get(s.status)} />
            </div>
            <div className={a.line}>
              <select
                value={s.status}
                aria-label="Status"
                onChange={(e) => up({ status: e.target.value })}
              >
                {c.statuses.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={a.btn}
                onClick={() => setOpen(open === s.id ? "" : s.id)}
              >
                {open === s.id ? "Hide answers" : "Answers"}
              </button>
              <button
                type="button"
                className={a.btn}
                onClick={() => {
                  setList(list.filter((x) => x.id !== s.id));
                  go(() => removeSubmission(s.id));
                }}
              >
                Delete
              </button>
            </div>
            <input
              defaultValue={s.note}
              placeholder="Private note"
              onBlur={(e) =>
                e.target.value !== s.note && up({ note: e.target.value })
              }
            />
            {open === s.id && (
              <dl className={a.kv}>
                {(app?.fields ?? [])
                  .filter((f) => f.type !== "section")
                  .map((f) => (
                    <div key={f.id}>
                      <dt>{f.label}</dt>
                      <dd>{show(f, s.answers[f.id])}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
