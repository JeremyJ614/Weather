"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  MapPin,
  Medal,
  Save,
  Timer,
  Tornado,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { project, unproject } from "@/lib/map/usAlbers";
import { PlaceSearch } from "@/features/location/PlaceSearch";
import {
  QUIET_DAY_BONUS,
  SEVERE_CONSOLATION,
  SEVERE_PLACES,
  TORNADO_BULLSEYE,
  TORNADO_PLACES,
  secondsToReset,
} from "@/lib/game/score";
import { savePins, type SaveState } from "./actions";
import s from "./Game.module.css";

export type Guess = {
  guess_date: string;
  lat: number;
  lon: number;
  city_label: string | null;
  tor_lat: number | null;
  tor_lon: number | null;
  tor_city_label: string | null;
  severe_points: number | null;
  tornado_points: number | null;
  points: number | null;
};
type Pin = { lat: number; lon: number; label: string };

/** "8 mi from Wichita Falls, TX", from our Census place index. */
async function labelFor(lat: number, lon: number) {
  try {
    const r = await fetch(
      `/api/geo/near?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`,
    );
    const { label } = (await r.json()) as { label: string | null };
    return label ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  } catch {
    return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  }
}
const ord = (n: number) => {
  const v = n % 100;
  return (
    n +
    (["th", "st", "nd", "rd"][(v - 20) % 10] ??
      ["th", "st", "nd", "rd"][v] ??
      "th")
  );
};

/** Seconds until the next round (midnight Eastern), ticking. */
function useResetClock() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(secondsToReset());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

function PinMark({ pin, kind }: { pin: Pin; kind: "severe" | "tornado" }) {
  const { x, y } = project(pin.lon, pin.lat);
  return (
    <g
      transform={`translate(${x} ${y})`}
      className={kind === "severe" ? s.pinS : s.pinT}
    >
      <g className={s.pinScale}>
        <circle r="22" className={s.pinPulse} />
        <circle r="11" className={s.pinRing} />
        <circle r="5" className={s.pinDot} />
      </g>
    </g>
  );
}

