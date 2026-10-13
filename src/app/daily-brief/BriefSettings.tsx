"use client";

import { Bell, Mail, MessageSquare } from "lucide-react";
import st from "./BriefSettings.module.css";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { usePlaces } from "@/features/location/usePlaces";
import { saveBrief, stopBrief, type BriefState } from "./actions";

type Sub = {
  label: string;
  send_hour: number;
  by_email: boolean;
  by_push: boolean;
  by_text: boolean;
} | null;

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  h,
  label: `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`,
}));

async function enablePush(): Promise<string | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "This browser can't receive notifications. On iPhone, add StormSync to your Home Screen first.";
  }
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Notifications aren't set up yet.";
  if ((await Notification.requestPermission()) !== "granted")
    return "Notifications are blocked in your browser settings.";
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 5000)),
  ]);
  if (!reg)
    return "Notifications need the installed app or a reload. Try again in a moment.";
  const raw = atob(
    key.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (key.length % 4)) % 4),
  );
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
  });
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub),
  });
  return res.ok ? null : "Couldn't turn on notifications. Try again.";
}

export function BriefSettings({
  signedIn,
  sub,
  hasPhone,
  timeZone,
}: {
  signedIn: boolean;
  sub: Sub;
  hasPhone: boolean;
  timeZone: string | null;
}) {
  const { active } = usePlaces();
  const [state, action, pending] = useActionState(saveBrief, null);
  const [stopState, stop, stopping] = useActionState<BriefState>(
    stopBrief,
    null,
  );
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <p className="text-sm text-muted">
        <Link
          href="/login?next=/daily-brief"
          className="font-bold text-accent underline"
        >
          Sign in
        </Link>{" "}
        to get this brief every morning by email, notification or text.
      </p>
    );
  }
  const place = active
    ? { label: active.label, lat: active.lat, lon: active.lon }
    : null;
  return (
    <form
      action={async (fd) => {
        if (fd.get("push") === "on" && !sub?.by_push) {
          const err = await enablePush();
          setPushMsg(err);
          if (err) fd.delete("push");
        }
        return action(fd);
      }}
      className="grid gap-3"
    >
      {place && (
        <>
          <input type="hidden" name="label" value={place.label} />
          <input type="hidden" name="lat" value={place.lat} />
          <input type="hidden" name="lon" value={place.lon} />
        </>
      )}
      <input type="hidden" name="tz" value={timeZone ?? ""} />
      <p className="text-sm text-muted">
        For{" "}
        <b className="text-text">
          {place?.label ?? sub?.label ?? "your place"}
        </b>
        {sub && place && sub.label !== place.label
          ? ` (currently ${sub.label})`
          : ""}
      </p>
      <label className={st.time}>
        Send it at
        <select
          name="hour"
          defaultValue={sub?.send_hour ?? 6}
          className={st.select}
        >
          {HOURS.map((x) => (
            <option key={x.h} value={x.h}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ["email", "Email", sub?.by_email ?? true],
          ["push", "Phone notification", sub?.by_push ?? false],
          [
            "text",
            hasPhone
              ? "Text message (sent by the StormSync team)"
              : "Text message (add a phone number to your profile)",
            sub?.by_text ?? false,
          ],
        ] as const
      ).map(([name, label, on]) => {
        const Icon =
          name === "email" ? Mail : name === "push" ? Bell : MessageSquare;
        return (
          <label key={name} className={st.channel}>
            <Icon aria-hidden />
            <span>{label}</span>
            <input
              type="checkbox"
              name={name}
              defaultChecked={on}
              disabled={name === "text" && !hasPhone}
              className={st.switch}
            />
          </label>
        );
      })}
      {(pushMsg || state || stopState) && (
        <p role="status" className="text-sm text-accent">
          {pushMsg ??
            state?.error ??
            state?.saved ??
            stopState?.error ??
            stopState?.saved}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !place || !timeZone}
          className="flex-1"
        >
          {pending
            ? "Saving…"
            : sub
              ? "Update delivery"
              : "Start my daily brief"}
        </Button>
        {sub && (
          <Button
            type="submit"
            formAction={stop}
            formNoValidate
            variant="ghost"
            disabled={stopping}
          >
            Stop
          </Button>
        )}
      </div>
    </form>
  );
}
