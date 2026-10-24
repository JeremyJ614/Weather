"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { clearWord, saveWord, setHints, type SaveState } from "./actions";

export type Row = {
  day: string;
  word: string;
  hint: string;
  source: string;
  played: number;
  solved: number;
};

const SOURCE: Record<string, string> = {
  ai: "AI",
  admin: "Yours",
  list: "Our list",
};
const field =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px]";

export function WeatherdleAdmin({
  today,
  hints: initial,
  rows,
}: {
  today: string;
  hints: boolean;
  rows: Row[];
}) {
  const [hints, setOn] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [state, save, saving] = useActionState<SaveState, FormData>(
    saveWord,
    null,
  );
  const tomorrow = new Date(Date.parse(`${today}T12:00:00Z`) + 86400_000)
    .toISOString()
    .slice(0, 10);
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="grid flex-1 gap-0.5">
          <b>Hints</b>
          <small className="text-muted">
            Players can reveal a one-line hint, which takes a quarter off their
            points. {hints ? "On." : "Off."}
          </small>
          {err && (
            <small role="alert" className="text-accent">
              {err}
            </small>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={hints}
          aria-label="Offer hints"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setHints(!hints);
              if (r.error) setErr(r.error);
              else {
                setErr(null);
                setOn(!hints);
              }
            })
          }
          className={`flex min-h-10 min-w-16 items-center justify-center rounded-full border px-3 text-sm font-bold ${hints ? "border-[var(--lit-line)] bg-[var(--lit)] text-accent" : "border-line text-muted"}`}
        >
          {hints ? "On" : "Off"}
        </button>
      </div>

      <form
        action={save}
        className="grid gap-3 rounded-2xl border border-line bg-surface p-4"
      >
        <b>Set a word</b>
        <label className="grid gap-1 text-sm">
          Day
          <input
            type="date"
            name="day"
            min={today}
            defaultValue={tomorrow}
            required
            className={field}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Word (one word, 3 to 14 letters)
          <input
            name="word"
            required
            minLength={3}
            maxLength={14}
            pattern="[A-Za-z]{3,14}"
            autoComplete="off"
            className={`${field} uppercase`}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Hint (shown only when hints are on and a player asks)
          <input
            name="hint"
            required
            minLength={4}
            maxLength={200}
            className={field}
          />
        </label>
        {state?.error && (
          <p role="alert" className="text-sm text-accent">
            {state.error}
          </p>
        )}
        {state?.saved && <p className="text-sm text-accent">{state.saved}</p>}
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Saving…" : "Save the word"}
        </Button>
      </form>

      <section className="grid gap-2">
        <h2 className="eyebrow">Words</h2>
        {!rows.length && (
          <p className="text-sm text-muted">
            No words yet. Today&apos;s is picked at midnight Eastern or on the
            first visit.
          </p>
        )}
        <ul className="grid gap-2">
          {rows.map((r) => (
            <li
              key={r.day}
              className="grid gap-1 rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <b className="tracking-widest">{r.word}</b>
                <small className="text-muted">
                  {r.day}
                  {r.day === today ? " · today" : ""} ·{" "}
                  {SOURCE[r.source] ?? r.source} · {r.word.length} letters
                </small>
              </span>
              <small className="text-muted">{r.hint}</small>
              <small>
                {r.day > today
                  ? "Not played yet"
                  : `${r.played} played · ${r.solved} solved`}
              </small>
              {r.day > today && (
                <button
                  type="button"
                  className="justify-self-start text-sm text-accent underline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const x = await clearWord(r.day);
                      if (x.error) setErr(x.error);
                    })
                  }
                >
                  Clear (let the daily pick fill it)
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
