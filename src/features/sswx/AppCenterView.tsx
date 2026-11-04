"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitApplication } from "@/app/sswx/applications/actions";
import {
  missing,
  type Answer,
  type Application,
  type Status,
} from "@/lib/sswx/types";
import { FieldInput, type Ctx } from "./Fields";
import s from "./Sswx.module.css";

type Mine = { id: string; appTitle: string; at: string; status: string };

export function StatusBadge({ st }: { st?: Status }) {
  return st ? (
    <span className={s.badge} style={{ ["--b" as string]: st.color }}>
      {st.label}
    </span>
  ) : null;
}

/** One application, filled in place. `preview` (admin builder) never submits. */
export function ApplyForm({
  app,
  ctx,
  onClose,
  preview,
}: {
  app: Application;
  ctx: Ctx;
  onClose?: () => void;
  preview?: boolean;
}) {
  const [a, setA] = useState<Record<string, Answer>>({});
  const [err, setErr] = useState("");
  const [state, setState] = useState<"" | "sending" | "done">("");
  const router = useRouter();
  const asked = app.fields.filter((f) => f.type !== "section");
  const done = asked.filter((f) => {
    const v = a[f.id];
    return v !== undefined && v !== "" && !(Array.isArray(v) && !v.length);
  }).length;
  const send = async () => {
    for (const f of app.fields) {
      const m = missing(f, a[f.id]);
      if (m) {
        setErr(`${f.label}: ${m}`);
        document.getElementById(`f-${f.id}`)?.focus();
        return;
      }
    }
    setErr("");
    if (preview) {
      setState("done");
      setTimeout(() => setState(""), 1600);
      return;
    }
    setState("sending");
    const r = await submitApplication(app.id, a);
    if (!r.ok) {
      setState("");
      setErr(r.error);
      return;
    }
    setState("done");
    setTimeout(() => {
      onClose?.();
      router.refresh();
    }, 1400);
  };
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
      <div className={s.progress} aria-hidden>
        <i
          style={{
            transform: `scaleX(${asked.length ? done / asked.length : 0})`,
          }}
        />
      </div>
      {app.fields.map((f, i) =>
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
            <FieldInput
              f={f}
              v={a[f.id]}
              set={(v) => setA((x) => ({ ...x, [f.id]: v }))}
              ctx={ctx}
            />
          </div>
        ),
      )}
      {err && (
        <p className={s.err} role="alert">
          {err}
        </p>
      )}
      <div className={s.submit} data-s={state || undefined}>
        <button type="button" onClick={send} disabled={state !== ""}>
          <span className={s.face}>{state === "done" ? "✓" : "Submit"}</span>
          <span className={s.face}>{preview ? "Try it" : "Send it"}</span>
        </button>
      </div>
    </section>
  );
}

export function AppCenterView({
  apps,
  statuses,
  mine,
  ctx,
}: {
  apps: Application[];
  statuses: Status[];
  mine: Mine[];
  ctx: Ctx;
}) {
  const [open, setOpen] = useState<Application | null>(null);
  const st = new Map(statuses.map((x) => [x.id, x]));
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
                {a.fields.filter((f) => f.type !== "section").length} questions
                · Tap to start
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
          {mine.map((m, i) => (
            <li key={m.id} style={{ animationDelay: `${i * 60}ms` }}>
              <span>
                <b>{m.appTitle}</b>
                <small>Sent {new Date(m.at).toLocaleDateString()}</small>
              </span>
              <StatusBadge st={st.get(m.status)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>You haven&apos;t sent any applications yet.</p>
      )}
    </>
  );
}
