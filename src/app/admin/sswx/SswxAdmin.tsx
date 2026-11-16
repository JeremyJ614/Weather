"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  FIELD_TYPES,
  iconSrc,
  shown,
  uid,
  type Answer,
  type AppCenter,
  type Application,
  type Field,
  type FieldType,
  type Roster,
  type RosterStyle,
  type Stats,
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

type Tab = "roster" | "styles" | "apps" | "subs" | "lists";
const TABS: [Tab, string][] = [
  ["roster", "Active Roster"],
  ["styles", "Roster looks"],
  ["apps", "Application builder"],
  ["subs", "Submissions"],
  ["lists", "Statuses & lists"],
];
const STYLES: [RosterStyle, string, string][] = [
  [
    "tree",
    "Circuit Tree",
    "Each department a glowing trunk; members branch off it in compact rows.",
  ],
  [
    "pulse",
    "Pulse Timeline",
    "One timeline, oldest member first; every node breathes in its department color.",
  ],
  [
    "circuit",
    "Data Stream",
    "Departments stacked; a light runs along each member's trace.",
  ],
];
const OPTS: FieldType[] = [
  "radio",
  "checkbox",
  "dropdown",
  "rank",
  "matrix",
  "color",
];
const NOINPUT: FieldType[] = ["section", "page"];

