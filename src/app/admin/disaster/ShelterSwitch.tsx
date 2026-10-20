"use client";

import { useState, useTransition } from "react";
import { setShelterMap } from "./actions";

/** Admin → Disaster Response: the Storm Shelter map's on/off switch. */
export function ShelterSwitch({ on: initial }: { on: boolean }) {
  const [on, setOn] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <span className="grid flex-1 gap-0.5">
        <b>Storm Shelter map</b>
        <small className="text-muted">
          A tab on Disaster Response with FEMA&apos;s registered shelters and
          the ones open now. {on ? "Showing." : "Hidden."}
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
        aria-checked={on}
        aria-label="Show the Storm Shelter map"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setShelterMap(!on);
            if (r.error) setErr(r.error);
            else {
              setErr(null);
              setOn(!on);
            }
          })
        }
        className={`flex min-h-10 min-w-16 items-center justify-center rounded-full border px-3 text-sm font-bold ${on ? "border-[var(--lit-line)] bg-[var(--lit)] text-accent" : "border-line text-muted"}`}
      >
        {on ? "On" : "Off"}
      </button>
    </div>
  );
}
