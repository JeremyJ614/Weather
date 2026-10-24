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
import { ABOUT, INTERESTS } from "./about";
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
  end?: "menus" | "cta" | "interests";
};

/** How to use each section of the main menu (by group id). */
const HOW: Record<string, string> = {
  home: "Your start screen: the Weather Clock, conditions where you are, Weather News and today's highlights. Tap the SSWX logo from any page to come back.",
  local:
    "Everything here follows your active place. The Dashboard is the full picture, the Daily Brief is the short version (it can come by email too), and the Forecast Discussion is your NWS office in plain words.",
  community:
    "Make a forecast in the daily game and get scored against what actually happens, answer trivia, vote in the weekly poll and climb the leaderboard. Points earn badges and titles.",
  severe:
    "Start with the SSWXCon score for the big picture, then SPC's outlooks, live warnings and discussions. Tropical Outlook's Model Tracks races the models; Storm Chasing Outlook picks the day's two best targets, at least 125 miles apart, and explains them tab by tab.",
  tools:
    "Pick a model, a run and a field on Radar & Model Runs, then press play or drag the timeline. Tap a river gauge for its forecast crest; spin a 3D sounding with your finger.",
  specialty:
    "Tonight's sky for star gazing, the moon and planets, where the aurora could reach and live lightning strikes near you.",
  edu: "Records and averages for your place, a glossary for any word you hit on another page, and a free library of lessons.",
  else: "Weather Patterns sums up what already happened in plain words. Extras holds the Weather Engines, now drawn like SPC outlooks, plus the Storm Visualizer and Particle Morph. Disaster Response lists the groups that help after storms, and Donate supports StormSync.",
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

/** What changed lately, for members who toured before. */
const NEW: Step["tips"] = [
  {
    icon: "Zap",
    title: "Ten new Weather Engines",
    text: "In Extras: Lightning Surge, First Storms, Boundary Collisions, Severe Analogs, Rain-Wrap, Blizzard, Sunset & Sunrise, Rainbow Chance, Deer Activity and Fishing Bite. Each checks itself against what really happened.",
  },
  {
    icon: "Grid3x3",
    title: "Weatherdle",
    text: "A new weather word every day in WX Games, any length, six tries. Solves earn Leaderboard points; share your grid.",
  },
  {
    icon: "CalendarDays",
    title: "On This Day",
    text: "Today in weather history: every tornado and hurricane on record for the date, mapped, with the stories behind them. Pick any date.",
  },
  {
    icon: "Thermometer",
    title: "Climate Extremes",
    text: "The hottest, coldest and windiest places in the country right now, and every record the Weather Service reported this week.",
  },
  {
    icon: "Car",
    title: "Two chase targets, always",
    text: "Storm Chasing Outlook now picks two targets at least 125 miles apart, so they're two different chases, and says how far apart they are.",
  },
  {
    icon: "FlaskConical",
    title: "Engines that read like SPC maps",
    text: "ProbTor and the model engines in Extras draw nested, outlined areas like an SPC outlook.",
  },
  {
    icon: "Route",
    title: "Replay a chase",
    text: "Draw your route in the Storm Chasing Log; it snaps to the roads, finds the storms near it and replays them on radar.",
  },
  {
    icon: "HeartHandshake",
    title: "Disaster Response",
    text: "Groups that help after storms, what they do and where, and how to give to them or help them.",
  },
  {
    icon: "HandCoins",
    title: "Donate",
    text: "Support StormSync with a gift of any amount, once or every month, and add your name to the supporters wall.",
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
    icon: "Archive",
    kicker: "Replays",
    title: "Relive the storms",
    body: "Replay famous tornadoes minute by minute: radar, warnings, the damage path and every report. Or log your own chase, draw the route and replay it against the radar.",
    chips: ["tornado-archive", "chasing-log", "severe-weather-history"],
  },
  {
    icon: "FlaskConical",
    kicker: "Extras",
    title: "Engines with a wow",
    body: "Weather Engines drawn like SPC outlooks (ProbTor, STP, SCP, derecho, lightning and landspouts), a 3D Storm Visualizer and a Particle Morph you can play with.",
    chips: ["extras"],
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
    icon: "HeartHandshake",
    kicker: "Give back",
    title: "Help after the storm",
    body: "Find the groups that help after tornadoes, floods and hurricanes, and how to give to them or help them. Or keep StormSync running with a gift of any amount.",
    chips: ["disaster-response", "donate"],
  },
  {
    icon: "Compass",
    kicker: "Your turn",
    title: "What brings you here?",
    body: "Tap what you're into and see where to start. Tap any page to read what it does.",
    end: "interests",
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
      body: "Here's a quick tour of everything in StormSync Weather and how to use it. Swipe or tap Next; tap any page to see what it does. Skip any time; replay it from Account Settings.",
    },
    {
      icon: "Sparkles",
      kicker: "Just added",
      title: "What's new",
      body: "",
      tips: NEW,
    },
    ...groups.map((g) => ({
      icon: g.icon,
      kicker: "Main menu",
      title: g.label,
      body: HOW[g.id] ?? "",
      chips: g.pages.map((p) => p.slug),
    })),
    {
      icon: "Zap",
      kicker: "Quick Menu",
      title: "Your shortcuts",
      body: "Your second menu is the Quick Menu: the Tornado Archive and your Storm Chasing Log, plus any page you pin in Account Settings.",
      chips: ["tornado-archive", "chasing-log"],
    },
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

const DWELL = 6500;

/** The member tour or the guest showcase: full-screen, skippable, story-style steps. */
export function Guide({ mode, name, menus, onDone }: GuideProps) {
  const steps = mode === "tour" ? tourSteps(name) : SHOWCASE;
  const [i, setStep] = useState(0);
  const [held, setHeld] = useState(false);
  /** The page chip opened for its description, and the showcase's picked interests. */
  const [sel, setSel] = useState<string | null>(null);
  const [likes, setLikes] = useState<string[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const setI = useCallback((k: number | ((k: number) => number)) => {
    setSel(null);
    setStep(k);
  }, []);
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
  }, [close, steps.length, setI]);

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
  // The showcase plays itself, except on its picker and while a page's description is open.
  const auto = mode === "showcase" && !last && !step.end;
  const paused = held || sel !== null;
  const liked = [
    ...new Set(
      INTERESTS.filter((x) => likes.includes(x.id)).flatMap((x) => x.pages),
    ),
  ];
  const chips = (list: string[]) => (
    <>
      <ul className={s.chips}>
        {list.map((slug, k) => {
          const p = page(slug);
          return p ? (
            <li key={slug} style={{ ["--i" as string]: k }}>
              <button
                type="button"
                aria-pressed={sel === slug}
                onClick={() => setSel(sel === slug ? null : slug)}
              >
                <NavIcon name={p.icon} className="size-3.5" />
                {p.label}
              </button>
            </li>
          ) : null;
        })}
      </ul>
      {sel !== null && list.includes(sel) && page(sel) ? (
        <div className={s.about} aria-live="polite">
          <p>
            <b>{page(sel)!.label}</b>
            {ABOUT[sel]}
          </p>
          <Link href={`/${sel}`} onClick={close} className={s.go}>
            Open it <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : (
        <p className={s.hint}>Tap a page to see what it does</p>
      )}
    </>
  );

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
      onPointerDown={(e) => {
        swipe.current = { x: e.clientX, y: e.clientY };
        if (auto) setHeld(true);
      }}
      onPointerUp={(e) => {
        setHeld(false);
        // A sideways swipe moves a step, like flipping through stories.
        const from = swipe.current;
        swipe.current = null;
        if (!from || compact) return;
        const dx = e.clientX - from.x;
        if (Math.abs(dx) < 60 || Math.abs(e.clientY - from.y) > 50) return;
        if (dx < 0 && !last) setI(i + 1);
        if (dx > 0 && i > 0) setI(i - 1);
      }}
      onPointerCancel={() => {
        setHeld(false);
        swipe.current = null;
      }}
    >
      <div className={s.sheet}>
        <div className={s.bars} aria-hidden>
          {steps.map((_, k) => (
            <span key={k}>
              <i
                data-state={
                  k < i ? "done" : k === i ? (auto ? "run" : "done") : "todo"
                }
                data-held={paused || undefined}
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
          {step.chips && chips(step.chips)}
          {step.end === "interests" && (
            <>
              <fieldset className={s.pick}>
                <legend>Pick one or more</legend>
                <div>
                  {INTERESTS.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={likes.includes(x.id)}
                      onClick={() => {
                        setSel(null);
                        setLikes((l) =>
                          l.includes(x.id)
                            ? l.filter((y) => y !== x.id)
                            : [...l, x.id],
                        );
                      }}
                    >
                      <NavIcon name={x.icon} />
                      {x.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {liked.length > 0 && (
                <div className={s.made}>
                  <p className={s.kicker}>Start here</p>
                  {chips(liked)}
                </div>
              )}
            </>
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
