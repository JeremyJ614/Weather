"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
} from "lucide-react";
import { NavIcon } from "@/components/NavIcon";
import { savePrefs } from "@/features/account/PrefsSync";
import { MENU_NAMES, OFFERED, pickMenus } from "@/features/menus/catalog";
import { MENU_STYLES } from "@/features/menus/styles";
import { resolvePlacements } from "@/lib/nav/spots";
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
  /** Hands-on tips: things that aren't obvious until someone shows you. */
  tips?: { icon: string; title: string; text: string }[];
  end?: "menus" | "cta";
};

/** How to use each section of the main menu (by group id). */
const HOW: Record<string, string> = {
  home: "Your start screen: the Weather Clock, conditions where you are, Weather News and today's highlights. Tap the SSWX logo from any page to come back.",
  local:
    "Everything here follows your active place. The Dashboard is the full picture, the Daily Brief is the short version (it can come by email too), and the Forecast Discussion is your NWS office in plain words.",
  community:
    "Make a forecast in the daily game and get scored against what actually happens, answer trivia, vote in the weekly poll and climb the leaderboard. Points earn badges and titles.",
  severe:
    "Start with the SSWXCon score for the big picture, then SPC's outlooks, live warnings and discussions. Tropical Outlook's Model Tracks races the models; Storm Chasing Outlook picks the day's two best targets and explains them tab by tab.",
  tools:
    "Pick a model, a run and a field on Radar & Model Runs, then press play or drag the timeline. Tap a river gauge for its forecast crest; spin a 3D sounding with your finger.",
  specialty:
    "Tonight's sky for star gazing, the moon and planets, where the aurora could reach and live lightning strikes near you.",
  edu: "Records and averages for your place, a glossary for any word you hit on another page, and a free library of lessons.",
  else: "Weather Patterns sums up what already happened (yesterday, the week, the month, the season) in plain words with the numbers behind it.",
  account:
    "My Profile holds your places and badges; Account Settings your menus, Quick Menu, theme and this tour; Notifications which alerts reach your phone.",
};

const TIPS: Step["tips"] = [
  {
    icon: "Hand",
    title: "Maps move when you ask",
    text: "Maps hold still so the page scrolls smoothly. Tap Zoom & pan to pinch, drag and zoom; tap Done to scroll again. The square button brings back the whole country.",
  },
  {
    icon: "Download",
    title: "Keep any map",
    text: "Download PNG saves a map with its legend and title; Share sends it straight to a text or a post.",
  },
  {
    icon: "PanelTop",
    title: "Subtabs remember",
    text: "Open a subtab once and it stays loaded, so flipping back is instant and a map keeps its spot.",
  },
  {
    icon: "MapPin",
    title: "Five places",
    text: "Save up to five places in My Profile. Every local page and your Daily Brief follow the one that's active.",
  },
  {
    icon: "Bell",
    title: "Alerts your way",
    text: "Choose which alerts reach your phone, and set quiet hours, in Notifications. Warnings and watches still come through.",
  },
  {
    icon: "House",
    title: "Home from anywhere",
    text: "The SSWX logo at the top always takes you back to the Homepage.",
  },
];

