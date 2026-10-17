"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, Inbox, MapPin, Moon, Smartphone } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { usePlaces } from "@/features/location/usePlaces";
import { enablePush, pushState } from "@/features/notify/push";
import { TOPICS, type TopicId } from "@/lib/notify/topics";
import { saveAlerts, testPush } from "./actions";
import s from "./Notify.module.css";

export type NotifyData = {
  prefs: {
    topics: string[];
    label: string | null;
    lat: number | null;
    lon: number | null;
    quiet_from: number | null;
    quiet_to: number | null;
  } | null;
  inbox: {
    topic: string;
    key: string;
    title: string;
    body: string;
    url: string;
    pushed: boolean;
    sent_at: string;
  }[];
  brief: {
    label: string;
    send_hour: number;
    by_email: boolean;
    by_push: boolean;
  } | null;
};
type Place = { label: string; lat: number; lon: number };

const ICON: Record<TopicId, string> = {
  warnings: "Siren",
  watches: "ScanEye",
  spc: "Map",
  engines: "Gauge",
  news: "Newspaper",
  tropical: "Orbit",
  aurora: "Sparkles",
  game: "Gamepad2",
  trivia: "CircleHelp",
  polls: "Vote",
};
const GROUPS = [...new Set(TOPICS.map((t) => t.group))];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

