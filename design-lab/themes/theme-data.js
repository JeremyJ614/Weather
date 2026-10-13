/* Theme Lab data. A palette is only color tokens; a font set is only type tokens.
   Any palette can be paired with any font set. */
const P = (id, name, group, note, bg, surface, surface2, line, text, muted, accent, accent2, metal) =>
  ({ id, name, group, note, t: { bg, surface, surface2, line, text, muted, accent, accent2, metal } });

const PALETTES = [
  P("silver", "Twilight Silver", "Your picks", "Graphite and brushed silver, finishing in periwinkle. Your current default.", "#0d0e12", "#17191f", "#21242c", "#30343f", "#f0f1f5", "#a3a7b4", "#9aa8ff", "#c9ccd6", "#d6d8e0"),
  P("stormcell", "Storm Cell", "Your picks", "Charcoal radar screen with electric cyan and violet.", "#0b0d10", "#14171c", "#1d2128", "#2b313b", "#eef2f6", "#9aa4b2", "#2ee6ff", "#9b6bff", "#c5ccd6"),
  P("frost", "Pastel Frost", "Your picks", "Blue-gray winter with ice blue and lilac.", "#0e131a", "#161d27", "#1f2834", "#2d3a4a", "#eef4fa", "#a2b1c2", "#a9dcff", "#d7c2ff", "#d3dbe4"),
  P("nebula", "Pastel Nebula", "Your picks", "Dark slate with pastel lavender and mint.", "#11121a", "#1a1c28", "#242738", "#33374d", "#f1f1fa", "#a6a9c2", "#c3b5ff", "#a6f0d0", "#cfd1df"),
  P("sapphire", "Sapphire Court", "Your picks", "Deep teal-navy, sapphire and champagne.", "#06111a", "#0c1b28", "#122838", "#1d3a4f", "#e9f4fb", "#8fb0c4", "#3fb6ff", "#e9cf9a", "#c6d5de"),
  P("amethyst", "Amethyst Crown", "Your picks", "Plum black, amethyst and rose gold.", "#120a14", "#1d1222", "#2a1a31", "#3c2647", "#f6ecf6", "#b79ab9", "#c07bff", "#f0a98e", "#d8c4cf"),
  P("royal", "StormSync Royal", "Your picks", "The logo's metal and violet, with periwinkle as the action color.", "#0c0a16", "#16132a", "#201c3a", "#2f2a52", "#ecebfa", "#9f9cc2", "#8e9bff", "#b07bff", "#c3c6d4"),
  P("vip", "VIP Gold", "From the VIP app", "The VIP Forecasts app as it is today: blue-black with a gold accent.", "#0b0c14", "#13141f", "#1c1e2c", "#23253a", "#eceef5", "#8f92a8", "#d9b76f", "#a9b0d6", "#c9cbd6"),
  P("graphite", "Graphite", "New: grays", "Neutral graphite with bright silver actions and a periwinkle second color.", "#121315", "#1b1c1f", "#25272b", "#34363c", "#f1f2f4", "#a2a5ad", "#e2e5ee", "#8f9cff", "#d4d7de"),
  P("titanium", "Titanium", "New: grays", "A lighter gray with cobalt blue. The softest of the dark themes.", "#1a1c20", "#23262b", "#2d3037", "#3d414a", "#f3f4f6", "#aeb2bc", "#5b8cff", "#cfd5e3", "#d9dce3"),
  P("gunmetal", "Gunmetal Violet", "New: grays", "Gunmetal with violet and a pale lilac.", "#141518", "#1d1f24", "#272a31", "#373b44", "#f0f0f4", "#a3a5b2", "#a78bfa", "#e0d7ff", "#cdd0d9"),
  P("steelrose", "Steel Rose", "New: grays", "Steel gray with a pastel rose.", "#121316", "#1b1c21", "#25262d", "#35363f", "#f6f1f3", "#b0a5ab", "#f4a7c0", "#c9ccd6", "#d8d2d5"),
  P("slatestorm", "Slate Storm", "New: grays", "Blue slate with amber, like a sky before a storm.", "#11151b", "#19202a", "#222b38", "#313d4d", "#eef2f7", "#9aa8ba", "#ffb547", "#7fa7ff", "#cfd6e0"),
  P("thunderhead", "Thunderhead", "New: grays", "Storm-cloud gray-blue with a lightning yellow.", "#0f1218", "#171c25", "#202734", "#2e3747", "#edf1f7", "#98a3b5", "#ffe14d", "#8fb4ff", "#ccd3de"),
  P("arcticnight", "Arctic Night", "New: grays", "Cold gray-navy with aurora green.", "#0d1116", "#151b22", "#1e2630", "#2b3642", "#eef5f8", "#9cadb9", "#7dffb2", "#8fd3ff", "#cbd6dd"),
  P("carbon", "Carbon Black", "New: blacks", "True black with electric blue. Saves battery on OLED phones.", "#000000", "#0d0d0f", "#17171b", "#26262c", "#f5f5f7", "#9a9aa5", "#3d8bff", "#9ad1ff", "#c8c8d0"),
  P("onyxice", "Onyx & Ice", "New: blacks", "Black with ice cyan.", "#050607", "#0e1114", "#161b20", "#232a31", "#eef6fa", "#93a4b0", "#7fe3ff", "#c9f3ff", "#c7d3da"),
  P("midnightink", "Midnight Ink", "New: blacks", "Ink black with pastel lavender and mint.", "#07070c", "#101019", "#181826", "#262638", "#f2f0ff", "#a29fc0", "#cbbcff", "#9fe7d7", "#cfcde0"),
  P("obsidianmint", "Obsidian Mint", "New: blacks", "Black with a bright mint.", "#040605", "#0c110f", "#141b18", "#1f2a25", "#ecf7f1", "#93ab9f", "#5cf2b0", "#b8ffe0", "#c6d6ce"),
  P("noirgold", "Noir Gold", "New: blacks", "Black tie: gold on pure black.", "#000000", "#0d0c0a", "#181612", "#2a261e", "#fbf7ee", "#b3a991", "#f0c35a", "#fff1c9", "#d8d0bf"),
  P("ashember", "Ash & Ember", "New: blacks", "Charcoal with a glowing ember orange.", "#111010", "#1b1918", "#262321", "#383330", "#f6f1ed", "#b0a69e", "#ff7a3d", "#ffc58a", "#d6cdc6"),
  P("eclipse", "Eclipse", "New: blacks", "Black with a corona orange and violet.", "#030304", "#0c0b10", "#15131b", "#24212d", "#f6f3ff", "#a49fb7", "#ff9a3c", "#b38bff", "#cfcbdb"),
  P("nightshade", "Nightshade", "New: blacks", "Purple-black with a pastel magenta.", "#0a0710", "#130e1b", "#1c1527", "#2c223b", "#f7f0ff", "#ad9fc2", "#ff8fd8", "#c7b3ff", "#d5cbe0")
];

