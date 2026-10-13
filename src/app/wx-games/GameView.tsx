"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Crown,
  Lock,
  MapPin,
  Medal,
  Timer,
  Tornado,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { AwardBadge } from "@/components/ui/award-badge";
import { HomeTabs } from "@/features/news/HomeTabs";
import { UsMap } from "@/features/maps/UsMap";
import { Polys, useLayer } from "@/features/maps/useLayer";
import { project, unproject } from "@/lib/map/usAlbers";
import {
  haversineMi,
  QUIET_DAY_BONUS,
  SEVERE_CONSOLATION,
  SEVERE_PLACES,
  TORNADO_BULLSEYE,
  TORNADO_PLACES,
  LOCK_HOUR_ET,
} from "@/lib/game/score";
import { lockGuess } from "./actions";
import { CITIES } from "./cities";
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
export type Board = {
  user_id: string;
  name: string;
  points: number;
  games: number;
}[];
type Pin = { lat: number; lon: number; label: string };

const near = (lat: number, lon: number) => {
  const c = CITIES.reduce((a, b) =>
    haversineMi(lat, lon, b.lat, b.lon) < haversineMi(lat, lon, a.lat, a.lon)
      ? b
      : a,
  );
  const d = Math.round(haversineMi(lat, lon, c.lat, c.lon));
  return d < 15 ? c.name : `${d} mi from ${c.name}`;
};
const ord = (n: number) => {
  const v = n % 100;
  return (
    n +
    (["th", "st", "nd", "rd"][(v - 20) % 10] ??
      ["th", "st", "nd", "rd"][v] ??
      "th")
  );
};

/** Time left until the noon Eastern lock, or null once closed. */
function useLockClock() {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const p = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hourCycle: "h23",
      }).formatToParts(new Date());
      const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
      const sec =
        LOCK_HOUR_ET * 3600 -
        (g("hour") * 3600 + g("minute") * 60 + g("second"));
      setLeft(sec > 0 ? sec : 0);
    };
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
      <circle r="22" className={s.pinPulse} />
      <circle r="11" className={s.pinRing} />
      <circle r="5" className={s.pinDot} />
    </g>
  );
}