/** The Notifications center. Every change saves at once. */
export function NotifyView({ data }: { data: NotifyData }) {
  const p = data.prefs;
  const [topics, setTopics] = useState(new Set(p?.topics ?? []));
  const [place, setPlace] = useState<Place | null>(
    p?.label && p.lat != null && p.lon != null
      ? { label: p.label, lat: p.lat, lon: p.lon }
      : null,
  );
  const [quiet, setQuiet] = useState(
    p?.quiet_from != null && p.quiet_to != null
      ? { from: p.quiet_from, to: p.quiet_to }
      : null,
  );
  const [status, setStatus] = useState("");
  const [device, setDevice] = useState<
    "on" | "off" | "blocked" | "unsupported" | null
  >(null);
  const [deviceMsg, setDeviceMsg] = useState("");
  const [busy, start] = useTransition();
  const { active } = usePlaces();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    pushState()
      .then(setDevice)
      .catch(() => setDevice("unsupported"));
  }, []);

  const save = (next: {
    topics?: Set<string>;
    place?: Place | null;
    quiet?: { from: number; to: number } | null;
  }) => {
    const t = next.topics ?? topics;
    const pl = next.place !== undefined ? next.place : place;
    const q = next.quiet !== undefined ? next.quiet : quiet;
    setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveAlerts({
        topics: [...t],
        place: pl,
        quiet: q,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
        .then((r) => setStatus(r.error ?? "Saved"))
        .catch(() => setStatus("Couldn't save. Try again."));
    }, 350);
  };
  const toggle = (id: string, on: boolean) => {
    const next = new Set(topics);
    if (on) next.add(id);
    else next.delete(id);
    // A local alert needs a place; the active one is the obvious choice.
    let pl = place;
    if (on && !pl && active && TOPICS.find((t) => t.id === id)?.local)
      pl = { label: active.label, lat: active.lat, lon: active.lon };
    setTopics(next);
    setPlace(pl);
    save({ topics: next, place: pl });
  };
  const needsPlace = TOPICS.some((t) => t.local && topics.has(t.id)) && !place;
  const differs =
    active &&
    (!place ||
      Math.abs(place.lat - active.lat) > 1e-4 ||
      Math.abs(place.lon - active.lon) > 1e-4);

  return (
    <div className="grid gap-4">
      <section className={s.card} aria-labelledby="device-h">
        <header>
          <Smartphone aria-hidden />
          <h2 id="device-h">This device</h2>
          <small role="status">{status}</small>
        </header>
        {device === "on" ? (
          <div className={s.row}>
            <p>Alerts you turn on arrive here as notifications.</p>
            <button
              type="button"
              className={s.btn}
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await testPush();
                  setDeviceMsg(
                    r.error ??
                      `Sent to ${r.sent} device${r.sent === 1 ? "" : "s"}.`,
                  );
                })
              }
            >
              <BellRing aria-hidden /> Send a test
            </button>
          </div>
        ) : device === "unsupported" ? (
          <p className={s.muted}>
            This browser can&apos;t receive notifications. On iPhone, add
            StormSync to your Home Screen, then open it from there.
          </p>
        ) : device === "blocked" ? (
          <p className={s.muted}>
            Notifications are blocked for this site in your browser settings.
            Allow them there, then come back.
          </p>
        ) : device === "off" ? (
          <div className={s.row}>
            <p>
              Turn them on here to get alerts on this device. Your choices below
              apply to every device you turn on.
            </p>
            <button
              type="button"
              className={s.btn}
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const err = await enablePush();
                  setDeviceMsg(err ?? "");
                  if (!err) setDevice("on");
                })
              }
            >
              <BellRing aria-hidden /> Turn on
            </button>
          </div>
        ) : (
          <p className={s.muted}>Checking this device…</p>
        )}
        {deviceMsg && (
          <p className={s.note} role="status">
            {deviceMsg}
          </p>
        )}
      </section>

      <section className={s.card} aria-labelledby="place-h">
        <header>
          <MapPin aria-hidden />
          <h2 id="place-h">Where local alerts are for</h2>
        </header>
        <div className={s.row}>
          <p>
            {place ? (
              <b>{place.label}</b>
            ) : (
              <span className={needsPlace ? s.warn : undefined}>
                No place yet. Warnings, watches, SPC and aurora alerts need one.
              </span>
            )}
          </p>
          {differs && (
            <button
              type="button"
              className={s.btn}
              onClick={() => {
                const pl = {
                  label: active.label,
                  lat: active.lat,
                  lon: active.lon,
                };
                setPlace(pl);
                save({ place: pl });
              }}
            >
              Use {active.label}
            </button>
          )}
        </div>
        {!active && !place && (
          <p className={s.muted}>
            Save a place in <Link href="/profile">My Profile</Link> or on the
            dashboard first.
          </p>
        )}
      </section>

      {GROUPS.map((g) => (
        <section key={g} className={s.card} aria-label={g}>
          <p className={s.group}>{g}</p>
          {TOPICS.filter((t) => t.group === g).map((t) => (
            <label key={t.id} className={s.topic}>
              <span className={s.icon} aria-hidden>
                <NavIcon name={ICON[t.id]} className="size-4" />
              </span>
              <span>
                <b>{t.label}</b>
                <small>{t.note}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className={s.switch}
                checked={topics.has(t.id)}
                onChange={(e) => toggle(t.id, e.target.checked)}
              />
            </label>
          ))}
          {g === "StormSync" && (
            <div className={s.topic}>
              <span className={s.icon} aria-hidden>
                <NavIcon name="Mail" className="size-4" />
              </span>
              <span>
                <b>Daily Brief</b>
                <small>
                  {data.brief && (data.brief.by_push || data.brief.by_email)
                    ? `On at ${hourLabel(data.brief.send_hour)} for ${data.brief.label}, by ${[data.brief.by_push && "notification", data.brief.by_email && "email"].filter(Boolean).join(" and ")}.`
                    : "Off. A morning summary for your place, set up on its own page."}
                </small>
              </span>
              <Link href="/daily-brief#settings" className={s.btn}>
                {data.brief ? "Change" : "Set up"}
              </Link>
            </div>
          )}
        </section>
      ))}

      <section className={s.card} aria-labelledby="quiet-h">
        <label className={s.topic}>
          <span className={s.icon} aria-hidden>
            <Moon className="size-4" />
          </span>
          <span>
            <b id="quiet-h">Quiet hours</b>
            <small>
              Holds everything but warnings and watches until quiet hours end.
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={s.switch}
            checked={Boolean(quiet)}
            onChange={(e) => {
              const q = e.target.checked ? { from: 22, to: 7 } : null;
              setQuiet(q);
              save({ quiet: q });
            }}
          />
        </label>
        {quiet && (
          <div className={s.hours}>
            {(["from", "to"] as const).map((k) => (
              <label key={k}>
                <small>{k === "from" ? "From" : "Until"}</small>
                <select
                  value={quiet[k]}
                  onChange={(e) => {
                    const q = { ...quiet, [k]: Number(e.target.value) };
                    setQuiet(q);
                    save({ quiet: q });
                  }}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {hourLabel(h)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className={s.card} aria-labelledby="inbox-h">
        <header>
          <Inbox aria-hidden />
          <h2 id="inbox-h">Recent alerts</h2>
          <small>Last 30 days</small>
        </header>
        {data.inbox.length ? (
          <ul className={s.inbox}>
            {data.inbox.map((n) => (
              <li key={`${n.topic}${n.key}`}>
                <Link href={n.url}>
                  <span className={s.icon} aria-hidden>
                    <NavIcon
                      name={ICON[n.topic as TopicId] ?? "Bell"}
                      className="size-4"
                    />
                  </span>
                  <span>
                    <b>{n.title}</b>
                    <small>{n.body}</small>
                  </span>
                  <time dateTime={n.sent_at}>{ago(n.sent_at)}</time>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.muted}>
            Nothing yet. Alerts you turn on show up here as well as on your
            devices.
          </p>
        )}
      </section>
    </div>
  );
}
