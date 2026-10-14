"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  KINDS,
  LOCKED,
  type QKind,
  type Question,
  type SignupForm,
} from "@/lib/auth/signup-form";
import { saveSignupForm } from "../actions";

const field =
  "min-h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm";
const swap = <T,>(l: T[], i: number, j: number) => {
  if (j < 0 || j >= l.length) return l;
  const o = [...l];
  [o[i], o[j]] = [o[j], o[i]];
  return o;
};

/** The signup questions: reorder, switch on or off, required or optional, and add your own. */
export function FormEditor({ form }: { form: SignupForm }) {
  const [qs, setQs] = useState(form.questions);
  const [intro, setIntro] = useState(form.intro);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (next: Question[]) => {
    setQs(next);
    setDirty(true);
    setStatus(null);
  };
  const edit = (i: number, patch: Partial<Question>) =>
    set(qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const pinAt = qs.findIndex((q) => q.id === "pin");
  const add = () =>
    set([
      ...qs.slice(0, pinAt),
      {
        id: `q${Date.now().toString(36)}`,
        label: "New question",
        help: "",
        kind: "text",
        options: [],
        required: false,
        on: true,
      },
      ...qs.slice(pinAt),
    ]);

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-bold">
        Welcome note (optional)
        <textarea
          value={intro}
          maxLength={300}
          rows={2}
          onChange={(e) => {
            setIntro(e.target.value);
            setDirty(true);
          }}
          className="rounded-xl border border-line bg-bg px-3 py-2 font-normal"
        />
      </label>
      <ol className="grid gap-2">
        {qs.map((q, i) => {
          const locked = q.builtin && LOCKED.includes(q.builtin);
          const isPin = q.id === "pin";
          return (
            <li
              key={q.id}
              className={`grid gap-2 rounded-2xl border border-line bg-surface p-3 ${q.on ? "" : "opacity-55"}`}
            >
              <div className="flex items-center gap-2">
                <span className="mono w-6 text-center text-xs text-muted">
                  {i + 1}
                </span>
                <input
                  className={`${field} font-bold`}
                  value={q.label}
                  maxLength={120}
                  aria-label="Question"
                  onChange={(e) => edit(i, { label: e.target.value })}
                />
                {!isPin && (
                  <>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => set(swap(qs, i, i - 1))}
                      className="grid size-9 place-items-center rounded-lg text-muted disabled:opacity-25"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i >= pinAt - 1}
                      onClick={() => set(swap(qs, i, i + 1))}
                      className="grid size-9 place-items-center rounded-lg text-muted disabled:opacity-25"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </>
                )}
              </div>
              <input
                className={field}
                value={q.help}
                maxLength={200}
                placeholder="Hint under the question (optional)"
                aria-label="Hint"
                onChange={(e) => edit(i, { help: e.target.value })}
              />
              {(!q.builtin || q.builtin === "foundUs") && (
                <select
                  className={field}
                  value={q.kind}
                  aria-label="Answer type"
                  onChange={(e) => edit(i, { kind: e.target.value as QKind })}
                >
                  {KINDS.filter(
                    (k) => !q.builtin || k.id === "text" || k.id === "choice",
                  ).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              )}
              {(q.kind === "choice" || q.kind === "multi") && (
                <textarea
                  className="rounded-xl border border-line bg-bg px-3 py-2 text-sm"
                  rows={3}
                  defaultValue={q.options.join("\n")}
                  placeholder="One choice per line"
                  aria-label="Choices"
                  onBlur={(e) =>
                    edit(i, {
                      options: e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    })
                  }
                />
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                {locked ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <Lock className="size-3.5" /> Always asked and required
                  </span>
                ) : (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.on}
                        onChange={(e) => edit(i, { on: e.target.checked })}
                        className="size-4 accent-[var(--accent)]"
                      />
                      Asked
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          edit(i, { required: e.target.checked })
                        }
                        className="size-4 accent-[var(--accent)]"
                      />
                      Required
                    </label>
                  </>
                )}
                {!q.builtin && (
                  <button
                    type="button"
                    onClick={() => set(qs.filter((_, k) => k !== i))}
                    className="ml-auto flex items-center gap-1 text-xs text-muted"
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={add}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--lit-line)] font-bold text-accent"
      >
        <Plus className="size-4" /> Add a question
      </button>
      {status && (
        <p role="status" className="text-sm text-accent">
          {status}
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        disabled={pending || !dirty}
        onClick={() =>
          start(async () => {
            const r = await saveSignupForm(
              JSON.stringify({ questions: qs, intro }),
            );
            setStatus(r?.error ?? "Saved. New signups see this form now.");
            if (!r?.error) setDirty(false);
          })
        }
      >
        {pending ? "Saving…" : dirty ? "Save form" : "Saved"}
      </Button>
    </div>
  );
}
