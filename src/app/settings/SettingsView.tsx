"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clapperboard,
  Cloud,
  Compass,
  Menu,
  Palette,
  Play,
} from "lucide-react";
import { MENU_NAMES, OFFERED, pickMenus } from "@/features/menus/catalog";
import { savePrefs } from "@/features/account/PrefsSync";
import { parsePref, type IntroPref } from "@/features/intro/schedule";
import { KEYS } from "@/lib/prefs-keys";
import { FONT_SETS, PALETTES, TEMPLATES } from "@/lib/theme/registry";
import s from "./Settings.module.css";

type Pair = { main: string; second: string };
type Theme = { palette: string; font: string };
const INTROS: { id: IntroPref; label: string; note: string }[] = [
  {
    id: "daily",
    label: "Once a day",
    note: "The first time you open the app each day.",
  },
  { id: "always", label: "Every time", note: "Each time the app opens." },
  {
    id: "first",
    label: "First visit only",
    note: "Played once on this device.",
  },
  { id: "off", label: "Off", note: "Go straight to the dashboard." },
];
const palette = (id: string) => PALETTES.find((p) => p.id === id);
const font = (id: string) => FONT_SETS.find((f) => f.id === id);
const readJson = <T,>(k: string): Partial<T> => {
  try {
    return JSON.parse(localStorage.getItem(k) || "{}");
  } catch {
    return {};
  }
};

/** Your menus, theme and intro. Saved on this device at once, and to your account when signed in. */
export function SettingsView({
  signedIn,
  defaults,
}: {
  signedIn: boolean;
  defaults: { menus: Pair; theme: Theme };
}) {
  const [menus, setMenus] = useState<Pair>(defaults.menus);
  const [theme, setTheme] = useState<Theme>(defaults.theme);
  const [intro, setIntro] = useState<IntroPref>("daily");
  const [sync, setSync] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  useEffect(() => {
    queueMicrotask(() => {
      setMenus(pickMenus(readJson<Pair>(KEYS.menus), defaults.menus));
      const t = readJson<Theme>(KEYS.theme);
      setTheme({
        palette: palette(t.palette ?? "") ? t.palette! : defaults.theme.palette,
        font: font(t.font ?? "") ? t.font! : defaults.theme.font,
      });
      try {
        setIntro(parsePref(localStorage.getItem(KEYS.intro)));
      } catch {}
    });
  }, [defaults]);

  const save = (p: Parameters<typeof savePrefs>[0]) => {
    if (signedIn) setSync("saving");
    savePrefs(p, signedIn).then(
      (ok) => signedIn && setSync(ok ? "saved" : "error"),
    );
  };
  const pickMenu = (slot: keyof Pair, id: string) => {
    const next = { ...menus, [slot]: id };
    setMenus(next);
    save({ menus: next });
  };
  const pickTheme = (t: Theme) => {
    setTheme(t);
    save({ theme: t });
  };
  const pickIntro = (v: IntroPref) => {
    setIntro(v);
    save({ intro: v });
  };

  return (
    <div className="grid gap-4">
      <p className={s.sync} role="status">
        <Cloud aria-hidden />
        {!signedIn ? (
          <span>
            Saved on this device. <Link href="/login">Sign in</Link> to keep
            them on every device.
          </span>
        ) : sync === "saving" ? (
          "Saving to your account…"
        ) : sync === "error" ? (
          "Saved on this device. Your account didn't answer; it will catch up next time."
        ) : sync === "saved" ? (
          "Saved to your account."
        ) : (
          "Changes save to your account as you make them."
        )}
      </p>

      <section className={s.card} aria-labelledby="menus-h">
        <header>
          <Menu aria-hidden />
          <h2 id="menus-h">Menus</h2>
        </header>
        <p className={s.muted}>
          Your main menu holds every page; the second menu is a quick shortcut
          launcher. They can&apos;t be the same style, and they never overlap.
        </p>
        {(["main", "second"] as const).map((slot) => {
          const other = slot === "main" ? menus.second : menus.main;
          return (
            <fieldset key={slot} className={s.group}>
              <legend>{slot === "main" ? "Main menu" : "Second menu"}</legend>
              <div className={s.options}>
                {OFFERED[slot].map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={menus[slot] === id}
                    disabled={id === other}
                    title={
                      id === other
                        ? `Already your ${slot === "main" ? "second" : "main"} menu`
                        : undefined
                    }
                    onClick={() => pickMenu(slot, id)}
                  >
                    {menus[slot] === id && <Check aria-hidden />}
                    {MENU_NAMES[id]}
                    {id === other && <small>in use</small>}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        })}
      </section>

      <section className={s.card} aria-labelledby="theme-h">
        <header>
          <Palette aria-hidden />
          <h2 id="theme-h">Theme</h2>
          <small>
            {palette(theme.palette)?.name} · {font(theme.font)?.name}
          </small>
        </header>
        <p className={s.muted}>
          Each tile is drawn in its own theme. Tap one to use it everywhere.
        </p>
        <div className={s.themes}>
          {TEMPLATES.map((t) => {
            const p = palette(t.palette);
            const f = font(t.font);
            if (!p || !f) return null;
            const on = theme.palette === t.palette && theme.font === t.font;
            return (
              <button
                key={`${t.palette}-${t.font}`}
                type="button"
                className={s.theme}
                data-palette={t.palette}
                data-font={t.font}
                aria-pressed={on}
                onClick={() => pickTheme(t)}
              >
                <span className={s.swatches} aria-hidden>
                  {(
                    ["bg", "surface2", "accent", "accent2", "metal"] as const
                  ).map((k) => (
                    <i key={k} style={{ background: p.t[k] }} />
                  ))}
                </span>
                <b>{p.name}</b>
                <small>{f.name}</small>
                {on && <Check aria-hidden className={s.tick} />}
              </button>
            );
          })}
        </div>
        <div className={s.mix}>
          <label>
            <small>Colors</small>
            <select
              value={theme.palette}
              onChange={(e) => pickTheme({ ...theme, palette: e.target.value })}
            >
              {PALETTES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <small>Fonts</small>
            <select
              value={theme.font}
              onChange={(e) => pickTheme({ ...theme, font: e.target.value })}
            >
              {FONT_SETS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={s.card} aria-labelledby="intro-h">
        <header>
          <Clapperboard aria-hidden />
          <h2 id="intro-h">Launch intro</h2>
        </header>
        <div className={s.radios} role="radiogroup" aria-labelledby="intro-h">
          {INTROS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={intro === o.id}
              onClick={() => pickIntro(o.id)}
            >
              <i aria-hidden />
              <span>
                <b>{o.label}</b>
                <small>{o.note}</small>
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={s.play}
          onClick={() => {
            try {
              sessionStorage.setItem("sswx-intro-now", "1");
            } catch {}
            location.reload();
          }}
        >
          <Play aria-hidden /> Play it now
        </button>
      </section>

      <section className={s.card} aria-labelledby="tour-h">
        <header>
          <Compass aria-hidden />
          <h2 id="tour-h">Guided tour</h2>
        </header>
        <p className={s.muted}>
          {signedIn
            ? "Walk through every section again and how to use it."
            : "See everything StormSync Weather does."}
        </p>
        <Link href={signedIn ? "/?tour" : "/?showcase"} className={s.play}>
          <Compass aria-hidden />{" "}
          {signedIn ? "Replay the tour" : "Play the showcase"}
        </Link>
      </section>
    </div>
  );
}