function Podium({ board }: { board: Board }) {
  if (!board.length)
    return (
      <p className={s.empty}>
        No scored rounds yet in this period. Be the first on the board.
      </p>
    );
  const top = board.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  return (
    <div className="grid gap-3">
      <div className={s.podium}>
        {order.map((r, i) =>
          r ? (
            <div
              key={r.user_id}
              className={`${s.step} ${[s.silver, s.gold, s.bronze][i]}`}
            >
              {i === 1 ? <Crown aria-hidden /> : <Medal aria-hidden />}
              <b>{r.name}</b>
              <span>{r.points.toLocaleString()}</span>
              <i />
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      <ol className={s.board}>
        {board.slice(3, 20).map((r, i) => (
          <li key={r.user_id}>
            <span className={s.rank}>{ord(i + 4)}</span>
            <span className={s.who}>{r.name}</span>
            <span className={s.games}>{r.games} rounds</span>
            <b>{r.points.toLocaleString()}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GameView({
  signedIn,
  today,
  mine,
  last,
  month,
  week,
  champions,
}: {
  signedIn: boolean;
  today: string;
  mine: Guess | null;
  last: Guess | null;
  month: Board;
  week: Board;
  champions: { month: string; name: string; points: number }[];
}) {
  const { layer, status } = useLayer("spc1");
  const left = useLockClock();
  const [mode, setMode] = useState<"severe" | "tornado">("severe");
  const [severe, setSevere] = useState<Pin | null>(null);
  const [tornado, setTornado] = useState<Pin | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [state, action, pending] = useActionState(lockGuess, null);
  const locked = !!mine || !!state?.ok;
  const open = left === null || left > 0;

  const shownSevere: Pin | null = mine
    ? { lat: mine.lat, lon: mine.lon, label: mine.city_label ?? "" }
    : severe;
  const shownTornado: Pin | null = mine
    ? mine.tor_lat !== null && mine.tor_lon !== null
      ? {
          lat: mine.tor_lat,
          lon: mine.tor_lon,
          label: mine.tor_city_label ?? "",
        }
      : null
    : quiet
      ? null
      : tornado;

  const place = (lat: number, lon: number) => {
    if (locked || !open) return;
    const pin = { lat, lon, label: near(lat, lon) };
    if (mode === "severe") {
      setSevere(pin);
      if (!tornado && !quiet) setMode("tornado");
    } else {
      setTornado(pin);
      setQuiet(false);
    }
  };
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
        </div>
        {locked ? (
          <span className={s.lockedTag}>
            <CheckCircle2 aria-hidden /> Locked in
          </span>
        ) : open ? (
          <div className={s.clock} aria-label="Time until pins lock">
            <Timer aria-hidden />
            <b>
              {hh}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
            </b>
            <span>until noon ET lock</span>
          </div>
        ) : (
          <span className={s.closedTag}>
            <Lock aria-hidden /> Closed · scored tomorrow morning
          </span>
        )}
      </section>

      {!signedIn ? (
        <section className={s.signin}>
          <p>Sign in to drop your pins and climb the board.</p>
          <Link href="/login?next=/wx-games">
            <Button variant="primary">Sign in to play</Button>
          </Link>
        </section>
      ) : (
        !locked &&
        open && (
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
              <Tornado className="mr-1 inline size-3.5" aria-hidden /> Tornado
              pin
            </Chip>
            <Chip
              pressed={quiet}
              onClick={() => {
                setQuiet(!quiet);
                setTornado(null);
              }}
            >
              No tornadoes today
            </Chip>
          </div>
        )
      )}

      <UsMap
        title="SPC Day 1 outlook"
        sub={layer?.valid}
        legend={layer?.legend ?? []}
        status={status === "empty" ? "ready" : status}
        file={`sswx-game-${today}`}
        actions={false}
        onTap={
          signedIn && !locked && open
            ? (x, y) => {
                const { lat, lon } = unproject(x, y);
                place(lat, lon);
              }
            : undefined
        }
        overlay={
          <>
            {shownSevere && <PinMark pin={shownSevere} kind="severe" />}
            {shownTornado && <PinMark pin={shownTornado} kind="tornado" />}
          </>
        }
      >
        {layer && <Polys polys={layer.polys} />}
      </UsMap>

      {signedIn && !locked && open && (
        <label className={s.pick}>
          <span>
            Or pick a city for the{" "}
            {mode === "severe" && !quiet ? "severe" : "tornado"} pin
          </span>
          <select
            value=""
            onChange={(e) => {
              const c = CITIES.find((x) => x.name === e.target.value);
              if (c) place(c.lat, c.lon);
            }}
          >
            <option value="">Choose a city…</option>
            {CITIES.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className={s.pins}>
        <article className={`${s.pinCard} ${s.cardS}`}>
          <Zap aria-hidden />
          <div>
            <p>Severe pin</p>
            <b>{shownSevere?.label || "Tap the map"}</b>
          </div>
        </article>
        <article className={`${s.pinCard} ${s.cardT}`}>
          <Tornado aria-hidden />
          <div>
            <p>Tornado pin</p>
            <b>
              {shownTornado?.label ||
                ((mine && mine.tor_lat === null) || quiet
                  ? "Quiet day called"
                  : "Tap the map")}
            </b>
          </div>
        </article>
      </div>

      {signedIn && !locked && open && (
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
            disabled={pending || !severe || (!tornado && !quiet)}
          >
            <Lock className="size-4" aria-hidden />{" "}
            {pending ? "Locking…" : "Lock my pins"}
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
              {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              },
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
    </div>
  );

  const boards = signedIn ? (
    <div className="grid gap-4">
      <HomeTabs
        variant="segment"
        label="Leaderboard period"
        tabs={[
          { id: "month", label: "This month", panel: <Podium board={month} /> },
          { id: "week", label: "This week", panel: <Podium board={week} /> },
        ]}
      />
      {champions.length > 0 && (
        <section className={s.hall}>
          <p className="eyebrow">Hall of champions</p>
          <div className={s.badges}>
            {champions.map((c) => (
              <div key={c.month} className={s.badgeRow}>
                <AwardBadge
                  kicker="Forecast Game"
                  title={`${new Date(`${c.month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })} Champion`}
                />
                <span>
                  {c.name} · {c.points.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  ) : (
    <p className={s.empty}>Sign in to see the leaderboard.</p>
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
        One round per day on the Eastern clock. Pins lock at noon ET and are
        scored the next morning against SPC&apos;s storm reports for the
        convective day (12Z to 12Z). The month&apos;s top scorer is crowned on
        the 1st.
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
          id: "board",
          label: "Leaderboard",
          icon: <Trophy aria-hidden />,
          panel: boards,
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
