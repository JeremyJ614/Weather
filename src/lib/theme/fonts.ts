/* Every family a font set can use, bundled with the app (latin subset) so builds never
 fetch from Google. Only the default set (VIP Classic + mono) preloads. Regenerate with the vendor-fonts tool. */
import localFont from "next/font/local";

const f_playfair_display = localFont({
  src: [
    {
      path: "./fonts/playfair_display-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/playfair_display-800.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-playfair",
});
const f_mulish = localFont({
  src: [
    { path: "./fonts/mulish-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/mulish-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/mulish-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/mulish-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-mulish",
});
const f_jetbrains_mono = localFont({
  src: [
    {
      path: "./fonts/jetbrains_mono-400.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/jetbrains_mono-600.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  display: "swap",
  preload: true,
  variable: "--ff-jetbrains",
});
const f_barlow_condensed = localFont({
  src: [
    {
      path: "./fonts/barlow_condensed-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/barlow_condensed-700.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/barlow_condensed-800.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-barlowc",
});
const f_figtree = localFont({
  src: [
    { path: "./fonts/figtree-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/figtree-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/figtree-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-figtree",
});
const f_raleway = localFont({
  src: [
    { path: "./fonts/raleway-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/raleway-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/raleway-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: true,
  variable: "--ff-raleway",
});
const f_dm_sans = localFont({
  src: [
    { path: "./fonts/dm_sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm_sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/dm_sans-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: true,
  variable: "--ff-dmsans",
});
const f_cinzel = localFont({
  src: [
    { path: "./fonts/cinzel-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cinzel-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-cinzel",
});
const f_rajdhani = localFont({
  src: [
    { path: "./fonts/rajdhani-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/rajdhani-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-rajdhani",
});
const f_exo_2 = localFont({
  src: [
    { path: "./fonts/exo_2-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/exo_2-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/exo_2-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-exo2",
});
const f_orbitron = localFont({
  src: [
    { path: "./fonts/orbitron-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/orbitron-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-orbitron",
});
const f_share_tech_mono = localFont({
  src: [
    {
      path: "./fonts/share_tech_mono-400.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-sharetech",
});
const f_chakra_petch = localFont({
  src: [
    { path: "./fonts/chakra_petch-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/chakra_petch-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-chakra",
});
const f_ibm_plex_sans = localFont({
  src: [
    { path: "./fonts/ibm_plex_sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm_plex_sans-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-plexsans",
});
const f_ibm_plex_mono = localFont({
  src: [
    { path: "./fonts/ibm_plex_mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm_plex_mono-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-plexmono",
});
const f_oswald = localFont({
  src: [
    { path: "./fonts/oswald-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/oswald-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-oswald",
});
const f_source_sans_3 = localFont({
  src: [
    { path: "./fonts/source_sans_3-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/source_sans_3-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/source_sans_3-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-sourcesans",
});
const f_saira_condensed = localFont({
  src: [
    {
      path: "./fonts/saira_condensed-600.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/saira_condensed-800.woff2",
      weight: "800",
      style: "normal",
    },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-sairac",
});
const f_saira = localFont({
  src: [
    { path: "./fonts/saira-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/saira-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-saira",
});
const f_russo_one = localFont({
  src: [
    { path: "./fonts/russo_one-400.woff2", weight: "400", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-russo",
});
const f_nunito_sans = localFont({
  src: [
    { path: "./fonts/nunito_sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/nunito_sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/nunito_sans-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-nunitosans",
});
const f_outfit = localFont({
  src: [
    { path: "./fonts/outfit-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/outfit-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/outfit-800.woff2", weight: "800", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-outfit",
});
const f_alfa_slab_one = localFont({
  src: [
    { path: "./fonts/alfa_slab_one-400.woff2", weight: "400", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-alfaslab",
});
const f_lexend = localFont({
  src: [
    { path: "./fonts/lexend-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/lexend-600.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--ff-lexend",
});

export const fontClassNames = [
  f_playfair_display,
  f_mulish,
  f_jetbrains_mono,
  f_barlow_condensed,
  f_figtree,
  f_raleway,
  f_dm_sans,
  f_cinzel,
  f_rajdhani,
  f_exo_2,
  f_orbitron,
  f_share_tech_mono,
  f_chakra_petch,
  f_ibm_plex_sans,
  f_ibm_plex_mono,
  f_oswald,
  f_source_sans_3,
  f_saira_condensed,
  f_saira,
  f_russo_one,
  f_nunito_sans,
  f_outfit,
  f_alfa_slab_one,
  f_lexend,
]
  .map((f) => f.variable)
  .join(" ");
