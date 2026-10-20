"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { OrgFields } from "@/features/disaster/Forms";
import type { Org, Status } from "@/lib/disaster/data";
import { remove, saveOrg, setStatus } from "./actions";

const LABEL: Record<Status, string> = {
  pending: "Waiting for review",
  approved: "Listed",
  declined: "Declined",
};
const box = "rounded-2xl border border-line bg-surface px-4 py-3";
const small =
  "flex min-h-10 items-center gap-1 rounded-xl border border-line px-3 text-sm text-muted";
const lit =
  "flex min-h-10 items-center gap-1 rounded-xl border border-[var(--lit-line)] bg-[var(--lit)] px-3 text-sm font-bold text-accent";

function OrgForm({ org, onSaved }: { org?: Org; onSaved?: () => void }) {
  const [state, action, pending] = useActionState(
    async (p: Awaited<ReturnType<typeof saveOrg>>, fd: FormData) => {
      const r = await saveOrg(p, fd);
      if (r?.saved) onSaved?.();
      return r;
    },
    null,
  );
  return (
    <form action={action} className="mt-3 grid gap-3">
      {org && <input type="hidden" name="id" value={org.id} />}
      <OrgFields org={org} />
      <label className="grid gap-1 text-sm font-bold">
        <span>
          Order on the page{" "}
          <small className="font-normal text-muted">(lower comes first)</small>
        </span>
        <input
          name="sort"
          type="number"
          min={0}
          max={999}
          defaultValue={org?.sort ?? 100}
          className="min-h-11 w-28 rounded-xl border border-line bg-bg px-3"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      {state?.saved && (
        <p role="status" className="text-sm text-accent">
          Saved.
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : org ? "Save changes" : "Add and list it"}
      </Button>
    </form>
  );
}

function Row({
  id,
  status,
  children,
  title,
  sub,
}: {
  id: string;
  status: Status;
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  const [now, setNow] = useState(status);
  const [gone, setGone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (gone) return null;
  const to = (v: Status) =>
    start(async () => {
      const r = await setStatus(id, v);
      if (r.error) setErr(r.error);
      else setNow(v);
    });
  return (
    <li>
      <details className={box}>
        <summary className="cursor-pointer list-none">
          <span className="flex items-center gap-2">
            <b className="truncate">{title}</b>
            <span
              className={`ml-auto shrink-0 rounded-full border px-2 text-[10px] tracking-wider uppercase ${now === "approved" ? "border-[var(--lit-line)] text-accent" : "border-line text-muted"}`}
            >
              {LABEL[now]}
            </span>
          </span>
          <span className="block text-xs text-muted">{sub}</span>
        </summary>
        {children}
        <div className="mt-3 flex flex-wrap gap-2">
          {now !== "approved" && (
            <button
              type="button"
              disabled={pending}
              className={lit}
              onClick={() => to("approved")}
            >
              Approve and list
            </button>
          )}
          {now === "approved" && (
            <button
              type="button"
              disabled={pending}
              className={small}
              onClick={() => to("pending")}
            >
              Unlist
            </button>
          )}
          {now === "pending" && (
            <button
              type="button"
              disabled={pending}
              className={small}
              onClick={() => to("declined")}
            >
              Decline
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            className={`${small} ml-auto`}
            onClick={() =>
              confirm(`Delete ${title}? This can't be undone.`) &&
              start(async () => {
                const r = await remove(id);
                if (r.error) setErr(r.error);
                else setGone(true);
              })
            }
          >
            Delete
          </button>
        </div>
        {err && (
          <p role="alert" className="mt-2 text-sm text-accent">
            {err}
          </p>
        )}
      </details>
    </li>
  );
}

/** Admin → Disaster Response: every listing (add, edit, list, unlist, delete). */
export function DisasterAdmin({ orgs }: { orgs: Org[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3">
      <details
        className={box}
        open={adding}
        onToggle={(e) => setAdding(e.currentTarget.open)}
      >
        <summary className="cursor-pointer font-bold text-accent">
          Add an organization
        </summary>
        {adding && <OrgForm onSaved={() => setAdding(false)} />}
      </details>
      <ul className="grid gap-2">
        {orgs.map((o) => (
          <Row
            key={o.id}
            id={o.id}
            status={o.status}
            title={o.name}
            sub={o.areas}
          >
            <OrgForm org={o} />
          </Row>
        ))}
      </ul>
    </div>
  );
}
