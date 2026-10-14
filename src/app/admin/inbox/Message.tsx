"use client";

import { useState, useTransition } from "react";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import { deleteMessage, markMessage } from "./actions";

export type Msg = {
  id: string;
  form: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  read: boolean;
  created_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

/** One message: opening it marks it read; read/unread and delete. */
export function Message({ m }: { m: Msg }) {
  const [read, setRead] = useState(m.read);
  const [gone, setGone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (gone) return null;
  const mark = (v: boolean) =>
    start(async () => {
      setRead(v);
      const r = await markMessage(m.id, v);
      if (r.error) {
        setRead(!v);
        setErr(r.error);
      }
    });
  return (
    <li>
      <details
        className={`rounded-2xl border bg-surface px-4 py-3 ${read ? "border-line" : "border-[var(--lit-line)]"}`}
        onToggle={(e) => e.currentTarget.open && !read && mark(true)}
      >
        <summary className="cursor-pointer list-none">
          <span className="flex items-center gap-2">
            {!read && (
              <i
                className="size-2 rounded-full bg-accent"
                aria-label="Unread"
              />
            )}
            <b className="truncate">{m.subject || "(no subject)"}</b>
            <span className="ml-auto shrink-0 rounded-full border border-line px-2 text-[10px] tracking-wider text-muted uppercase">
              {m.form}
            </span>
          </span>
          <span className="block text-xs text-muted">
            {m.name} · {when(m.created_at)} CT
          </span>
        </summary>
        <p className="mt-3 text-sm whitespace-pre-wrap">{m.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <a
            href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "your message"}`)}`}
            className="text-accent underline"
          >
            Reply to {m.email}
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={() => mark(!read)}
            className="ml-auto flex items-center gap-1 text-muted"
          >
            {read ? (
              <Mail className="size-4" />
            ) : (
              <MailOpen className="size-4" />
            )}
            {read ? "Mark unread" : "Mark read"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              confirm("Delete this message?") &&
              start(async () => {
                const r = await deleteMessage(m.id);
                if (r.error) setErr(r.error);
                else setGone(true);
              })
            }
            className="flex items-center gap-1 text-muted"
          >
            <Trash2 className="size-4" /> Delete
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
