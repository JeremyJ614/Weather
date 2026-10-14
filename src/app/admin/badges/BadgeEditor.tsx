"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { BadgeIcon, BADGE_ICONS } from "@/components/BadgeIcon";
import { RARITIES, type Badge } from "@/lib/badges";
import type { Colors } from "@/lib/colors/pick";
import { deleteBadge, saveBadge } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

/** One badge form: create (no `badge`) or edit, with a live medallion preview. */
export function BadgeEditor({
  badge,
  colors,
  groups,
}: {
  badge?: Badge;
  colors: Colors;
  groups: string[];
}) {
  const [state, action, pending] = useActionState(saveBadge, null);
  const [icon, setIcon] = useState(badge?.icon ?? "Award");
  const [rarity, setRarity] = useState(badge?.rarity ?? "common");
  const [name, setName] = useState(badge?.name ?? "");
  const [gone, setGone] = useState(false);
  const [del, start] = useTransition();
  if (gone) return null;
  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      {badge && <input type="hidden" name="id" value={badge.id} />}
      <input type="hidden" name="icon" value={icon} />
      <div className="flex items-center gap-3">
        <BadgeIcon badge={{ icon, rarity, name }} colors={colors} size={52} />
        <input
          name="name"
          required
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Badge name"
          aria-label="Badge name"
          className={`${field} font-bold`}
        />
      </div>
      <input
        name="description"
        maxLength={160}
        defaultValue={badge?.description}
        placeholder="How it's earned"
        aria-label="Description"
        className={field}
      />
      <div className="grid grid-cols-2 gap-2">
        <select
          name="rarity"
          value={rarity}
          onChange={(e) => setRarity(e.target.value)}
          className={field}
          aria-label="Rarity"
        >
          {RARITIES.map((r) => (
            <option key={r} value={r}>
              {r[0].toUpperCase() + r.slice(1)}
            </option>
          ))}
        </select>
        <input
          name="grp"
          maxLength={30}
          defaultValue={badge?.grp ?? "General"}
          list="badge-groups"
          placeholder="Group"
          aria-label="Group"
          className={field}
        />
        <datalist id="badge-groups">
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-label="Icon"
      >
        {Object.entries(BADGE_ICONS).map(([k, I]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={icon === k}
            aria-label={k}
            onClick={() => setIcon(k)}
            className={`grid size-9 place-items-center rounded-lg border ${icon === k ? "border-accent text-accent" : "border-line text-muted"}`}
          >
            <I className="size-4" />
          </button>
        ))}
      </div>
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? state.ok}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant={badge ? "secondary" : "primary"}
          disabled={pending}
          className="flex-1"
        >
          {pending ? "Saving…" : badge ? "Save" : "Add badge"}
        </Button>
        {badge && (
          <Button
            type="button"
            variant="ghost"
            disabled={del}
            onClick={() =>
              confirm(`Delete ${badge.name}? Members who have it lose it.`) &&
              start(async () => {
                const r = await deleteBadge(badge.id, badge.name);
                if (!r.error) setGone(true);
              })
            }
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