function move<T>(arr: T[], i: number, d: number) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}
/** A list editor: rows with up/down/remove, and an add button. */
function List<T extends { id: string }>(p: {
  items: T[];
  set: (x: T[]) => void;
  add: () => T;
  addLabel: string;
  row: (x: T, up: (k: Partial<T>) => void, i: number) => ReactNode;
}) {
  return (
    <>
      {p.items.map((x, i) => (
        <div key={x.id} className={a.item}>
          {p.row(
            x,
            (k) =>
              p.set(p.items.map((y) => (y.id === x.id ? { ...y, ...k } : y))),
            i,
          )}
          <div className={a.line}>
            <button
              type="button"
              className={a.icon}
              aria-label="Move up"
              onClick={() => p.set(move(p.items, i, -1))}
            >
              ↑
            </button>
            <button
              type="button"
              className={a.icon}
              aria-label="Move down"
              onClick={() => p.set(move(p.items, i, 1))}
            >
              ↓
            </button>
            <button
              type="button"
              className={a.icon}
              aria-label="Remove"
              onClick={() => p.set(p.items.filter((y) => y.id !== x.id))}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className={a.btn}
        onClick={() => p.set([...p.items, p.add()])}
      >
        {p.addLabel}
      </button>
    </>
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
const Check = ({
  on,
  set,
  children,
}: {
  on: boolean;
  set: (v: boolean) => void;
  children: ReactNode;
}) => (
  <label className={a.line}>
    <input
      type="checkbox"
      checked={on}
      onChange={(e) => set(e.target.checked)}
    />{" "}
    {children}
  </label>
);

export function SswxAdmin(p: {
  roster: Roster;
  center: AppCenter;
  subs: Submission[];
  stats: Stats;
  badges: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>("roster");
  const [r, setR] = useState(p.roster);
  const [c, setC] = useState(p.center);
  const [msg, setMsg] = useState("");
  const [busy, go] = useTransition();
  const save = (what: "roster" | "center") =>
    go(async () => {
      try {
        if (what === "roster") await saveRosterAction(r);
        else await saveCenterAction(c);
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
              <List
                items={r.departments}
                set={(departments) => setR({ ...r, departments })}
                addLabel="+ Department"
                add={() => ({
                  id: uid(),
                  name: "New department",
                  color: "#38bdf8",
                })}
                row={(d, up) => (
                  <div className={a.line}>
                    <input
                      value={d.name}
                      aria-label="Department name"
                      onChange={(e) => up({ name: e.target.value })}
                    />
                    <Color v={d.color} set={(color) => up({ color })} />
                  </div>
                )}
              />
            </section>
            <section className={a.panel}>
              <h2>Positions</h2>
              <List
                items={r.positions}
                set={(positions) => setR({ ...r, positions })}
                addLabel="+ Position"
                add={() => ({
                  id: uid(),
                  name: "New position",
                  dept: r.departments[0]?.id ?? "",
                  about: "",
                })}
                row={(x, up) => (
                  <>
                    <div className={a.line}>
                      <input
                        value={x.name}
                        aria-label="Position name"
                        onChange={(e) => up({ name: e.target.value })}
                      />
                      <select
                        value={x.dept}
                        aria-label="Department"
                        onChange={(e) => up({ dept: e.target.value })}
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
                      placeholder="Description (shown in the Position Interest question)"
                      onChange={(e) => up({ about: e.target.value })}
                    />
                  </>
                )}
              />
            </section>
            <section className={a.panel}>
              <h2>Members</h2>
              <div className={a.line}>
                <span className={a.muted}>Name color (everyone)</span>
                <Color
                  v={r.nameColor}
                  set={(nameColor) => setR({ ...r, nameColor })}
                />
              </div>
              <List
                items={r.members}
                set={(members) => setR({ ...r, members })}
                addLabel="+ Member"
                add={() => ({
                  id: uid(),
                  name: "New member",
                  city: "",
                  state: "",
                  joined: new Date().toISOString().slice(0, 10),
                  positions: r.positions[0] ? [r.positions[0].id] : [],
                })}
                row={(m, up) => (
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
                        <Check
                          key={x.id}
                          on={m.positions.includes(x.id)}
                          set={(on) =>
                            up({
                              positions: on
                                ? [...m.positions, x.id]
                                : m.positions.filter((y) => y !== x.id),
                            })
                          }
                        >
                          {x.name}
                        </Check>
                      ))}
                    </div>
                    <span className={a.muted}>
                      The first position ticked decides the department they show
                      under.
                    </span>
                  </>
                )}
              />
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
            Three vertical looks, drawn with your roster. Pick one and save.
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
          saveBtn={saveBtn("center")}
          stats={p.stats}
          badges={p.badges}
        />
      )}
      {tab === "subs" && <Subs subs={p.subs} c={c} ctx={ctx} />}

      {tab === "lists" && (
        <div className={a.wrap}>
          <section className={a.panel}>
            <h2>Application statuses</h2>
            <List
              items={c.statuses}
              set={(statuses) => setC({ ...c, statuses })}
              addLabel="+ Status"
              add={() => ({
                id: uid(),
                label: "New status",
                color: "#38bdf8",
                icon: "●",
              })}
              row={(x, up) => (
                <>
                  <div className={a.line}>
                    <input
                      value={x.label}
                      aria-label="Status"
                      onChange={(e) => up({ label: e.target.value })}
                    />
                    <Color v={x.color} set={(color) => up({ color })} />
                    <input
                      value={x.icon ?? ""}
                      placeholder="Icon"
                      aria-label="Badge icon"
                      style={{ maxWidth: 70 }}
                      onChange={(e) => up({ icon: e.target.value.slice(0, 2) })}
                    />
                    <StatusBadge st={x} />
                  </div>
                  <div className={a.line}>
                    <Check on={!!x.edit} set={(edit) => up({ edit })}>
                      Lets them edit & resubmit
                    </Check>
                    <Check
                      on={!!x.interview}
                      set={(interview) => up({ interview })}
                    >
                      Opens interview booking
                    </Check>
                    <Check on={!!x.award} set={(award) => up({ award })}>
                      Awards the application&apos;s badge
                    </Check>
                  </div>
                </>
              )}
            />
            <span className={a.muted}>
              The first status is what a new application starts as.
            </span>
          </section>
          <section className={a.panel}>
            <h2>Team Referral list</h2>
            <List
              items={c.team}
              set={(team) => setC({ ...c, team })}
              addLabel="+ Teammate"
              add={() => ({ id: uid(), name: "New teammate" })}
              row={(x, up) => (
                <input
                  value={x.name}
                  aria-label="Team member"
                  onChange={(e) => up({ name: e.target.value })}
                />
              )}
            />
          </section>
          <section className={a.panel}>
            <h2>Social profiles</h2>
            <p className={a.muted}>
              Icon: a Simple Icons name (simpleicons.org, e.g. twitch, snapchat,
              threads) or a link to your own image.
            </p>
            <List
              items={c.socials}
              set={(socials) => setC({ ...c, socials })}
              addLabel="+ Network"
              add={() => ({
                id: uid(),
                name: "New network",
                color: "#38bdf8",
                prefix: "",
                icon: "",
              })}
              row={(x, up) => (
                <div className={a.line}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={iconSrc(x)}
                    alt=""
                    width={30}
                    height={30}
                    style={{ background: x.color, borderRadius: 8, padding: 5 }}
                  />
                  <input
                    value={x.name}
                    aria-label="Network"
                    onChange={(e) => up({ name: e.target.value })}
                  />
                  <input
                    value={x.icon ?? ""}
                    placeholder="Icon name or image link"
                    aria-label="Icon"
                    onChange={(e) => up({ icon: e.target.value.trim() })}
                  />
                  <input
                    value={x.prefix}
                    placeholder="Profile link start (optional)"
                    aria-label="Link prefix"
                    onChange={(e) => up({ prefix: e.target.value })}
                  />
                  <Color v={x.color} set={(color) => up({ color })} />
                </div>
              )}
            />
          </section>
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
  saveBtn,
  stats,
  badges,
}: {
  c: AppCenter;
  setC: (c: AppCenter) => void;
  ctx: Ctx;
  saveBtn: ReactNode;
  stats: Stats;
  badges: { id: string; name: string }[];
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
  const copy = (from: Application | null, title: string) => {
    const x: Application = from
      ? {
          ...from,
          id: uid(),
          title,
          open: false,
          template: false,
          fields: from.fields.map((f) => ({ ...f, id: uid() })),
        }
      : {
          id: uid(),
          title,
          blurb: "",
          accent: "#38bdf8",
          open: false,
          fields: [],
        };
    setC({ ...c, applications: [...c.applications, x] });
    setSel(x.id);
  };
  const st = app ? stats[app.id] : undefined;
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
              {x.template ? "Template: " : ""}
              {x.title}
              {x.open ? "" : " (closed)"}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={a.btn}
          onClick={() => copy(null, "New application")}
        >
          + New
        </button>
        <select
          value=""
          aria-label="New from template"
          onChange={(e) => {
            const t = c.applications.find((x) => x.id === e.target.value);
            if (t) copy(t, t.title.replace(/^Template:?\s*/i, ""));
          }}
        >
          <option value="">New from template…</option>
          {c.applications
            .filter((x) => x.template)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
        </select>
        {app && (
          <button
            type="button"
            className={a.btn}
            onClick={() => copy(app, `${app.title} (copy)`)}
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
                <Color v={app.accent} set={(accent) => upApp({ accent })} />
              </div>
              <div className={a.line}>
                <Check on={app.open} set={(open) => upApp({ open })}>
                  Open to applicants
                </Check>
                <Check
                  on={!!app.template}
                  set={(template) => upApp({ template })}
                >
                  Template (hidden from applicants)
                </Check>
              </div>
              <textarea
                value={app.blurb}
                placeholder="What this application is for"
                onChange={(e) => upApp({ blurb: e.target.value })}
              />
              <div className={a.line}>
                <span className={a.muted}>Acceptance badge</span>
                <select
                  value={app.badge ?? ""}
                  aria-label="Acceptance badge"
                  onChange={(e) =>
                    upApp({ badge: e.target.value || undefined })
                  }
                >
                  <option value="">None</option>
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <Check
                on={app.slots !== undefined}
                set={(on) => upApp({ slots: on ? [] : undefined })}
              >
                Interview booking
              </Check>
              {app.slots !== undefined && (
                <textarea
                  defaultValue={app.slots
                    .map((t) => t.replace("T", " "))
                    .join("\n")}
                  placeholder="One time per line, like 2026-11-20 18:30"
                  onBlur={(e) =>
                    upApp({
                      slots: e.target.value
                        .split("\n")
                        .map((t) => t.trim().replace(" ", "T"))
                        .filter((t) =>
                          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t),
                        ),
                    })
                  }
                />
              )}
              <p className={a.muted}>
                Funnel: {st?.views ?? 0} opened · {st?.starts ?? 0} started ·{" "}
                {st?.done ?? 0} sent
                {st?.views
                  ? ` · ${Math.round((st.done / st.views) * 100)}% finish`
                  : ""}
              </p>
            </section>
            <List
              items={app.fields}
              set={(fields) => upApp({ fields })}
              addLabel=""
              add={(): Field => ({ id: uid(), type: "short", label: "" })}
              row={(f, up, i) => (
                <>
                  <div className={a.line}>
                    <b className={a.muted}>
                      {FIELD_TYPES.find((t) => t.type === f.type)?.label}
                    </b>
                    {!NOINPUT.includes(f.type) && (
                      <Check
                        on={!!f.required}
                        set={(required) => up({ required })}
                      >
                        Required
                      </Check>
                    )}
                  </div>
                  <input
                    value={f.label}
                    aria-label="Question"
                    onChange={(e) => up({ label: e.target.value })}
                  />
                  {!NOINPUT.includes(f.type) && (
                    <input
                      value={f.help ?? ""}
                      placeholder="Help text (optional)"
                      onChange={(e) => up({ help: e.target.value })}
                    />
                  )}
                  {OPTS.includes(f.type) && (
                    <textarea
                      defaultValue={(f.options ?? []).join("\n")}
                      placeholder={
                        f.type === "color"
                          ? "One hex color per line (optional)"
                          : f.type === "matrix"
                            ? "One skill per line"
                            : "One choice per line"
                      }
                      onBlur={(e) =>
                        up({
                          options: e.target.value
                            .split("\n")
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  )}
                  {(f.type === "radio" || f.type === "checkbox") && (
                    <Check
                      on={f.type === "checkbox" ? f.multi !== false : !!f.multi}
                      set={(multi) => up({ multi })}
                    >
                      Allow more than one choice
                    </Check>
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
                            up({
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
                          up({
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
                            up({
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
                      placeholder="The full terms"
                      onChange={(e) => up({ terms: e.target.value })}
                    />
                  )}
                  {i > 0 && !NOINPUT.includes(f.type) && (
                    <div className={a.line}>
                      <span className={a.muted}>Show only if</span>
                      <select
                        value={f.showIf?.field ?? ""}
                        aria-label="Depends on"
                        onChange={(e) =>
                          up({
                            showIf: e.target.value
                              ? {
                                  field: e.target.value,
                                  is: f.showIf?.is ?? "",
                                }
                              : undefined,
                          })
                        }
                      >
                        <option value="">Always show</option>
                        {app.fields
                          .slice(0, i)
                          .filter((x) => !NOINPUT.includes(x.type))
                          .map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.label}
                            </option>
                          ))}
                      </select>
                      {f.showIf && (
                        <input
                          value={f.showIf.is}
                          placeholder="answer is (e.g. Yes)"
                          aria-label="Answer equals"
                          onChange={(e) =>
                            up({
                              showIf: {
                                field: f.showIf!.field,
                                is: e.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            />
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
                          options: [
                            "radio",
                            "checkbox",
                            "dropdown",
                            "rank",
                            "matrix",
                          ].includes(add)
                            ? ["Option 1", "Option 2", "Option 3"]
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
            {saveBtn}
          </div>
          <div className={a.sticky}>
            <p className={a.muted}>
              Live preview (submitting here only plays the button).
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
  const [open, setOpen] = useState(subs[0]?.id ?? "");
  const [msg, setMsg] = useState("");
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
    if (f.type === "social" || f.type === "matrix")
      return Object.entries(v as Record<string, string>)
        .filter(([, x]) => x)
        .map(
          ([k, x]) => `${c.socials.find((y) => y.id === k)?.name ?? k}: ${x}`,
        )
        .join(" · ");
    if (f.type === "color")
      return (
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: 4,
            background: String(v),
          }}
        />
      );
    if (f.type === "yesno") return v ? "Yes" : "No";
    if (f.type === "terms") return v ? "Agreed" : "Not agreed";
    if (f.type === "rank")
      return (v as string[]).map((x, i) => `${i + 1}. ${x}`).join("  ");
    return Array.isArray(v) ? v.join(", ") : String(v);
  };
  const patch = (s: Submission, k: Parameters<typeof setSubmission>[1]) => {
    const n: Submission = {
      ...s,
      ...(k.status ? { status: k.status } : {}),
      ...(k.note !== undefined ? { note: k.note } : {}),
      ...(k.fieldNotes ? { fieldNotes: k.fieldNotes } : {}),
      ...(k.message
        ? {
            messages: [
              ...(s.messages ?? []),
              { at: new Date().toISOString(), text: k.message },
            ],
          }
        : {}),
    };
    setList(list.map((x) => (x.id === s.id ? n : x)));
    go(() => setSubmission(s.id, k));
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
        const isOpen = open === s.id;
        return (
          <section key={s.id} className={a.panel}>
            <button
              type="button"
              className={a.line}
              style={{ textAlign: "left" }}
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? "" : s.id)}
            >
              <b>{s.name}</b>
              <span className={a.muted}>
                {s.appTitle} · {new Date(s.at).toLocaleString()}
              </span>
              <StatusBadge st={st.get(s.status)} />
              {s.slot && (
                <span className={a.muted}>
                  Interview {s.slot.replace("T", " ")}
                </span>
              )}
            </button>
            {isOpen && (
              <>
                <div className={a.line}>
                  <select
                    value={s.status}
                    aria-label="Status"
                    onChange={(e) => patch(s, { status: e.target.value })}
                  >
                    {c.statuses.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <span className={a.muted}>{s.email}</span>
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
                {(app?.fields ?? [])
                  .filter(
                    (f) => !NOINPUT.includes(f.type) && shown(f, s.answers),
                  )
                  .map((f) => (
                    <div key={f.id} className={a.item}>
                      <span className={a.muted}>{f.label}</span>
                      <div>{show(f, s.answers[f.id])}</div>
                      <input
                        defaultValue={s.fieldNotes?.[f.id] ?? ""}
                        placeholder="Note on this answer (they see it when editing)"
                        onBlur={(e) =>
                          e.target.value !== (s.fieldNotes?.[f.id] ?? "") &&
                          patch(s, {
                            fieldNotes: {
                              ...s.fieldNotes,
                              [f.id]: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                <input
                  defaultValue={s.note}
                  placeholder="Private team note"
                  onBlur={(e) =>
                    e.target.value !== s.note &&
                    patch(s, { note: e.target.value })
                  }
                />
                {!!s.messages?.length && (
                  <div className={a.kv}>
                    {s.messages.map((m) => (
                      <p key={m.at}>
                        <span className={a.muted}>
                          {new Date(m.at).toLocaleString()}
                        </span>{" "}
                        {m.text}
                      </p>
                    ))}
                  </div>
                )}
                <div className={a.line}>
                  <input
                    value={msg}
                    placeholder="Message the applicant"
                    onChange={(e) => setMsg(e.target.value)}
                  />
                  <button
                    type="button"
                    className={`${a.btn} ${a.primary}`}
                    disabled={!msg.trim()}
                    onClick={() => {
                      patch(s, { message: msg });
                      setMsg("");
                    }}
                  >
                    Send
                  </button>
                </div>
                {!!s.history?.length && (
                  <p className={a.muted}>
                    History:{" "}
                    {s.history
                      .map(
                        (h) =>
                          `${st.get(h.status)?.label ?? h.status} (${new Date(h.at).toLocaleDateString()})`,
                      )
                      .join(" → ")}
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
