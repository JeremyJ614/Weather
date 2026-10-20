"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { SERVICES, SOCIALS, type Org } from "@/lib/disaster/data";
import { applyOrg, type SignupState } from "./actions";
import s from "./Disaster.module.css";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

function Text({
  name,
  label,
  optional,
  hint,
  ...rest
}: {
  name: string;
  label: string;
  optional?: boolean;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1 text-sm font-bold">
      <span>
        {label}
        {optional && (
          <small className="ml-1 font-normal text-muted">(optional)</small>
        )}
      </span>
      <input
        name={name}
        required={!optional}
        className={field}
        maxLength={300}
        {...rest}
      />
      {hint && <small className="font-normal text-muted">{hint}</small>}
    </label>
  );
}

function Chips({
  name,
  label,
  options,
  on = [],
}: {
  name: string;
  label: string;
  options: string[];
  on?: string[];
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      <div className={s.chips}>
        {options.map((o) => (
          <label key={o} className={s.chip}>
            <input
              type="checkbox"
              name={name}
              value={o}
              defaultChecked={on.includes(o)}
            />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** An organization's listing fields (the sign-up form, and admin edits). */
export function OrgFields({ org }: { org?: Partial<Org> }) {
  return (
    <>
      <Text
        name="name"
        label="Organization name"
        defaultValue={org?.name}
        maxLength={100}
      />
      <label className="grid gap-1 text-sm font-bold">
        <span>What you do</span>
        <textarea
          name="mission"
          required
          minLength={10}
          maxLength={600}
          rows={4}
          defaultValue={org?.mission}
          placeholder="Who you help, and how, after a storm or disaster"
          className="rounded-xl border border-line bg-bg px-3 py-2"
        />
      </label>
      <Chips
        name="services"
        label="What you offer"
        options={SERVICES}
        on={org?.services}
      />
      <Text
        name="areas"
        label="Areas you serve"
        defaultValue={org?.areas}
        maxLength={200}
        placeholder="For example: Oklahoma and southern Kansas"
      />
      <Text
        name="website"
        label="Website"
        inputMode="url"
        defaultValue={org?.website ?? undefined}
        placeholder="example.org"
      />
      <Text
        name="donate_url"
        label="Donation link"
        optional
        inputMode="url"
        defaultValue={org?.donate_url ?? undefined}
      />
      <Text
        name="volunteer_url"
        label="Volunteer link"
        optional
        inputMode="url"
        defaultValue={org?.volunteer_url ?? undefined}
      />
      <Text
        name="phone"
        label="Public phone"
        optional
        type="tel"
        defaultValue={org?.phone ?? undefined}
        maxLength={30}
      />
      <Text
        name="public_email"
        label="Public email"
        optional
        type="email"
        defaultValue={org?.email ?? undefined}
        maxLength={200}
      />
      <Text
        name="logo_url"
        label="Logo"
        optional
        inputMode="url"
        defaultValue={org?.logo_url ?? undefined}
        placeholder="https://… (a square image works best)"
      />
      <details className={s.more}>
        <summary>Social links (optional)</summary>
        <div className="mt-3 grid gap-3">
          {SOCIALS.map((x) => (
            <Text
              key={x.id}
              name={`social_${x.id}`}
              label={x.label}
              optional
              inputMode="url"
              defaultValue={org?.socials?.[x.id]}
              placeholder={`${x.host}/your-page`}
            />
          ))}
        </div>
      </details>
    </>
  );
}

function Contact({ prefill }: { prefill: { name: string; email: string } }) {
  return (
    <>
      <input
        name="website_confirm"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />
      <Text
        name="contact_name"
        label="Your name"
        autoComplete="name"
        defaultValue={prefill.name}
        maxLength={80}
      />
      <Text
        name="contact_email"
        label="Your email"
        type="email"
        autoComplete="email"
        defaultValue={prefill.email}
        maxLength={200}
        hint="So we can tell you when it's approved. Never shown publicly."
      />
    </>
  );
}

function Done({ state, text }: { state: SignupState; text: string }) {
  if (!state?.sent) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-[var(--lit-line)] p-4 text-accent"
    >
      {text}
    </p>
  );
}

/** List your organization: lands in the inbox for approval. */
export function OrgSignup({
  prefill,
}: {
  prefill: { name: string; email: string };
}) {
  const [state, action, pending] = useActionState(applyOrg, null);
  if (state?.sent)
    return (
      <Done
        state={state}
        text="Thanks. We'll review your organization and email you when it's listed."
      />
    );
  return (
    <form action={action} className="grid gap-3">
      <Contact prefill={prefill} />
      <OrgFields />
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sending…" : "Send for review"}
      </Button>
    </form>
  );
}
