/**
 * One line on each page for the intro guides (tap a page chip to read it), and the
 * interests the guest showcase offers to pick from.
 */
export const ABOUT: Record<string, string> = {
  "": "Your start screen: the Weather Clock, conditions where you are, Weather News and today's highlights.",
  dashboard:
    "The full picture for your place: now, hourly, 10 days, radar and alerts, with cards you can rearrange.",
  "daily-brief":
    "Today in a minute: what to expect and what to watch, emailed each morning if you like.",
  "forecast-discussion":
    "Your NWS office's forecast discussion, with a plain-words version beside the original.",
  "aqi-pollen":
    "Air quality and pollen for your place, and what's driving them.",
  "mosquito-index":
    "How bad mosquitoes should be, from temperature, humidity and recent rain.",
  "daylight-tracker":
    "Sunrise, sunset and how much daylight you're gaining or losing.",
  "wx-games":
    "A daily forecast game scored against what actually happens, plus weather trivia.",
  leaderboard: "Everyone's points from the games and trivia.",
  "weekly-polls": "A new weather question every week, with the results live.",
  sswxcon:
    "How stormy the whole country is right now, on one 0–250 score, and what's driving it.",
  "warnings-reports":
    "Every live warning and watch on one map, with storm reports as they come in.",
  "spc-probability":
    "SPC's outlooks for days 1–8: threat levels, tornado, hail and wind chances and their intensity.",
  "mesoscale-discussions":
    "SPC's short-fused discussions: what forecasters are watching in the next few hours.",
  "atmospheric-ingredients":
    "CAPE, shear, helicity and more, hour by hour for your place, and when they line up.",
  "storm-timing-index":
    "When storms are most dangerous where you are, for how long, and whether it's after dark.",
  "tropical-outlook":
    "NHC's outlook, every active storm with its cone and graphics, model tracks side by side, worldwide storms and past seasons.",
  "hazards-droughts":
    "CPC's 3–14 day hazards and the U.S. Drought Monitor, with your state's drought trend.",
  "flooding-outlook":
    "Excessive rainfall risk, expected rain totals and flood alerts.",
  "fire-weather":
    "SPC's fire outlooks, active fires with containment, and red flag warnings.",
  "winter-center":
    "Snow and ice odds, winter alerts and the setup behind them.",
  "storm-chasing-outlook":
    "The day's two best chase targets, at least 125 miles apart, with timing, storm mode and how the day could bust.",
  "severe-weather-history":
    "Every surveyed tornado and storm report by year or window, on the map and in numbers.",
  "radar-model-runs":
    "Live radar and HRRR, GFS and HREF maps drawn from NOAA's data, plus a side-by-side model comparison.",
  "river-flood-gauges":
    "River gauges with their forecast crests and flood stages.",
  "3d-soundings":
    "Balloon and model soundings as a Skew-T, a hodograph and a 3D column you can spin.",
  "traffic-cameras": "Live road, weather and wildfire cameras.",
  "star-gazing":
    "Tonight's viewing score: clouds, moon, darkness and what's worth looking at.",
  astronomy: "The moon, the planets and what's up in the sky.",
  "aurora-center":
    "Where the aurora could reach tonight, the Kp forecast and the solar wind.",
  "lightning-monitoring": "Live lightning strikes and hotspots near you.",
  climatology:
    "Records and averages for your place, and tornado, hurricane and lightning climatology.",
  "weather-glossary": "Any weather word explained in plain language.",
  "free-content-library": "Free lessons and guides on how weather works.",
  "weather-patterns":
    "What already happened (yesterday, the week, the month, the season) in plain words with the numbers behind it.",
  extras:
    "Weather Engines drawn like SPC outlooks (ProbTor, ProbHail, rotation tracks, snow squalls and more), the Storm Visualizer and Particle Morph.",
  "disaster-response":
    "Organizations that help after storms and how to give to them or help them, plus a map of emergency shelters near you.",
  donate:
    "Support StormSync with a one-time or monthly gift of any amount, and join the supporters wall.",
  profile: "Your places, your badges and your titles.",
  settings: "Your menus, Quick Menu, theme and this tour, any time.",
  notifications:
    "Which alerts reach your phone, for which places, and your quiet hours.",
  join: "The plans, and add any single page to yours.",
  faq: "Answers to the questions people ask most.",
  contact: "Send us a message; it reaches the team straight away.",
  "tornado-archive":
    "Replay famous tornadoes: radar, warnings, the damage path and reports, minute by minute.",
  "chasing-log":
    "Log a chase: pick the day's storms or draw your route, and replay it against the radar.",
};

/** The showcase's "What brings you here?" choices, each with the pages it suggests. */
export const INTERESTS: {
  id: string;
  icon: string;
  label: string;
  pages: string[];
}[] = [
  {
    id: "severe",
    icon: "CloudLightning",
    label: "Severe storms",
    pages: [
      "sswxcon",
      "warnings-reports",
      "spc-probability",
      "storm-timing-index",
    ],
  },
  {
    id: "chase",
    icon: "Car",
    label: "Storm chasing",
    pages: [
      "storm-chasing-outlook",
      "atmospheric-ingredients",
      "chasing-log",
      "tornado-archive",
    ],
  },
  {
    id: "tropics",
    icon: "Orbit",
    label: "Hurricanes",
    pages: ["tropical-outlook", "flooding-outlook", "river-flood-gauges"],
  },
  {
    id: "winter",
    icon: "Snowflake",
    label: "Winter",
    pages: ["winter-center", "hazards-droughts"],
  },
  {
    id: "sky",
    icon: "Telescope",
    label: "Night sky",
    pages: [
      "star-gazing",
      "aurora-center",
      "astronomy",
      "lightning-monitoring",
    ],
  },
  {
    id: "daily",
    icon: "MapPin",
    label: "My daily forecast",
    pages: ["dashboard", "daily-brief", "aqi-pollen", "daylight-tracker"],
  },
  {
    id: "learn",
    icon: "GraduationCap",
    label: "Learning & games",
    pages: [
      "wx-games",
      "weather-glossary",
      "free-content-library",
      "climatology",
    ],
  },
];