export function GameView({
  signedIn,
  today,
  mine,
  last,
}: {
  signedIn: boolean;
  today: string;
  mine: Guess | null;
  last: Guess | null;
}) {
  const { layer, status } = useLayer("spc1");
  const left = useResetClock();
  const [mode, setMode] = useState<"severe" | "tornado">("severe");
  const [severe, setSevere] = useState<Pin | null>(() =>
    mine
      ? { lat: mine.lat, lon: mine.lon, label: mine.city_label ?? "" }
      : null,
  );
  const [tornado, setTornado] = useState<Pin | null>(() =>
    mine && mine.tor_lat !== null && mine.tor_lon !== null
      ? {
          lat: mine.tor_lat,
          lon: mine.tor_lon,
          label: mine.tor_city_label ?? "",
        }
      : null,
  );
  const [quiet, setQuiet] = useState(!!mine && mine.tor_lat === null);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: SaveState, fd: FormData) => {
      const r = await savePins(prev, fd);
      if (r?.ok) setDirty(false);
      return r;
    },
    null,
  );
  const saved = (!!mine || !!state?.ok) && !dirty;
  const canPlay = signedIn;

  const place = (lat: number, lon: number, label?: string) => {
    if (!canPlay) return;
    const pin = { lat, lon, label: label ?? "Locating…" };
    const which = quiet ? "severe" : mode;
    const set = which === "severe" ? setSevere : setTornado;
    set(pin);
    setDirty(true);
    if (which === "severe") {
      if (!tornado && !quiet) setMode("tornado");
    } else setQuiet(false);
    if (!label)
      labelFor(lat, lon).then((l) =>
        set((p) =>
          p && p.lat === lat && p.lon === lon ? { ...p, label: l } : p,
        ),
      );
  };
  const shownTornado = quiet ? null : tornado;
  const hh = left !== null ? Math.floor(left / 3600) : 0;
  const mm = left !== null ? Math.floor((left % 3600) / 60) : 0;
  const ss = left !== null ? left % 60 : 0;
  const dayLabel = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const play = (
    <div className="grid gap-4">
      <section className={s.status}>
        <div>
          <p className="eyebrow">Today&apos;s round</p>
          <p className={s.day}>{dayLabel}</p>
          {saved && (
            <span className={s.savedTag}>
              <CheckCircle2 aria-hidden /> Pins saved
            </span>
          )}
        </div>
        <div className={s.clock} aria-label="Time until the next round">
          <Timer aria-hidden />
          <b>
            {hh}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </b>
          <span>until the next round</span>
        </div>
      </section>

      {!signedIn ? (
        <section className={s.signin}>
          <p>Sign in to drop your pins and climb the board.</p>
          <Link href="/login?next=/wx-games">
            <Button variant="primary">Sign in to play</Button>
          </Link>
        </section>
      ) : (
        <div className={s.modes} role="group" aria-label="Which pin to place">
          <Chip pressed={mode === "severe"} onClick={() => setMode("severe")}>
            <Zap className="mr-1 inline size-3.5" aria-hidden /> Severe pin
          </Chip>
          <Chip
            pressed={mode === "tornado" && !quiet}
            onClick={() => {
              setMode("tornado");
              setQuiet(false);
            }}
          >
            <Tornado className="mr-1 inline size-3.5" aria-hidden /> Tornado pin
          </Chip>
          <Chip
            pressed={quiet}
            onClick={() => {
              setQuiet(!quiet);
              setDirty(true);
              if (!quiet) setMode("severe");
            }}
          >
            No tornadoes today
          </Chip>
        </div>
      )}

      {canPlay && (
        <div className={s.pick}>
          <span>
            Search a city for the{" "}
            {mode === "severe" || quiet ? "severe" : "tornado"} pin
          </span>
          <PlaceSearch
            placeholder="City or state"
            onPick={(p) => place(p.lat, p.lon, p.label)}
          />
        </div>
      )}

      <UsMap
        title="SPC Day 1 outlook"
        sub={layer?.valid}
        legend={layer?.legend ?? []}
        status={status === "empty" ? "ready" : status}
        file={`sswx-game-${today}`}
        actions={false}
        zoomable
        onTap={
          canPlay
            ? (x, y) => {
                const { lat, lon } = unproject(x, y);
                if (lat >= 18 && lat <= 72 && lon >= -180 && lon <= -60)
                  place(lat, lon);
              }
            : undefined
        }
        overlay={
          <>
            {severe && <PinMark pin={severe} kind="severe" />}
            {shownTornado && <PinMark pin={shownTornado} kind="tornado" />}
          </>
        }
      >
        {layer && <Polys polys={layer.polys} />}
      </UsMap>

      <div className={s.pins}>
        <article className={`${s.pinCard} ${s.cardS}`}>
          <Zap aria-hidden />
          <div>
            <p>Severe pin</p>
            <b>{severe?.label || "Tap the map"}</b>
          </div>
        </article>
        <article className={`${s.pinCard} ${s.cardT}`}>
          <Tornado aria-hidden />
          <div>
            <p>Tornado pin</p>
            <b>
              {quiet
                ? "Quiet day called"
                : shownTornado?.label || "Tap the map"}
            </b>
          </div>
        </article>
      </div>

      {canPlay && (
        <form action={action} className="grid gap-2">
          {severe && (
            <>
              <input type="hidden" name="lat" value={severe.lat} />
              <input type="hidden" name="lon" value={severe.lon} />
              <input type="hidden" name="label" value={severe.label} />
            </>
          )}
          {tornado && !quiet && (
            <>
              <input type="hidden" name="tlat" value={tornado.lat} />
              <input type="hidden" name="tlon" value={tornado.lon} />
              <input type="hidden" name="tlabel" value={tornado.label} />
            </>
          )}
          {quiet && <input type="hidden" name="quiet" value="on" />}
          <Button
            type="submit"
            variant="primary"
            disabled={pending || saved || !severe || (!tornado && !quiet)}
          >
            <Save className="size-4" aria-hidden />{" "}
            {pending
              ? "Saving…"
              : saved
                ? "Saved · move a pin to change it"
                : mine || state?.ok
                  ? "Update my pins"
                  : "Save my pins"}
          </Button>
          {state?.error && <p className={s.err}>{state.error}</p>}
        </form>
      )}

      {last && last.points !== null && (
        <section className={s.result}>
          <p className="eyebrow">
            Last round ·{" "}
            {new Date(`${last.guess_date}T12:00:00Z`).toLocaleDateString(
              "en-US",
              { month: "short", day: "numeric", timeZone: "UTC" },
            )}
          </p>
          <div className={s.resultRow}>
            <div>
              <Zap aria-hidden />
              <b>{last.severe_points}</b>
              <span>Severe</span>
            </div>
            <div>
              <Tornado aria-hidden />
              <b>{last.tornado_points}</b>
              <span>Tornado</span>
            </div>
            <div className={s.total}>
              <Trophy aria-hidden />
              <b>{last.points}</b>
              <span>Points</span>
            </div>
          </div>
        </section>
      )}
      <Link href="/leaderboard" className={s.boardLink}>
        <Trophy aria-hidden /> Standings &amp; Champions Hall
      </Link>
    </div>
  );

  const rules = (
    <div className="grid gap-3">
      <section className={s.rule}>
        <h3>
          <Zap aria-hidden /> Severe pin
        </h3>
        <p>
          Ranked on distance to the nearest storm report of any kind. The five
          closest pins place:
        </p>
        <ul>
          {SEVERE_PLACES.map((p, i) => (
            <li key={i}>
              <span>{ord(i + 1)} closest</span>
              <b>{p}</b>
            </li>
          ))}
          {SEVERE_CONSOLATION.map(([w, p]) => (
            <li key={w}>
              <span>Anyone else within {w} mi</span>
              <b>{p}</b>
            </li>
          ))}
        </ul>
      </section>
      <section className={s.rule}>
        <h3>
          <Tornado aria-hidden /> Tornado pin
        </h3>
        <p>
          Ranked on distance to the nearest tornado report, at any distance:
        </p>
        <ul>
          {TORNADO_PLACES.map((p, i) => (
            <li key={i}>
              <span>{ord(i + 1)} closest</span>
              <b>{p}</b>
            </li>
          ))}
          <li>
            <span>
              Bullseye: within {TORNADO_BULLSEYE.within} mi of a tornado
            </span>
            <b>{TORNADO_BULLSEYE.points}</b>
          </li>
          <li>
            <span>&ldquo;No tornadoes&rdquo; on a day with none</span>
            <b>{QUIET_DAY_BONUS}</b>
          </li>
        </ul>
      </section>
      <p className={s.fine}>
        One round per day on the Eastern clock. Move your pins as often as you
        like until midnight ET; whatever is on the map then is your call. Rounds
        are scored the next morning against SPC&apos;s storm reports for the
        convective day (12Z to 12Z). The month&apos;s and the year&apos;s top
        scorers are crowned in the Champions Hall.
      </p>
    </div>
  );

  return (
    <HomeTabs
      variant="segment"
      label="Forecast Game"
      tabs={[
        {
          id: "play",
          label: "Play",
          icon: <MapPin aria-hidden />,
          panel: play,
        },
        {
          id: "rules",
          label: "Rules",
          icon: <Medal aria-hidden />,
          panel: rules,
        },
      ]}
    />
  );
}
