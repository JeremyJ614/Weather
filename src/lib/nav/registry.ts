/**
 * Every launch page, grouped the way the menus show them. Post-launch items
 * (Raffles, FairWeather, Personal Warnings, Storefront, Members Suite...) are
 * deliberately absent until their phase starts. `phase` tells PhaseNotice
 * where the page stands; `adminOnly` hides a page from everyone else.
 */
export interface NavPage {
  slug: string;
  label: string;
  icon: string;
  phase: string;
  adminOnly?: boolean;
}
export interface NavGroup {
  id: string;
  label: string;
  icon: string;
  pages: NavPage[];
}

const p = (
  slug: string,
  label: string,
  icon: string,
  phase: string,
  adminOnly = false,
): NavPage => ({
  slug,
  label,
  icon,
  phase,
  ...(adminOnly ? { adminOnly } : {}),
});

export const MAIN_NAV: NavGroup[] = [
  {
    id: "home",
    label: "Homepage",
    icon: "House",
    pages: [p("", "Homepage", "House", "15–17")],
  },
  {
    id: "local",
    label: "Localized Data",
    icon: "MapPin",
    pages: [
      p("dashboard", "Dashboard", "LayoutDashboard", "18–20"),
      p("daily-brief", "Daily Brief", "Mail", "21"),
      p(
        "forecast-discussion",
        "Forecast Discussion",
        "MessageSquareText",
        "22",
      ),
      p("aqi-pollen", "AQI & Pollen", "Flower2", "23"),
      p("mosquito-index", "Mosquito Index", "Bug", "24"),
      p("daylight-tracker", "Daylight Tracker", "Sunrise", "25"),
    ],
  },
  {
    id: "community",
    label: "Community",
    icon: "Users",
    pages: [
      p("wx-games", "WX Games", "Gamepad2", "26–27"),
      p("leaderboard", "Leaderboard", "Trophy", "28"),
      p("weekly-polls", "Weekly Polls", "Vote", "29"),
    ],
  },
  {
    id: "severe",
    label: "Severe Weather",
    icon: "CloudLightning",
    pages: [
      p("sswxcon", "SSWXCon Score", "Gauge", "31"),
      p("warnings-reports", "Warnings & Reports", "Siren", "32"),
      p("spc-probability", "SPC & Probability", "Map", "33"),
      p("mesoscale-discussions", "Mesoscale Discussions", "ScanEye", "34"),
      p("atmospheric-ingredients", "Atmospheric Ingredients", "Atom", "35"),
      p("storm-timing-index", "Storm Timing Index", "Timer", "36"),
      p("tropical-outlook", "Tropical Outlook", "Orbit", "37–38b"),
      p("hazards-droughts", "Hazards & Droughts", "ThermometerSun", "39"),
      p("flooding-outlook", "Flooding Outlook", "Waves", "40"),
      p("fire-weather", "Fire Weather", "Flame", "41"),
      p("winter-center", "Winter Center", "Snowflake", "42"),
      p("storm-chasing-outlook", "Storm Chasing Outlook", "Car", "43"),
      p("severe-weather-history", "Severe Weather History", "History", "44"),
    ],
  },
  {
    id: "tools",
    label: "Tools & Data",
    icon: "Radar",
    pages: [
      p("radar-model-runs", "Radar & Model Runs", "Radar", "45"),
      p("river-flood-gauges", "River & Flood Gauges", "Droplets", "46"),
      p("3d-soundings", "3D Soundings", "Box", "47"),
      p("stormnet", "StormNet", "Network", "48"),
      p("traffic-cameras", "Traffic Cameras", "Cctv", "48", true),
    ],
  },
  {
    id: "specialty",
    label: "Specialty Monitoring",
    icon: "Telescope",
    pages: [
      p("star-gazing", "Star Gazing Forecast", "Star", "49"),
      p("astronomy", "Astronomy", "Moon", "50"),
      p("aurora-center", "Aurora Center", "Sparkles", "51"),
      p("lightning-monitoring", "Lightning Monitoring", "Zap", "52"),
    ],
  },
  {
    id: "edu",
    label: "Educational",
    icon: "GraduationCap",
    pages: [
      p("climatology", "Climatology", "ChartColumn", "54"),
      p("weather-glossary", "Weather Glossary", "BookA", "55"),
      p("free-content-library", "Free Content Library", "Library", "56"),
    ],
  },
  {
    id: "else",
    label: "Everything Else",
    icon: "Shapes",
    pages: [
      p("weather-patterns", "Weather Patterns", "Wind", "57"),
      p("extras", "Extras", "FlaskConical", "58–60"),
      p("disaster-response", "Disaster Response", "HeartHandshake", "61"),
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: "CircleUser",
    pages: [
      p("profile", "My Profile", "UserRound", "62"),
      p("settings", "Account Settings", "Settings", "62b"),
      p("notifications", "Notifications", "Bell", "63"),
      p("join", "Plans & Pricing", "Crown", "64"),
      p("login", "Login / Signup", "LogIn", "08"),
      p("admin", "Admin Panel", "ShieldCheck", "11", true),
    ],
  },
];

export const SECOND_NAV: NavGroup[] = [
  {
    id: "archive",
    label: "Tornado Archive",
    icon: "Archive",
    pages: [
      p("tornado-archive", "Official Tornado Archive", "Archive", "65–66"),
    ],
  },
  {
    id: "chaselog",
    label: "Chasing Log",
    icon: "Route",
    pages: [p("chasing-log", "Storm Chasing Log", "Route", "67")],
  },
];

export const ALL_PAGES: NavPage[] = [...MAIN_NAV, ...SECOND_NAV].flatMap(
  (g) => g.pages,
);

export const href = (page: NavPage) => `/${page.slug}`;

/** Groups as a given viewer may see them; signed-in members see "My Account" instead of sign-in. */
export function visibleNav(
  groups: NavGroup[],
  isAdmin: boolean,
  signedIn = false,
): NavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      pages: g.pages
        .filter((pg) => isAdmin || !pg.adminOnly)
        .map((pg) =>
          pg.slug === "login" && signedIn
            ? { ...pg, label: "My Account", icon: "UserRound" }
            : pg,
        ),
    }))
    .filter((g) => g.pages.length > 0);
}