/** Where a main menu sits, in words, so the tour can say where to tap. */
const SPOT: Record<string, string> = {
  "top-right": "top right corner",
  "top-left": "top left corner",
  "bottom-bar": "bar along the bottom",
  "bottom-center": "bottom middle",
  "bottom-right": "bottom right corner",
  "bottom-left": "bottom left corner",
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
    body: "Hurricane tracks, every model's track side by side, flooding, fire weather, drought and a full winter center.",
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
    icon: "Palette",
    kicker: "Make it yours",
    title: "Your app, your way",
    body: "Pick from eighteen menu styles and fifteen ready-made themes, fill a Quick Menu with the pages you use most, and choose exactly which alerts reach your phone.",
    chips: ["settings", "notifications", "profile"],
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
      icon: "Lightbulb",
      kicker: "Good to know",
      title: "Things worth knowing",
      body: "",
      tips: TIPS,
    },
    {
      icon: "Menu",
      kicker: "Last step",
      title: "Try the main menus",
      body: "Tap the arrows and the menu on your screen changes right now. Open it, try it, then keep the one you like.",
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
  // What this device had before the tour swapped menus live, to put back on Skip.
  const before = useRef<string | null>(null);
  const changed = useRef(false);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => {
    let saved: { main?: string; second?: string } = {};
    try {
      before.current = localStorage.getItem(KEYS.menus);
      saved = JSON.parse(before.current || "{}");
    } catch {}
    queueMicrotask(() => setPick(pickMenus(saved, menus)));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    next.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menus]);

  /** Shows a menu choice on the page now (the menu host listens for storage events). */
  const apply = (raw: string | null) => {
    try {
      if (raw == null) localStorage.removeItem(KEYS.menus);
      else localStorage.setItem(KEYS.menus, raw);
    } catch {}
    dispatchEvent(new StorageEvent("storage", { key: KEYS.menus }));
  };
  const close = useCallback(() => {
    if (changed.current) apply(before.current);
    onDone();
  }, [onDone]);
  const cycle = (d: number) => {
    const list = OFFERED.main.filter((id) => id !== pick.second);
    const at = Math.max(0, list.indexOf(pick.main));
    const m = { ...pick, main: list[(at + d + list.length) % list.length] };
    changed.current = true;
    setPick(m);
    apply(JSON.stringify(m));
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // Escape closes an open menu first, not the tour.
      if (document.documentElement.dataset.menuOpen) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight")
        setI((k) => Math.min(steps.length - 1, k + 1));
      if (e.key === "ArrowLeft") setI((k) => Math.max(0, k - 1));
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [close, steps.length]);

  const finish = (save: boolean) => {
    if (!save) return close();
    savePrefs({ menus: pick }, mode === "tour");
    onDone();
  };
  const compact = step.end === "menus";
  const spot =
    MENU_STYLES[pick.main] && MENU_STYLES[pick.second]
      ? SPOT[
          resolvePlacements(
            MENU_STYLES[pick.main].placements,
            MENU_STYLES[pick.second].placements,
          ).main.id.replace(/-raised$/, "")
        ]
      : null;
  const choices = OFFERED.main.filter((id) => id !== pick.second);
  const auto = mode === "showcase" && !last;

  return (
    <div
      className={s.shade}
      data-compact={compact || undefined}
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
          onClick={close}
          aria-label={mode === "tour" ? "Skip the tour" : "Skip"}
        >
          Skip <X aria-hidden />
        </button>

        <div key={i} className={s.body}>
          <div className={s.art} aria-hidden hidden={compact}>
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
          {step.tips && (
            <ul className={s.tips}>
              {step.tips.map((t, k) => (
                <li key={t.title} style={{ ["--i" as string]: k }}>
                  <NavIcon name={t.icon} className="size-5" />
                  <span>
                    <b>{t.title}</b>
                    {t.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {step.end === "menus" && (
            <>
              <div className={s.cycle}>
                <button
                  type="button"
                  aria-label="Previous menu style"
                  onClick={() => cycle(-1)}
                >
                  <ChevronLeft aria-hidden />
                </button>
                <div aria-live="polite">
                  <b>{MENU_NAMES[pick.main]}</b>
                  <small>
                    {choices.indexOf(pick.main) + 1} of {choices.length}
                    {spot ? ` · open it from the ${spot}` : ""}
                  </small>
                </div>
                <button
                  type="button"
                  aria-label="Next menu style"
                  onClick={() => cycle(1)}
                >
                  <ChevronRight aria-hidden />
                </button>
              </div>
              <p className={s.quick}>
                <Zap aria-hidden />
                <span>
                  Your second menu is your <b>Quick Menu</b>: the storm chasing
                  pages, plus any page you pin in Account Settings.
                </span>
              </p>
            </>
          )}
          {step.end === "cta" && (
            <div className={s.cta}>
              <Link href="/join" className={s.primary} onClick={close}>
                See plans
              </Link>
              <Link href="/signup" className={s.ghost} onClick={close}>
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
                Use this one
              </button>
            </span>
          ) : (
            <button
              type="button"
              ref={next}
              className={s.primary}
              onClick={() => (last ? close() : setI(i + 1))}
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
