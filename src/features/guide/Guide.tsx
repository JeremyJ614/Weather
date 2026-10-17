"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { savePrefs } from "@/features/account/PrefsSync";
import { MENU_NAMES, OFFERED, pickMenus } from "@/features/menus/catalog";
import { KEYS } from "@/lib/prefs-keys";
import { ALL_PAGES, MAIN_NAV, visibleNav } from "@/lib/nav/registry";
import s from "./Guide.module.css";

export type Mode = "tour" | "showcase";
export type GuideProps = {
  mode: Mode;
  name: string | null;
  menus: { main: string; second: string };
  onDone: () => void;
};
type Step = {
  icon: string;
  kicker: string;
  title: string;
  body: string;
  chips?: string[];
  end?: "menus" | "cta";
};

/** How to use each section of the main menu (by group id). */
const HOW: Record<string, string> = {
  home: "Your start screen: the Weather Clock, conditions where you are, Weather News and today's highlights. Tap the logo any time to come back.",
  local:
    "Everything here follows your active place. Save up to five places in My Profile and switch between them on the dashboard.",
  community:
    "Play the daily forecast game and trivia, vote in the weekly poll and climb the leaderboard. Points earn badges and titles.",
  severe:
    "Outlooks, warnings and discussions from SPC, the NWS and NHC, plus our own SSWXCon score and storm timing. Tap a map to zoom; most maps download as a picture.",
  tools:
    "Radar loops and model runs drawn from NOAA's own data. Pick a model, a run and a field, then press play. River gauges and 3D soundings live here too.",
  specialty:
    "Sky conditions for star gazing, the moon and planets, aurora chances and live lightning.",
  edu: "Records and climatology for your area, a weather glossary and a free library of lessons.",
  else: "Weather patterns and the rest. A page that is still being built says so plainly.",
  account:
    "Your profile, badges and places; Account Settings for menus, themes and this intro; notifications and your plan.",
};

const page = (slug: string) => ALL_PAGES.find((p) => p.slug === slug);

/** The guest showcase: an advert for what's inside, not a how-to. */
const SHOWCASE: Step[] = [
  {
    icon: "Tornado",
    kicker: "StormSync Weather",
    title: "Every storm. One app.",
    body: "Severe weather, forecasts and storm chasing tools from StormSync Media, live from NOAA, the NWS, SPC and NHC, made for your phone.",
  },
  {
    icon: "CloudLightning",
    kicker: "Severe weather",
    title: "Know what's coming",
    body: "SPC outlooks and probabilities, our SSWXCon threat score, live warnings, mesoscale discussions and storm timing for your town.",
    chips: [
      "sswxcon",
      "warnings-reports",
      "spc-probability",
      "mesoscale-discussions",
      "storm-timing-index",
    ],
  },
  {
    icon: "Radar",
    kicker: "Radar & models",
    title: "Rendered live from NOAA",
    body: "Radar loops and HRRR, GFS and HREF model maps drawn straight from NOAA's data, plus 3D soundings and river gauges.",
    chips: ["radar-model-runs", "3d-soundings", "river-flood-gauges"],
  },
  {
    icon: "Orbit",
    kicker: "Every hazard",
    title: "Tropics to blizzards",
    body: "Hurricane tracks and a model battle royale, flooding, fire weather, drought and a full winter center.",
    chips: [
      "tropical-outlook",
      "flooding-outlook",
      "fire-weather",
      "winter-center",
      "hazards-droughts",
    ],
  },
  {
    icon: "Car",
    kicker: "Storm chasing",
    title: "Chase smarter",
    body: "A chasing outlook that picks targets and timing from the models, the ingredients behind them and the history of any place.",
    chips: [
      "storm-chasing-outlook",
      "atmospheric-ingredients",
      "severe-weather-history",
    ],
  },
  {
    icon: "MapPin",
    kicker: "Made for you",
    title: "Your places, your forecast",
    body: "Save up to five places for a personal dashboard and daily brief, with air quality, pollen, mosquitoes and daylight.",
    chips: [
      "dashboard",
      "daily-brief",
      "aqi-pollen",
      "mosquito-index",
      "daylight-tracker",
    ],
  },
  {
    icon: "Telescope",
    kicker: "Night sky",
    title: "Look up",
    body: "Star gazing forecasts, aurora chances, live lightning and the moon and planets.",
    chips: [
      "star-gazing",
      "aurora-center",
      "lightning-monitoring",
      "astronomy",
    ],
  },
  {
    icon: "Gamepad2",
    kicker: "Play & learn",
    title: "Play, learn, earn",
    body: "A daily forecast game and trivia, weekly polls, leaderboards and badges, plus climatology, a glossary and a free library.",
    chips: ["wx-games", "leaderboard", "weekly-polls", "free-content-library"],
  },
  {
    icon: "Sparkles",
    kicker: "Join free",
    title: "Start free today",
    body: "The free plan opens the dashboard, radar & models, SPC, games and more. Upgrade or add pages any time.",
    end: "cta",
  },
];

