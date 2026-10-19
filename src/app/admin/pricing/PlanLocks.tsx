"use client";

import { useState, useTransition } from "react";
import { Lock } from "lucide-react";
import { setPlanLocks } from "./actions";

/** Admin → Pricing: lock pages by plan, once payments are live. */
export function PlanLocks({
  initial,
  payments,
}: {
  initial: boolean;
  payments: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
      <label className="flex items-center gap-3">
        <Lock className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="grid flex-1 gap-0.5">
          <b>Lock pages by plan</b>
          <small className="text-[12.5px] text-muted">
            {payments
              ? "Members see the pages their paid plan and add-ons open; anything else sends them to Plans & Pricing. Admins are never locked."
              : "Turns on once card payments are connected. Until then every page stays open."}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={pending || (!payments && !on)}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            start(async () => {
              const r = await setPlanLocks(next);
              setMsg(r?.error ?? r?.ok ?? "");
              if (r?.error) setOn(!next);
            });
          }}
          className="relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full border border-line bg-bg after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-muted after:transition-transform after:duration-200 checked:border-[var(--lit-line)] checked:after:translate-x-5 checked:after:bg-accent disabled:opacity-50"
        />
      </label>
      {msg && (
        <p role="status" className="text-sm text-accent">
          {msg}
        </p>
      )}
    </section>
  );
}
