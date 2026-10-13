"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Group } from "@/lib/colors/registry";
import { saveGroup } from "./actions";
import s from "./Colors.module.css";

const HEX = /^#[0-9a-f]{6}$/i;

/** One color group: a picker and a hex box per color, a live preview strip, save. */
export function GroupForm({
  group,
  current,
}: {
  group: Group;
  current: Record<string, string>;
}) {
  const [vals, setVals] = useState(() =>
    Object.fromEntries(
      group.entries.map((e) => [e.key, current[e.key] ?? e.def]),
    ),
  );
  const [state, action, pending] = useActionState(saveGroup, null);
  const changed = group.entries.filter(
    (e) => (current[e.key] ?? e.def) !== vals[e.key],
  ).length;
  const custom = group.entries.filter((e) => current[e.key]).length;
  return (
    <details className={s.group}>
      <summary>
        <span className={s.strip} aria-hidden>
          {group.entries.map((e) => (
            <i
              key={e.key}
              style={{
                background: HEX.test(vals[e.key]) ? vals[e.key] : e.def,
              }}
            />
          ))}
        </span>
        <b>{group.label}</b>
        {custom > 0 && <em>{custom} custom</em>}
      </summary>
      <form action={action} className={s.form}>
        <input type="hidden" name="group" value={group.id} />
        {group.note && <p className={s.note}>{group.note}</p>}
        {group.entries.map((e) => {
          const v = vals[e.key];
          const ok = HEX.test(v);
          return (
            <div key={e.key} className={s.row}>
              <input
                type="color"
                value={ok ? v : e.def}
                onChange={(ev) =>
                  setVals({ ...vals, [e.key]: ev.target.value })
                }
                aria-label={`${e.label} color`}
              />
              <span className={s.label}>{e.label}</span>
              <input
                className={s.hex}
                name={e.key}
                value={v}
                maxLength={7}
                spellCheck={false}
                aria-invalid={!ok}
                onChange={(ev) => {
                  const t = ev.target.value.trim();
                  setVals({
                    ...vals,
                    [e.key]: t.startsWith("#") ? t : `#${t}`,
                  });
                }}
              />
              <button
                type="button"
                className={s.reset}
                disabled={v.toLowerCase() === e.def.toLowerCase()}
                onClick={() => setVals({ ...vals, [e.key]: e.def })}
                aria-label={`Reset ${e.label} to default`}
                title={`Default ${e.def}`}
              >
                <RotateCcw aria-hidden />
              </button>
            </div>
          );
        })}
        <Button
          type="submit"
          variant="primary"
          disabled={pending || changed === 0}
        >
          {pending
            ? "Saving…"
            : changed
              ? `Save ${changed} change${changed > 1 ? "s" : ""}`
              : "No changes"}
        </Button>
        {state && (
          <p className={state.error ? s.err : s.ok} role="status">
            {state.error ?? state.ok}
          </p>
        )}
      </form>
    </details>
  );
}