function tourSteps(name: string | null): Step[] {
  const groups = visibleNav(MAIN_NAV, false, true, false);
  return [
    {
      icon: "Sparkles",
      kicker: "Welcome",
      title: name ? `Welcome, ${name}` : "Welcome aboard",
      body: "Here's a quick tour of everything in StormSync Weather and how to use it. Skip any time; replay it from Account Settings.",
    },
    ...groups.map((g) => ({
      icon: g.icon,
      kicker: "Main menu",
      title: g.label,
      body: HOW[g.id] ?? "",
      chips: g.pages.map((p) => p.slug),
    })),
    {
      icon: "Menu",
      kicker: "Last step",
      title: "Pick your menus",
      body: "Your main menu holds every page; the second menu is a quick launcher. Choose a style for each, or keep ours. Change them any time in Account Settings.",
      end: "menus",
    },
  ];
}

const DWELL = 5200;

/** The member tour or the guest showcase: full-screen, skippable, story-style steps. */
export function Guide({ mode, name, menus, onDone }: GuideProps) {
  const steps = mode === "tour" ? tourSteps(name) : SHOWCASE;
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(false);
  const [pick, setPick] = useState(menus);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => {
    let saved: { main?: string; second?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEYS.menus) || "{}");
    } catch {}
    queueMicrotask(() => setPick(pickMenus(saved, menus)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    next.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menus]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      if (e.key === "ArrowRight")
        setI((k) => Math.min(steps.length - 1, k + 1));
      if (e.key === "ArrowLeft") setI((k) => Math.max(0, k - 1));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onDone, steps.length]);

  const finish = (save: boolean) => {
    if (save) savePrefs({ menus: pick }, false);
    onDone();
  };
  const auto = mode === "showcase" && !last;

  return (
    <div
      className={s.shade}
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "tour"
          ? "Tour of StormSync Weather"
          : "What's inside StormSync Weather"
      }
      onPointerDown={() => auto && setHeld(true)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
    >
      <div className={s.sheet}>
        <div className={s.bars} aria-hidden>
          {steps.map((_, k) => (
            <span key={k}>
              <i
                data-state={
                  k < i ? "done" : k === i ? (auto ? "run" : "done") : "todo"
                }
                data-held={held || undefined}
                style={{ animationDuration: `${DWELL}ms` }}
                onAnimationEnd={() => k === i && setI(i + 1)}
              />
            </span>
          ))}
        </div>
        <button
          type="button"
          className={s.skip}
          onClick={onDone}
          aria-label={mode === "tour" ? "Skip the tour" : "Skip"}
        >
          Skip <X aria-hidden />
        </button>

        <div key={i} className={s.body}>
          <div className={s.art} aria-hidden>
            <span className={s.orbit}>
              <i />
              <i />
              <i />
            </span>
            <span className={s.core}>
              <NavIcon name={step.icon} className="size-9" />
            </span>
          </div>
          <p className={s.kicker}>{step.kicker}</p>
          <h2 className={s.title}>{step.title}</h2>
          {step.body && <p className={s.text}>{step.body}</p>}
          {step.chips && (
            <ul className={s.chips}>
              {step.chips.map((slug, k) => {
                const p = page(slug);
                return p ? (
                  <li key={slug} style={{ ["--i" as string]: k }}>
                    <NavIcon name={p.icon} className="size-3.5" />
                    {p.label}
                  </li>
                ) : null;
              })}
            </ul>
          )}
          {step.end === "menus" &&
            (["main", "second"] as const).map((slot) => (
              <fieldset key={slot} className={s.pick}>
                <legend>{slot === "main" ? "Main menu" : "Second menu"}</legend>
                <div>
                  {OFFERED[slot].map((id) => {
                    const other = slot === "main" ? pick.second : pick.main;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={pick[slot] === id}
                        disabled={id === other}
                        onClick={() => setPick({ ...pick, [slot]: id })}
                      >
                        {pick[slot] === id && <Check aria-hidden />}
                        {MENU_NAMES[id]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          {step.end === "cta" && (
            <div className={s.cta}>
              <Link href="/join" className={s.primary} onClick={onDone}>
                See plans
              </Link>
              <Link href="/signup" className={s.ghost} onClick={onDone}>
                Sign up free
              </Link>
            </div>
          )}
        </div>

        <div className={s.nav}>
          <button
            type="button"
            className={s.ghost}
            disabled={i === 0}
            onClick={() => setI(i - 1)}
          >
            <ArrowLeft aria-hidden /> Back
          </button>
          <span className={s.count}>
            {step.end !== "menus" && `${i + 1} / ${steps.length}`}
          </span>
          {step.end === "menus" ? (
            <span className={s.pair}>
              <button
                type="button"
                className={s.ghost}
                onClick={() => finish(false)}
              >
                Keep ours
              </button>
              <button
                type="button"
                ref={next}
                className={s.primary}
                onClick={() => finish(true)}
              >
                Use these
              </button>
            </span>
          ) : (
            <button
              type="button"
              ref={next}
              className={s.primary}
              onClick={() => (last ? onDone() : setI(i + 1))}
            >
              {last ? "Keep looking" : "Next"}{" "}
              {!last && <ArrowRight aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
