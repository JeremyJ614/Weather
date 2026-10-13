/* Generated from the Theme Lab picks (docs/04-DECISIONS.md). */
export type Token =
  | "bg"
  | "surface"
  | "surface2"
  | "line"
  | "text"
  | "muted"
  | "accent"
  | "accent2"
  | "metal";
export interface Palette {
  id: string;
  name: string;
  t: Record<Token, string>;
}
export interface FontSet {
  id: string;
  name: string;
  display: string;
  body: string;
  mono: string;
  displayWeight: number;
  uppercase: boolean;
}
export const PALETTES: Palette[] = [
  {
    id: "silver",
    name: "Twilight Silver",
    t: {
      bg: "#0d0e12",
      surface: "#17191f",
      surface2: "#21242c",
      line: "#30343f",
      text: "#f0f1f5",
      muted: "#a3a7b4",
      accent: "#9aa8ff",
      accent2: "#c9ccd6",
      metal: "#d6d8e0",
    },
  },
  {
    id: "stormcell",
    name: "Storm Cell",
    t: {
      bg: "#0b0d10",
      surface: "#14171c",
      surface2: "#1d2128",
      line: "#2b313b",
      text: "#eef2f6",
      muted: "#9aa4b2",
      accent: "#2ee6ff",
      accent2: "#9b6bff",
      metal: "#c5ccd6",
    },
  },
  {
    id: "frost",
    name: "Pastel Frost",
    t: {
      bg: "#0e131a",
      surface: "#161d27",
      surface2: "#1f2834",
      line: "#2d3a4a",
      text: "#eef4fa",
      muted: "#a2b1c2",
      accent: "#a9dcff",
      accent2: "#d7c2ff",
      metal: "#d3dbe4",
    },
  },
  {
    id: "nebula",
    name: "Pastel Nebula",
    t: {
      bg: "#11121a",
      surface: "#1a1c28",
      surface2: "#242738",
      line: "#33374d",
      text: "#f1f1fa",
      muted: "#a6a9c2",
      accent: "#c3b5ff",
      accent2: "#a6f0d0",
      metal: "#cfd1df",
    },
  },
  {
    id: "sapphire",
    name: "Sapphire Court",
    t: {
      bg: "#06111a",
      surface: "#0c1b28",
      surface2: "#122838",
      line: "#1d3a4f",
      text: "#e9f4fb",
      muted: "#8fb0c4",
      accent: "#3fb6ff",
      accent2: "#e9cf9a",
      metal: "#c6d5de",
    },
  },
  {
    id: "amethyst",
    name: "Amethyst Crown",
    t: {
      bg: "#120a14",
      surface: "#1d1222",
      surface2: "#2a1a31",
      line: "#3c2647",
      text: "#f6ecf6",
      muted: "#b79ab9",
      accent: "#c07bff",
      accent2: "#f0a98e",
      metal: "#d8c4cf",
    },
  },
  {
    id: "royal",
    name: "StormSync Royal",
    t: {
      bg: "#0c0a16",
      surface: "#16132a",
      surface2: "#201c3a",
      line: "#2f2a52",
      text: "#ecebfa",
      muted: "#9f9cc2",
      accent: "#8e9bff",
      accent2: "#b07bff",
      metal: "#c3c6d4",
    },
  },
  {
    id: "vip",
    name: "VIP Gold",
    t: {
      bg: "#0b0c14",
      surface: "#13141f",
      surface2: "#1c1e2c",
      line: "#23253a",
      text: "#eceef5",
      muted: "#8f92a8",
      accent: "#d9b76f",
      accent2: "#a9b0d6",
      metal: "#c9cbd6",
    },
  },
  {
    id: "titanium",
    name: "Titanium",
    t: {
      bg: "#1a1c20",
      surface: "#23262b",
      surface2: "#2d3037",
      line: "#3d414a",
      text: "#f3f4f6",
      muted: "#aeb2bc",
      accent: "#5b8cff",
      accent2: "#cfd5e3",
      metal: "#d9dce3",
    },
  },
  {
    id: "steelrose",
    name: "Steel Rose",
    t: {
      bg: "#121316",
      surface: "#1b1c21",
      surface2: "#25262d",
      line: "#35363f",
      text: "#f6f1f3",
      muted: "#b0a5ab",
      accent: "#f4a7c0",
      accent2: "#c9ccd6",
      metal: "#d8d2d5",
    },
  },
  {
    id: "slatestorm",
    name: "Slate Storm",
    t: {
      bg: "#11151b",
      surface: "#19202a",
      surface2: "#222b38",
      line: "#313d4d",
      text: "#eef2f7",
      muted: "#9aa8ba",
      accent: "#ffb547",
      accent2: "#7fa7ff",
      metal: "#cfd6e0",
    },
  },
  {
    id: "thunderhead",
    name: "Thunderhead",
    t: {
      bg: "#0f1218",
      surface: "#171c25",
      surface2: "#202734",
      line: "#2e3747",
      text: "#edf1f7",
      muted: "#98a3b5",
      accent: "#ffe14d",
      accent2: "#8fb4ff",
      metal: "#ccd3de",
    },
  },
  {
    id: "carbon",
    name: "Carbon Black",
    t: {
      bg: "#000000",
      surface: "#0d0d0f",
      surface2: "#17171b",
      line: "#26262c",
      text: "#f5f5f7",
      muted: "#9a9aa5",
      accent: "#3d8bff",
      accent2: "#9ad1ff",
      metal: "#c8c8d0",
    },
  },
  {
    id: "midnightink",
    name: "Midnight Ink",
    t: {
      bg: "#07070c",
      surface: "#101019",
      surface2: "#181826",
      line: "#262638",
      text: "#f2f0ff",
      muted: "#a29fc0",
      accent: "#cbbcff",
      accent2: "#9fe7d7",
      metal: "#cfcde0",
    },
  },
  {
    id: "ashember",
    name: "Ash & Ember",
    t: {
      bg: "#111010",
      surface: "#1b1918",
      surface2: "#262321",
      line: "#383330",
      text: "#f6f1ed",
      muted: "#b0a69e",
      accent: "#ff7a3d",
      accent2: "#ffc58a",
      metal: "#d6cdc6",
    },
  },
  {
    id: "eclipse",
    name: "Eclipse",
    t: {
      bg: "#030304",
      surface: "#0c0b10",
      surface2: "#15131b",
      line: "#24212d",
      text: "#f6f3ff",
      muted: "#a49fb7",
      accent: "#ff9a3c",
      accent2: "#b38bff",
      metal: "#cfcbdb",
    },
  },
  {
    id: "nightshade",
    name: "Nightshade",
    t: {
      bg: "#0a0710",
      surface: "#130e1b",
      surface2: "#1c1527",
      line: "#2c223b",
      text: "#f7f0ff",
      muted: "#ad9fc2",
      accent: "#ff8fd8",
      accent2: "#c7b3ff",
      metal: "#d5cbe0",
    },
  },
];
export const FONT_SETS: FontSet[] = [
  {
    id: "broadcast",
    name: "Broadcast",
    display: "Barlow Condensed",
    body: "Figtree",
    mono: "JetBrains Mono",
    displayWeight: 800,
    uppercase: true,
  },
  {
    id: "vip",
    name: "VIP Classic",
    display: "Raleway",
    body: "DM Sans",
    mono: "JetBrains Mono",
    displayWeight: 800,
    uppercase: false,
  },
  {
    id: "royalseal",
    name: "Royal Seal",
    display: "Cinzel",
    body: "DM Sans",
    mono: "JetBrains Mono",
    displayWeight: 700,
    uppercase: true,
  },
  {
    id: "stormdesk",
    name: "Storm Desk",
    display: "Rajdhani",
    body: "Exo 2",
    mono: "JetBrains Mono",
    displayWeight: 700,
    uppercase: true,
  },
  {
    id: "mission",
    name: "Mission Control",
    display: "Orbitron",
    body: "Exo 2",
    mono: "Share Tech Mono",
    displayWeight: 800,
    uppercase: true,
  },
  {
    id: "radarroom",
    name: "Radar Room",
    display: "Chakra Petch",
    body: "IBM Plex Sans",
    mono: "IBM Plex Mono",
    displayWeight: 700,
    uppercase: true,
  },
  {
    id: "fieldreport",
    name: "Field Report",
    display: "Oswald",
    body: "Source Sans 3",
    mono: "JetBrains Mono",
    displayWeight: 700,
    uppercase: true,
  },
  {
    id: "velocity",
    name: "Velocity",
    display: "Saira Condensed",
    body: "Saira",
    mono: "JetBrains Mono",
    displayWeight: 800,
    uppercase: true,
  },
  {
    id: "editorial",
    name: "Editorial Crown",
    display: "Playfair Display",
    body: "Mulish",
    mono: "JetBrains Mono",
    displayWeight: 800,
    uppercase: false,
  },
  {
    id: "arcade",
    name: "Arcade Storm",
    display: "Russo One",
    body: "Nunito Sans",
    mono: "JetBrains Mono",
    displayWeight: 400,
    uppercase: true,
  },
  {
    id: "cleanpro",
    name: "Clean Pro",
    display: "Outfit",
    body: "Outfit",
    mono: "JetBrains Mono",
    displayWeight: 800,
    uppercase: false,
  },
  {
    id: "logomatch",
    name: "Logo Match",
    display: "Alfa Slab One",
    body: "Lexend",
    mono: "JetBrains Mono",
    displayWeight: 400,
    uppercase: true,
  },
];
/** The owner's saved combos, offered as ready-made templates. */
export const TEMPLATES: { palette: string; font: string }[] = [
  {
    palette: "silver",
    font: "stormdesk",
  },
  {
    palette: "frost",
    font: "mission",
  },
  {
    palette: "royal",
    font: "radarroom",
  },
  {
    palette: "vip",
    font: "vip",
  },
  {
    palette: "titanium",
    font: "arcade",
  },
  {
    palette: "steelrose",
    font: "cleanpro",
  },
  {
    palette: "slatestorm",
    font: "logomatch",
  },
  {
    palette: "thunderhead",
    font: "broadcast",
  },
  {
    palette: "carbon",
    font: "royalseal",
  },
  {
    palette: "midnightink",
    font: "radarroom",
  },
  {
    palette: "ashember",
    font: "fieldreport",
  },
  {
    palette: "nightshade",
    font: "velocity",
  },
  {
    palette: "eclipse",
    font: "vip",
  },
];
export const DEFAULT_THEME = { palette: "vip", font: "editorial" };
