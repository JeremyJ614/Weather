"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { createMember } from "../actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";
const L = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="grid gap-1 text-sm font-bold">
    {label}
    {children}
  </label>
);

export function CreateForm({ states }: { states: string[] }) {
  const [state, action, pending] = useActionState(createMember, null);
  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Account</legend>
        <L label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            className={field}
          />
        </L>
        <L label="PIN (optional, 4 digits)">
          <input
            name="pin"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="off"
            className={`${field} mono tracking-[.4em]`}
          />
        </L>
        <label className="flex items-center justify-between gap-3 text-sm">
          Email them a sign-in link now
          <input
            type="checkbox"
            name="sendLink"
            defaultChecked
            className="size-5 accent-[var(--accent)]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          SSWX Member
          <input
            type="checkbox"
            name="member"
            className="size-5 accent-[var(--accent)]"
          />
        </label>
      </fieldset>
      <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <legend className="px-1 text-sm text-muted">Profile</legend>
        <div className="grid grid-cols-2 gap-3">
          <L label="First name">
            <input name="firstName" required maxLength={40} className={field} />
          </L>
          <L label="Last name">
            <input name="lastName" required maxLength={40} className={field} />
          </L>
        </div>
        <L label="Nickname (optional)">
          <input name="nickname" maxLength={30} className={field} />
        </L>
        <label className="flex items-center justify-between gap-3 text-sm">
          Show the nickname as their name
          <input
            type="checkbox"
            name="useNickname"
            className="size-5 accent-[var(--accent)]"
          />
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <L label="City">
            <input name="city" required maxLength={60} className={field} />
          </L>
          <L label="State">
            <select name="state" required defaultValue="" className={field}>
              <option value="" disabled>
                –
              </option>
              {states.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </L>
        </div>
        <L label="Birthday (18+)">
          <input name="birthday" type="date" required className={field} />
        </L>
        <L label="Phone (optional)">
          <input name="phone" type="tel" className={field} />
        </L>
        <L label="How they found us (optional)">
          <input name="foundUs" maxLength={200} className={field} />
        </L>
      </fieldset>
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}
