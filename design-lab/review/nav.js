/* The app's real menus (src/lib/nav/registry.ts), as a signed-in member sees them. */
const MAIN_NAV = [
  { id: "home", label: "Homepage", icon: "House", pages: [["Homepage", "House"]] },
  { id: "local", label: "Localized Data", icon: "MapPin", pages: [["Dashboard", "LayoutDashboard"], ["Daily Brief", "Mail"], ["Forecast Discussion", "MessageSquareText"], ["AQI & Pollen", "Flower2"], ["Mosquito Index", "Bug"], ["Daylight Tracker", "Sunrise"]] },
  { id: "community", label: "Community", icon: "Users", pages: [["WX Games", "Gamepad2"], ["Leaderboard", "Trophy"], ["Weekly Polls", "Vote"]] },
  { id: "severe", label: "Severe Weather", icon: "CloudLightning", pages: [["SSWXCon Score", "Gauge"], ["Warnings & Reports", "Siren"], ["SPC & Probability", "Map"], ["Mesoscale Discussions", "ScanEye"], ["Atmospheric Ingredients", "Atom"], ["Storm Timing Index", "Timer"], ["Tropical Outlook", "Orbit"], ["Hazards & Droughts", "ThermometerSun"], ["Flooding Outlook", "Waves"], ["Fire Weather", "Flame"], ["Winter Center", "Snowflake"], ["Storm Chasing Outlook", "Car"], ["Severe Weather History", "History"]] },
  { id: "tools", label: "Tools & Data", icon: "Radar", pages: [["Radar & Model Runs", "Radar"], ["River & Flood Gauges", "Droplets"], ["3D Soundings", "Box"]] },
  { id: "specialty", label: "Specialty Monitoring", icon: "Telescope", pages: [["Star Gazing Forecast", "Star"], ["Astronomy", "Moon"], ["Aurora Center", "Sparkles"], ["Lightning Monitoring", "Zap"]] },
  { id: "edu", label: "Educational", icon: "GraduationCap", pages: [["Climatology", "ChartColumn"], ["Weather Glossary", "BookA"], ["Free Content Library", "Library"], ["On This Day", "CalendarDays"]] },
  { id: "else", label: "Everything Else", icon: "Shapes", pages: [["Weather Patterns", "Wind"], ["Climate Extremes", "Thermometer"], ["Extras", "FlaskConical"], ["Disaster Response", "HeartHandshake"], ["Donate", "HandCoins"]] },
  { id: "account", label: "Account", icon: "CircleUser", pages: [["My Profile", "UserRound"], ["Account Settings", "Settings"], ["Notifications", "Bell"], ["Plans & Pricing", "Crown"], ["FAQ", "CircleHelp"], ["Contact Us", "Mail"], ["My Account", "UserRound"]] },
].map((g) => ({ ...g, pages: g.pages.map(([label, icon]) => ({ label, icon })) }));

/* The Quick Menu from your screenshot: the three chasing pages always, then your pins. */
const QUICK_NAV = [
  ["Storm Chasing Outlook", "Car"],
  ["Official Tornado Archive", "Archive"],
  ["Storm Chasing Log", "Route"],
  ["Daily Brief", "Mail"],
  ["WX Games", "Gamepad2"],
  ["Extras", "FlaskConical"],
].map(([label, icon]) => ({ id: label, label, icon, pages: [{ label, icon }] }));

const ALL_PAGES = MAIN_NAV.flatMap((g) => g.pages.map((p) => ({ ...p, group: g.label })));
