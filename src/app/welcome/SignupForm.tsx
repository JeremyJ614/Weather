"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { STATES } from "@/lib/auth/signup";
import type { SignupForm as FormConfig } from "@/lib/auth/signup-form";
import { createProfile } from "../login/actions";

const input = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function SignupForm({ next, form }: { next: string; form: FormConfig }) {
  const [state, action, pending] = useActionState(createProfile, null);
  const [referred, setReferred] = useState(false);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      {form.intro && <p className="text-sm text-muted">{form.intro}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name">
          <input
            name="firstName"
            required
            maxLength={40}
            autoComplete="given-name"
            className={input}
          />
        </Field>
        <Field label="Last name">
          <input
            name="lastName"
            required
            maxLength={40}
            autoComplete="family-name"
            className={input}
          />
        </Field>
      </div>
      {form.show.nickname && (
        <>
          <Field label="Nickname (optional)">
            <input
              name="nickname"
              maxLength={30}
              autoComplete="nickname"
              className={input}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="useNickname"
              className="size-4 accent-[var(--accent)]"
            />
            Use my nickname as my display name
          </label>
        </>
      )}
      {form.show.phone && (
        <Field label="Phone (optional)">
          <input name="phone" type="tel" autoComplete="tel" className={input} />
        </Field>
      )}
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field label="City">
          <input
            name="city"
            required
            maxLength={60}
            autoComplete="address-level2"
            className={input}
          />
        </Field>
        <Field label="State">
          <select name="state" required defaultValue="" className={input}>
            <option value="" disabled>
              –
            </option>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Birthday" hint="You must be 18 or older.">
        <input
          name="birthday"
          type="date"
          required
          autoComplete="bday"
          className={input}
        />
      </Field>
      {form.show.foundUs && (
        <Field label="How did you find us? (optional)">
          {form.foundUsOptions.length ? (
            <select name="foundUs" defaultValue="" className={input}>
              <option value="">–</option>
              {form.foundUsOptions.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input name="foundUs" maxLength={200} className={input} />
          )}
        </Field>
      )}
      {form.show.referral && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={referred}
              onChange={(e) => setReferred(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            Referred by an SSWX Member?
          </label>
          {referred && (
            <Field label="Their referral code">
              <input
                name="referral"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                className={input}
              />
            </Field>
          )}
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Choose a 4-digit PIN">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            autoComplete="new-password"
            className={input}
          />
        </Field>
        <Field label="Repeat PIN">
          <input
            name="pin2"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            required
            autoComplete="new-password"
            className={input}
          />
        </Field>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Create my account"}
      </Button>
    </form>
  );
}
