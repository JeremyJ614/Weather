"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { Banner } from "@/lib/settings";
import { saveOps } from "../actions";

const localInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

export function OpsForm({
  modules,
  disabled,
  banner,
}: {
  modules: readonly { id: string; label: string }[];
  disabled: string[];
  banner: Banner;
}) {
  const [state, action, pending] = useActionState(saveOps, null);
  return (
    <form
      action={(fd) => {
        const until = String(fd.get("bannerUntilLocal") ?? "");
        fd.set("bannerUntil", until ? new Date(until).toISOString() : "");
        return action(fd);
      }}
      className="grid gap-4"
    >
      <fieldset className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Kill switches</legend>
        {modules.map((m) => (
          <label
            key={m.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            {m.label}
            <span className="flex items-center gap-2 text-xs text-muted">
              Off
              <input
                type="checkbox"
                name="off"
                value={m.id}
                defaultChecked={disabled.includes(m.id)}
                className="size-5 accent-[var(--accent)]"
              />
            </span>
          </label>
        ))}
        <p className="text-xs text-muted">
          A switched-off part shows an honest maintenance notice.
        </p>
      </fieldset>
      <fieldset className="grid gap-2 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Maintenance banner</legend>
        <textarea
          name="bannerText"
          defaultValue={banner.text}
          maxLength={200}
          rows={2}
          placeholder="Leave empty for no banner"
          className="rounded-xl border border-line bg-bg px-3 py-2"
        />
        <label className="grid gap-1 text-sm">
          Clears on its own at (optional)
          <input
            type="datetime-local"
            name="bannerUntilLocal"
            defaultValue={localInput(banner.until)}
            className="min-h-11 rounded-xl border border-line bg-bg px-3"
          />
        </label>
      </fieldset>
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? "Saved. Everyone sees the change now."}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