/* Each font set: display face for headings, body face for text, mono for data. */
const F = (id, name, note, display, dW, body, mono, upper = true) => ({ id, name, note, display, dW, body, mono, upper });
const FONTS = [
  F("broadcast", "Broadcast", "Tall condensed headlines like a TV weather graphic. Used in Section A.", "Barlow Condensed", 800, "Figtree", "JetBrains Mono"),
  F("vip", "VIP Classic", "What the VIP app uses today: Raleway headings, DM Sans text.", "Raleway", 800, "DM Sans", "JetBrains Mono", false),
  F("royalseal", "Royal Seal", "Cinzel capitals from the VIP brand with DM Sans text. The most royal.", "Cinzel", 700, "DM Sans", "JetBrains Mono"),
  F("stormdesk", "Storm Desk", "Squared, technical headings like Ryan Hall's maps.", "Rajdhani", 700, "Exo 2", "JetBrains Mono"),
  F("mission", "Mission Control", "Space-age and wide. Strong for Aurora and Astronomy.", "Orbitron", 800, "Exo 2", "Share Tech Mono"),
  F("radarroom", "Radar Room", "Angular cuts with IBM's clear workhorse text.", "Chakra Petch", 700, "IBM Plex Sans", "IBM Plex Mono"),
  F("headline", "Headline", "Bebas Neue capitals, the classic breaking-news look.", "Bebas Neue", 400, "Manrope", "JetBrains Mono"),
  F("fieldreport", "Field Report", "Oswald with Source Sans: plain-spoken and very readable.", "Oswald", 700, "Source Sans 3", "JetBrains Mono"),
  F("velocity", "Velocity", "One family throughout, condensed for headings.", "Saira Condensed", 800, "Saira", "JetBrains Mono"),
  F("widesky", "Wide Sky", "Very wide headings that feel expensive and calm.", "Michroma", 400, "Sora", "JetBrains Mono"),
  F("editorial", "Editorial Crown", "A serif headline with clean text. Magazine-like and premium.", "Playfair Display", 800, "Mulish", "JetBrains Mono", false),
  F("boldfront", "Bold Front", "Anton's heavy capitals for maximum punch.", "Anton", 400, "Work Sans", "JetBrains Mono"),
  F("stadium", "Stadium", "Archivo Black with Archivo: sturdy and modern.", "Archivo Black", 400, "Archivo", "JetBrains Mono"),
  F("arcade", "Arcade Storm", "Rounded, game-like headings. Fun for WX Games.", "Russo One", 400, "Nunito Sans", "JetBrains Mono"),
  F("cleanpro", "Clean Pro", "Outfit for everything: minimal and friendly.", "Outfit", 800, "Outfit", "JetBrains Mono", false),
  F("logomatch", "Logo Match", "A chunky slab like the StormSync logo, with Lexend text.", "Alfa Slab One", 400, "Lexend", "JetBrains Mono")
];

