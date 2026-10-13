"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { SiteDefaults } from "@/lib/settings";
import { saveDefaults } from "../actions";

type Opt = { id: string; name: string };
const select = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

function Pick({
  label,
  name,
  opts,
  value,
}: {
  label: string;
  name: string;
  opts: Opt[];
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      <select name={name} defaultValue={value} className={select}>
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DefaultsForm({
  current,
  main,
  second,
  palettes,
  fonts,
}: {
  current: SiteDefaults;
  main: Opt[];
  second: Opt[];
  palettes: Opt[];
  fonts: Opt[];
}) {
  const [state, action, pending] = useActionState(saveDefaults, null);
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Menus</legend>
        <Pick
          label="Main menu"
          name="main"
          opts={main}
          value={current.menus.main}
        />
        <Pick
          label="Second menu"
          name="second"
          opts={second}
          value={current.menus.second}
        />
        <p className="text-xs text-muted">
          If both are the same style, the second switches to the next one
          offered.
        </p>
      </fieldset>
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Theme</legend>
        <Pick
          label="Colors"
          name="palette"
          opts={palettes}
          value={current.theme.palette}
        />
        <Pick
          label="Fonts"
          name="font"
          opts={fonts}
          value={current.theme.font}
        />
      </fieldset>
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? "Saved. New visitors see these defaults now."}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save defaults"}
      </Button>
    </form>
  );
}
