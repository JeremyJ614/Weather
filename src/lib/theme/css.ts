import { onAccent } from "./contrast";
import { DEFAULT_THEME, FONT_SETS, PALETTES } from "./registry";

/** Family name -> the CSS variable next/font assigns it. */
export const FAMILY_TO_VAR: Record<string, string> = {
  "Playfair Display": "--ff-playfair",
  Mulish: "--ff-mulish",
  "JetBrains Mono": "--ff-jetbrains",
  "Barlow Condensed": "--ff-barlowc",
  Figtree: "--ff-figtree",
  Raleway: "--ff-raleway",
  "DM Sans": "--ff-dmsans",
  Cinzel: "--ff-cinzel",
  Rajdhani: "--ff-rajdhani",
  "Exo 2": "--ff-exo2",
  Orbitron: "--ff-orbitron",
  "Share Tech Mono": "--ff-sharetech",
  "Chakra Petch": "--ff-chakra",
  "IBM Plex Sans": "--ff-plexsans",
  "IBM Plex Mono": "--ff-plexmono",
  Oswald: "--ff-oswald",
  "Source Sans 3": "--ff-sourcesans",
  "Saira Condensed": "--ff-sairac",
  Saira: "--ff-saira",
  "Russo One": "--ff-russo",
  "Nunito Sans": "--ff-nunitosans",
  Outfit: "--ff-outfit",
  "Alfa Slab One": "--ff-alfaslab",
  Lexend: "--ff-lexend",
};

/** Every theme as attribute-scoped token blocks. A theme switch is only an attribute change. */
export function themeCss(): string {
  const pal = PALETTES.map((p) => {
    const vars = Object.entries(p.t)
      .map(([k, v]) => `--${k}:${v}`)
      .join(";");
    const sel =
      p.id === DEFAULT_THEME.palette
        ? `:where(:root),[data-palette="${p.id}"]`
        : `[data-palette="${p.id}"]`;
    return `${sel}{${vars};--on-accent:${onAccent(p.t.accent)}}`;
  });
  const fonts = FONT_SETS.map((f) => {
    const sel =
      f.id === DEFAULT_THEME.font
        ? `:where(:root),[data-font="${f.id}"]`
        : `[data-font="${f.id}"]`;
    return `${sel}{--font-display:var(${FAMILY_TO_VAR[f.display]}),Georgia,serif;--font-body:var(${FAMILY_TO_VAR[f.body]}),system-ui,sans-serif;--font-mono:var(${FAMILY_TO_VAR[f.mono]}),ui-monospace,monospace;--display-weight:${f.displayWeight};--display-case:${f.uppercase ? "uppercase" : "none"}}`;
  });
  return [...pal, ...fonts].join("\n");
}

const PALETTE_IDS = PALETTES.map((p) => p.id);
const FONT_IDS = FONT_SETS.map((f) => f.id);

/**
 * Runs before first paint: applies the saved theme so nothing flashes.
 * Unknown ids fall back to the default, so a removed theme can't break the app.
 */
export const themeBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem("sswx-theme")||"{}"),d=document.documentElement,P=${JSON.stringify(PALETTE_IDS)},F=${JSON.stringify(FONT_IDS)};if(P.indexOf(s.palette)>-1)d.dataset.palette=s.palette;if(F.indexOf(s.font)>-1)d.dataset.font=s.font}catch(e){}})()`;