/* Google Fonts query per family (weights each family actually has). */
const FAMILY_Q = {
  "Barlow Condensed": "Barlow+Condensed:wght@600;700;800", "Figtree": "Figtree:wght@400;600;700", "JetBrains Mono": "JetBrains+Mono:wght@400;600",
  "Raleway": "Raleway:wght@500;700;800", "DM Sans": "DM+Sans:wght@400;600;700", "Cinzel": "Cinzel:wght@600;700",
  "Rajdhani": "Rajdhani:wght@500;700", "Exo 2": "Exo+2:wght@400;600;700", "Orbitron": "Orbitron:wght@600;800", "Share Tech Mono": "Share+Tech+Mono",
  "Chakra Petch": "Chakra+Petch:wght@500;700", "IBM Plex Sans": "IBM+Plex+Sans:wght@400;600", "IBM Plex Mono": "IBM+Plex+Mono:wght@400;600",
  "Bebas Neue": "Bebas+Neue", "Manrope": "Manrope:wght@400;600;700", "Oswald": "Oswald:wght@500;700", "Source Sans 3": "Source+Sans+3:wght@400;600;700",
  "Saira Condensed": "Saira+Condensed:wght@600;800", "Saira": "Saira:wght@400;600", "Michroma": "Michroma", "Sora": "Sora:wght@400;600",
  "Playfair Display": "Playfair+Display:wght@700;800", "Mulish": "Mulish:wght@400;600;700", "Anton": "Anton", "Work Sans": "Work+Sans:wght@400;600",
  "Archivo Black": "Archivo+Black", "Archivo": "Archivo:wght@400;600", "Russo One": "Russo+One", "Nunito Sans": "Nunito+Sans:wght@400;600;700",
  "Outfit": "Outfit:wght@400;600;800", "Alfa Slab One": "Alfa+Slab+One", "Lexend": "Lexend:wght@400;600"
};
