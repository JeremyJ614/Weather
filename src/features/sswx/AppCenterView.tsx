"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  pickSlot,
  resubmit,
  submitApplication,
  track,
} from "@/app/sswx/applications/actions";
import {
  missing,
  shown,
  type Answer,
  type Application,
  type Status,
  type Submission,
} from "@/lib/sswx/types";
import { FieldInput, SubmitButton, type Ctx } from "./Fields";
import s from "./Sswx.module.css";

export function StatusBadge({ st }: { st?: Status }) {
  return st ? (
    <span className={s.badge} style={{ ["--b" as string]: st.color }}>
      <i aria-hidden>{st.icon || "●"}</i>
      {st.label}
    </span>
  ) : null;
}

const draftKey = (id: string) => `sswx-draft-${id}`;
const when = (x: string) =>
  new Date(x).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** One application, page by page. `preview` (admin) never sends; `edit` resubmits. */
export function ApplyForm({
  app,
  ctx,
  onClose,
  preview,
  edit,
}: {
  app: Application;
  ctx: Ctx;
  onClose?: () => void;
  preview?: boolean;
  edit?: {
    id: string;
    answers: Record<string, Answer>;
    notes?: Record<string, string>;
  };
}) {
  const [a, setA] = useState<Record<string, Answer>>(() => {
    if (edit) return edit.answers;
    if (preview) return {};
    try {
      return JSON.parse(localStorage.getItem(draftKey(app.id)) ?? "{}");
    } catch {
      return {};
    }
  });
  const [page, setPage] = useState(0);
  const [err, setErr] = useState("");
  const [state, setState] = useState("");
  const started = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (!preview && !edit) void track(app.id, "views");
  }, [app.id, preview, edit]);
  // Draft autosave: answers stay on this device until sent.
  useEffect(() => {
    if (preview || edit) return;
    try {
      localStorage.setItem(draftKey(app.id), JSON.stringify(a));
    } catch {}
  }, [a, app.id, preview, edit]);
  const pages: (typeof app.fields)[] = [[]];
  for (const f of app.fields)
    if (f.type === "page") pages.push([]);
    else pages[pages.length - 1].push(f);
  const here = (pages[page] ?? []).filter((f) => shown(f, a));
  const asked = app.fields.filter(
    (f) => !["section", "page"].includes(f.type) && shown(f, a),
  );
  const minutes = Math.max(1, Math.round(asked.length * 0.4));
  const check = (fs: typeof app.fields) => {
    for (const f of fs) {
      const m = missing(f, a[f.id]);
      if (m) {
        setErr(`${f.label}: ${m}`);
        document.getElementById(`f-${f.id}`)?.focus();
        return false;
      }
    }
    setErr("");
    return true;
  };
  const set = (id: string, v: Answer) => {
    if (!started.current && !preview && !edit) {
      started.current = true;
      void track(app.id, "starts");
    }
    setA((x) => ({ ...x, [id]: v }));
  };
  const send = async () => {
    if (!check(asked)) return;
    const t0 = Date.now();
    setState("start");
    setTimeout(() => setState((x) => (x === "start" ? "progress" : x)), 500);
    const r = preview
      ? { ok: true as const }
      : edit
        ? await resubmit(edit.id, a)
        : await submitApplication(app.id, a);
    await new Promise((ok) =>
      setTimeout(ok, Math.max(0, 1500 - (Date.now() - t0))),
    );
    if (!r.ok) {
      setState("");
      setErr(r.error);
      return;
    }
    setState("end");
    setTimeout(() => setState("flip"), 700);
    if (preview) return void setTimeout(() => setState(""), 3200);
    try {
      localStorage.removeItem(draftKey(app.id));
    } catch {}
    setTimeout(() => {
      onClose?.();
      router.refresh();
    }, 2600);
  };
  const last = page >= pages.length - 1;
  return (
    <section
      className={`${s.glow} ${s.form}`}
      style={{ ["--a" as string]: app.accent }}
      aria-label={app.title}
    >
      <div className={s.formHead}>
        <h2>{app.title}</h2>
        {onClose && (
          <button type="button" className={s.ghost} onClick={onClose}>
            Back
          </button>
        )}
      </div>
      {app.blurb && <p className={s.muted}>{app.blurb}</p>}
      <p className={s.muted}>
        About {minutes} min
        {edit
          ? " · editing your application"
          : preview
            ? ""
            : " · saved on this device as you go"}
      </p>
      {pages.length > 1 && (
        <div
          className={s.steps}
          aria-label={`Page ${page + 1} of ${pages.length}`}
        >
          {pages.map((_, i) => (
            <i key={i} data-on={i <= page ? "" : undefined} />
          ))}
        </div>
      )}
      {here.map((f, i) =>
        f.type === "section" ? (
          <h3 key={f.id} className={s.section}>
            {f.label}
          </h3>
        ) : (
          <div
            key={f.id}
            className={s.field}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <label className={s.label} htmlFor={`f-${f.id}`}>
              {f.label} {f.required && <i>*</i>}
            </label>
            {f.help && <span className={s.help}>{f.help}</span>}
            {edit?.notes?.[f.id] && (
              <span className={s.fnote}>Team note: {edit.notes[f.id]}</span>
            )}
            <FieldInput f={f} v={a[f.id]} set={(v) => set(f.id, v)} ctx={ctx} />
          </div>
        ),
      )}
      {err && (
        <p className={s.err} role="alert">
          {err}
        </p>
      )}
      <div className={s.nav}>
        {page > 0 ? (
          <button
            type="button"
            className={s.ghost}
            onClick={() => setPage(page - 1)}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        {!last && (
          <button
            type="button"
            className={s.ghost}
            onClick={() => check(here) && setPage(page + 1)}
          >
            Next →
          </button>
        )}
      </div>
      {last && (
        <SubmitButton
          state={state}
          label={edit ? "Resubmit" : "Submit"}
          onClick={send}
        />
      )}
    </section>
  );
}

type Mine = Pick<
  Submission,
  | "id"
  | "app"
  | "appTitle"
  | "at"
  | "status"
  | "answers"
  | "fieldNotes"
  | "messages"
  | "slot"
>;

export function AppCenterView({
  apps,
  all,
  statuses,
  mine,
  ctx,
  taken,
}: {
  apps: Application[];
  all: Application[];
  statuses: Status[];
  mine: Mine[];
  ctx: Ctx;
  taken: string[];
}) {
  const [open, setOpen] = useState<Application | null>(null);
  const [editing, setEditing] = useState<Mine | null>(null);
  const st = new Map(statuses.map((x) => [x.id, x]));
  const router = useRouter();
  if (editing) {
    const app = all.find((x) => x.id === editing.app);
    if (app)
      return (
        <ApplyForm
          app={app}
          ctx={ctx}
          onClose={() => setEditing(null)}
          edit={{
            id: editing.id,
            answers: editing.answers,
            notes: editing.fieldNotes,
          }}
        />
      );
  }
  if (open)
    return <ApplyForm app={open} ctx={ctx} onClose={() => setOpen(null)} />;
  return (
    <>
      <div className={s.apps}>
        {apps.length ? (
          apps.map((a, i) => (
            <button
              key={a.id}
              type="button"
              className={`${s.glow} ${s.app}`}
              style={{
                ["--a" as string]: a.accent,
                animationDelay: `${i * 80}ms`,
              }}
              onClick={() => setOpen(a)}
            >
              <h3>{a.title}</h3>
              <p>{a.blurb}</p>
              <small>
                {
                  a.fields.filter((f) => !["section", "page"].includes(f.type))
                    .length
                }{" "}
                questions · Tap to start
              </small>
            </button>
          ))
        ) : (
          <p className={s.muted}>No applications are open right now.</p>
        )}
      </div>
      <h2 className={s.section}>Your applications</h2>
      {mine.length ? (
        <ul className={s.mine}>
          {mine.map((m, i) => {
            const x = st.get(m.status);
            const slots = all.find((a) => a.id === m.app)?.slots ?? [];
            return (
              <li
                key={m.id}
                style={{ animationDelay: `${i * 60}ms`, display: "grid" }}
              >
                <span className={s.formHead}>
                  <span>
                    <b>{m.appTitle}</b>
                    <small>Sent {new Date(m.at).toLocaleDateString()}</small>
                  </span>
                  <StatusBadge st={x} />
                </span>
                {!!m.messages?.length && (
                  <div className={s.thread}>
                    {m.messages.map((g) => (
                      <p key={g.at}>
                        <small>{when(g.at)}</small>
                        {g.text}
                      </p>
                    ))}
                  </div>
                )}
                {x?.interview && slots.length > 0 && (
                  <div className={s.slots} aria-label="Pick an interview time">
                    {slots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={s.chip}
                        aria-pressed={m.slot === t}
                        disabled={taken.includes(t) && m.slot !== t}
                        onClick={async () => {
                          await pickSlot(m.id, t);
                          router.refresh();
                        }}
                      >
                        {when(t)}
                      </button>
                    ))}
                  </div>
                )}
                {x?.edit && (
                  <button
                    type="button"
                    className={s.ghost}
                    onClick={() => setEditing(m)}
                  >
                    Edit & resubmit
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={s.muted}>You haven&apos;t sent any applications yet.</p>
      )}
    </>
  );
}
