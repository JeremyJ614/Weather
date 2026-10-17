"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { sendNotice } from "./actions";

const field = "min-h-11 w-full rounded-xl border border-line bg-bg px-3";

export function NoticeForm({
  members,
}: {
  members: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(sendNotice, null);
  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <select
          name="to"
          className={field}
          aria-label="Send to"
          defaultValue=""
        >
          <option value="">Every member</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          name="level"
          className={field}
          aria-label="Level"
          defaultValue="info"
        >
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="alert">Alert</option>
        </select>
      </div>
      <input
        name="title"
        required
        maxLength={80}
        placeholder="Title"
        aria-label="Title"
        className={field}
      />
      <textarea
        name="body"
        maxLength={400}
        rows={3}
        placeholder="Message (optional)"
        aria-label="Message"
        className="rounded-xl border border-line bg-bg px-3 py-2"
      />
      <p className="text-xs text-muted">
        Members who turned on SSWX News in Notifications also get it on their
        phones within 10 minutes.
      </p>
      {state && (
        <p role="status" className="text-sm text-accent">
          {state.error ?? state.ok}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Sending…" : "Send notification"}
      </Button>
    </form>
  );
}
