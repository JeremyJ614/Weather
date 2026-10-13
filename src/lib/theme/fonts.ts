/* Every family a font set can use. Only the default set (Editorial Crown +
 mono) preloads; the rest download the first time a user picks them.
 next/font needs each loader as a module-level const with literal options. */
import {
  Alfa_Slab_One,
  Barlow_Condensed,
  Chakra_Petch,
  Cinzel,
  DM_Sans,
  Exo_2,
  Figtree,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  JetBrains_Mono,
  Lexend,
  Mulish,
  Nunito_Sans,
  Orbitron,
  Oswald,
  Outfit,
  Playfair_Display,
  Rajdhani,
  Raleway,
  Russo_One,
  Saira,
  Saira_Condensed,
  Share_Tech_Mono,
  Source_Sans_3,
} from "next/font/google";

const f_playfair_display = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["700", "800"],
  variable: "--ff-playfair",
});
const f_mulish = Mulish({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "600", "700", "800"],
  variable: "--ff-mulish",
});
const f_jetbrains_mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "600"],
  variable: "--ff-jetbrains",
});
const f_barlow_condensed = Barlow_Condensed({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["600", "700", "800"],
  variable: "--ff-barlowc",
});
const f_figtree = Figtree({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
  variable: "--ff-figtree",
});
const f_raleway = Raleway({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["500", "700", "800"],
  variable: "--ff-raleway",
});
const f_dm_sans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
  variable: "--ff-dmsans",
});
const f_cinzel = Cinzel({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["600", "700"],
  variable: "--ff-cinzel",
});
const f_rajdhani = Rajdhani({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["500", "700"],
  variable: "--ff-rajdhani",
});
const f_exo_2 = Exo_2({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
  variable: "--ff-exo2",
});
const f_orbitron = Orbitron({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["600", "800"],
  variable: "--ff-orbitron",
});
const f_share_tech_mono = Share_Tech_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400"],
  variable: "--ff-sharetech",
});
const f_chakra_petch = Chakra_Petch({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["500", "700"],
  variable: "--ff-chakra",
});
const f_ibm_plex_sans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
  variable: "--ff-plexsans",
});
const f_ibm_plex_mono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
  variable: "--ff-plexmono",
});
const f_oswald = Oswald({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["500", "700"],
  variable: "--ff-oswald",
});
const f_source_sans_3 = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
  variable: "--ff-sourcesans",
});
const f_saira_condensed = Saira_Condensed({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["600", "800"],
  variable: "--ff-sairac",
});
const f_saira = Saira({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
  variable: "--ff-saira",
});
const f_russo_one = Russo_One({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400"],
  variable: "--ff-russo",
});
const f_nunito_sans = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "700"],
  variable: "--ff-nunitosans",
});
const f_outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600", "800"],
  variable: "--ff-outfit",
});
const f_alfa_slab_one = Alfa_Slab_One({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400"],
  variable: "--ff-alfaslab",
});
const f_lexend = Lexend({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "600"],
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
