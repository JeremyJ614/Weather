/* Section A data. Menu contents come straight from the Final Projects Outline.
   Post-launch items are left out of both menus, as the outline asks. */

const MAIN_MENU = [
  { id: "home", label: "Homepage", icon: "home", items: [
    { label: "Weather News", icon: "news" },
    { label: "SSWX News", icon: "megaphone" },
    { label: "App Updates", icon: "sparkles" } ] },
  { id: "local", label: "Localized Data", icon: "cloudsun", items: [
    { label: "Dashboard", icon: "dash" },
    { label: "Daily Brief", icon: "mail" },
    { label: "Forecast Discussion", icon: "doc" },
    { label: "AQI & Pollen", icon: "flower" },
    { label: "Mosquito Index", icon: "bug" },
    { label: "Daylight Tracker", icon: "sunrise" } ] },
  { id: "community", label: "Community", icon: "users", items: [
    { label: "WX Games", icon: "game" },
    { label: "Leaderboard", icon: "trophy" },
    { label: "Weekly Polls", icon: "vote" },
    { label: "Raffles", icon: "ticket" } ] },
  { id: "severe", label: "Severe Weather", icon: "bolt", items: [
    { label: "SSWXCon Score", icon: "gauge" },
    { label: "Warnings & Reports", icon: "alert" },
    { label: "SPC & Probability", icon: "map" },
    { label: "Mesoscale Discussions", icon: "doc" },
    { label: "Atmospheric Ingredients", icon: "atom" },
    { label: "Storm Timing Index", icon: "clock" },
    { label: "Tropical Outlook", icon: "orbit" },
    { label: "Hazards & Droughts", icon: "thermsun" },
    { label: "Flooding Outlook", icon: "waves" },
    { label: "Fire Weather", icon: "flame" },
    { label: "Winter Center", icon: "snow" },
    { label: "Storm Chasing Outlook", icon: "car" },
    { label: "Severe Weather History", icon: "history" } ] },
  { id: "tools", label: "Tools & Data", icon: "radar", items: [
    { label: "Radar & Model Runs", icon: "radar" },
    { label: "River & Flood Gauges", icon: "drops" },
    { label: "StormNet", icon: "brain" },
    { label: "Google DeepMind", icon: "sparkles" },
    { label: "3D Soundings", icon: "box" },
    { label: "Traffic Cameras", icon: "camera" } ] },
  { id: "specialty", label: "Specialty Monitoring", icon: "telescope", items: [
    { label: "Star Gazing Forecast", icon: "star" },
    { label: "Astronomy", icon: "moon" },
    { label: "Aurora Center", icon: "sparkles" },
    { label: "FairWeather Tracking", icon: "sun" },
    { label: "Lightning Monitoring", icon: "zap" } ] },
  { id: "edu", label: "Educational", icon: "book", items: [
    { label: "Climatology", icon: "chart" },
    { label: "Weather Glossary", icon: "book" },
    { label: "Free Content Library", icon: "library" } ] },
  { id: "else", label: "Everything Else", icon: "shuffle", items: [
    { label: "Weather Patterns", icon: "wind" },
    { label: "Extras", icon: "flask" },
    { label: "Disaster Response", icon: "heart" } ] },
  { id: "account", label: "Account", icon: "user", items: [
    { label: "My Profile", icon: "user" },
    { label: "Login / Signup", icon: "login" },
    { label: "Notifications", icon: "bell" },
    { label: "Admin Panel", icon: "shield" } ] }
];

/* The purple menu. Storefront, Other and Members Suite are post-launch,
   so only these two launch with the app. */
const SECOND_MENU = [
  { id: "archive", label: "Tornado Archive", icon: "archive", items: [
    { label: "Official Tornado Archive", icon: "archive" } ] },
  { id: "chaselog", label: "Chasing Log", icon: "route", items: [
    { label: "Storm Chasing Log", icon: "route" } ] }
];

/* A4: fifteen themes. Each is only a token set; nothing else changes. */
const THEMES = [
  { id: "royal", name: "StormSync Royal", note: "The logo's metal and violet, with periwinkle as the action color.",
    t: { bg: "#0c0a16", surface: "#16132a", surface2: "#201c3a", line: "#2f2a52", text: "#ecebfa", muted: "#9f9cc2", accent: "#8e9bff", accent2: "#b07bff", metal: "#c3c6d4" } },
  { id: "monarch", name: "Midnight Monarch", note: "Navy court colors: royal blue with a gold seal.",
    t: { bg: "#070b18", surface: "#0f1630", surface2: "#16204a", line: "#24305f", text: "#eef1fb", muted: "#97a1c6", accent: "#4f7dff", accent2: "#f2c14e", metal: "#c9cfdf" } },
  { id: "amethyst", name: "Amethyst Crown", note: "Plum black, amethyst and rose gold.",
    t: { bg: "#120a14", surface: "#1d1222", surface2: "#2a1a31", line: "#3c2647", text: "#f6ecf6", muted: "#b79ab9", accent: "#c07bff", accent2: "#f0a98e", metal: "#d8c4cf" } },
  { id: "obsidian", name: "Obsidian Velvet", note: "Glossy black with magenta and cool silver.",
    t: { bg: "#08080b", surface: "#121218", surface2: "#1b1b24", line: "#2a2a36", text: "#f2f2f7", muted: "#9d9db0", accent: "#ff4fb8", accent2: "#b6bccb", metal: "#cfd2dc" } },
  { id: "sapphire", name: "Sapphire Court", note: "Deep teal-navy, sapphire and champagne.",
    t: { bg: "#06111a", surface: "#0c1b28", surface2: "#122838", line: "#1d3a4f", text: "#e9f4fb", muted: "#8fb0c4", accent: "#3fb6ff", accent2: "#e9cf9a", metal: "#c6d5de" } },
  { id: "emerald", name: "Emerald Regent", note: "Forest black with emerald and old gold.",
    t: { bg: "#061109", surface: "#0d1c12", surface2: "#14291a", line: "#1f3d27", text: "#ecf7ef", muted: "#93b39c", accent: "#34d683", accent2: "#e4b84b", metal: "#c8d6cc" } },
  { id: "crimson", name: "Crimson Throne", note: "Wine and ivory gold. Red here is decoration, so warnings would move to amber.",
    t: { bg: "#12070a", surface: "#1e0d12", surface2: "#2b131a", line: "#431d28", text: "#fbeeee", muted: "#c19ca2", accent: "#ff5b6e", accent2: "#f3d38b", metal: "#dccbc9" } },
  { id: "nebula", name: "Pastel Nebula", note: "Dark slate with pastel lavender and mint.",
    t: { bg: "#11121a", surface: "#1a1c28", surface2: "#242738", line: "#33374d", text: "#f1f1fa", muted: "#a6a9c2", accent: "#c3b5ff", accent2: "#a6f0d0", metal: "#cfd1df" } },
  { id: "aurora", name: "Pastel Aurora", note: "Polar night with soft teal and pink, like a quiet aurora.",
    t: { bg: "#0a1220", surface: "#111c2f", surface2: "#18263e", line: "#253656", text: "#eef4ff", muted: "#9db0cc", accent: "#8ff0e0", accent2: "#ffb4d6", metal: "#c9d4e4" } },
  { id: "dusk", name: "Pastel Dusk", note: "Mauve evening with peach and periwinkle.",
    t: { bg: "#150f17", surface: "#201723", surface2: "#2c2030", line: "#3f2e45", text: "#f8eff6", muted: "#bfa6b9", accent: "#ffc29e", accent2: "#aab4ff", metal: "#dacbd5" } },
  { id: "frost", name: "Pastel Frost", note: "Blue-gray winter with ice blue and lilac.",
    t: { bg: "#0e131a", surface: "#161d27", surface2: "#1f2834", line: "#2d3a4a", text: "#eef4fa", muted: "#a2b1c2", accent: "#a9dcff", accent2: "#d7c2ff", metal: "#d3dbe4" } },
  { id: "stormcell", name: "Storm Cell", note: "Charcoal radar screen with electric cyan and violet.",
    t: { bg: "#0b0d10", surface: "#14171c", surface2: "#1d2128", line: "#2b313b", text: "#eef2f6", muted: "#9aa4b2", accent: "#2ee6ff", accent2: "#9b6bff", metal: "#c5ccd6" } },
  { id: "supercell", name: "Supercell Neon", note: "Black with hot pink and cyan for maximum punch.",
    t: { bg: "#050507", surface: "#0f0f15", surface2: "#191924", line: "#272738", text: "#f7f5ff", muted: "#a3a0bd", accent: "#ff3da6", accent2: "#33e1ff", metal: "#cbcbd8" } },
  { id: "gilded", name: "Gilded Night", note: "Black tie: gold leaf on ink with white type.",
    t: { bg: "#0a0907", surface: "#15130f", surface2: "#201d17", line: "#352f24", text: "#faf6ee", muted: "#b5ab98", accent: "#e8be5a", accent2: "#f5e6c2", metal: "#d8d0bf" } },
  { id: "silver", name: "Twilight Silver", note: "Graphite and brushed silver, finishing in periwinkle. Closest to the gray-to-periwinkle brand line.",
    t: { bg: "#0d0e12", surface: "#17191f", surface2: "#21242c", line: "#30343f", text: "#f0f1f5", muted: "#a3a7b4", accent: "#9aa8ff", accent2: "#c9ccd6", metal: "#d6d8e0" } }
];

/* A3: 25 admin panel additions beyond the outline's own requests. */
const ADMIN_EXTRAS = [
  ["Live ops console", "One screen with active users, open alerts, failing data feeds and error counts, refreshing on its own."],
  ["Data feed health board", "Every upstream source (NWS, SPC, NHC, MRMS, USGS) with last-success time, latency and a red/green state."],
  ["Kill switches per module", "Turn any page off instantly with an honest maintenance notice if its data source breaks."],
  ["Push notification composer", "Write, target by state or role, preview on a phone frame, schedule and send push alerts."],
  ["Audit log", "Who changed what, when, from which device, for every admin action. Read-only and append-only."],
  ["Role and permission matrix", "A grid of admins by panel sections with toggles, matching your request for scoped admin access."],
  ["User lookup and impersonation view", "Search any user and see the app exactly as they see it, read-only, to debug complaints."],
  ["Subscription and revenue dashboard", "MRR, churn, trials converting, failed payments and refunds pulled from Stripe."],
  ["Coupon and promo code builder", "Create percent or fixed discounts, limit by date, tier or number of uses."],
  ["Feature flags", "Release a new page to admins, then members, then everyone, without redeploying."],
  ["Content calendar", "See scheduled SSWX News posts, polls, trivia days and briefs on one calendar."],
  ["Media library", "Upload, crop and reuse images and video for news posts and the homepage."],
  ["Homepage story curation", "Pin, hide or reorder the auto-pulled top 15 weather stories."],
  ["AI usage meter", "Gemini calls per feature per day against the free quota, with a warning before it runs out."],
  ["Error and crash inbox", "Client errors grouped by page and device so bugs show up before users report them."],
  ["Performance monitor", "Real load times by page and device tier, so slow pages are found on real phones."],
  ["Moderation queue", "Flag, hide or restore usernames, forum posts and Disaster Response submissions."],
  ["Ban, mute and warn tools", "Graduated actions with reasons and expiry dates, all logged."],
  ["Brief delivery report", "How many Daily Briefs went out by channel, opens, bounces and unsubscribes."],
  ["Theme and branding controls", "Pick the default theme, swap logos and set seasonal accents without code."],
  ["Signup funnel analytics", "Where people drop off in signup and which priced options they add or remove."],
  ["Game integrity tools", "Spot duplicate accounts or impossible scores in WX Games before points are awarded."],
  ["Scheduled maintenance banner", "Post a dated banner that appears and clears on its own."],
  ["Data export", "Download users, subscribers, poll results and game standings as CSV."],
  ["Backup and restore points", "Snapshot settings and content before big edits and roll back with one action."]
];

/* A5: ten pricing structures. Figures are starting suggestions. */
const PRICING = [
  { id: "freemium", name: "Free + Premium", line: "One free tier, one paid tier.",
    tiers: [["Free", "$0", "Homepage, dashboard, radar, SPC, news"], ["Premium", "$4.99/mo", "Everything else, briefs, games prizes, no limits"]],
    good: "Easiest to understand and build.", watch: "One price leaves money on the table with heavy users." },
  { id: "three", name: "Three tiers", line: "Free, Plus and Pro, priced to push people to the middle.",
    tiers: [["Free", "$0", "Core weather"], ["Plus", "$3.99/mo", "Severe suite, briefs, games"], ["Pro", "$8.99/mo", "Extras engines, 3D soundings, priority alerts"]],
    good: "The classic layout most apps use; the middle tier carries revenue.", watch: "Needs a clear reason to pay for Pro." },
  { id: "season", name: "Storm Season Pass", line: "Free all year, with a paid pass for peak season.",
    tiers: [["Free", "$0", "Core weather"], ["Spring Pass", "$14.99 (Mar to Jul)", "Full severe and chasing suite"], ["Hurricane Pass", "$9.99 (Jun to Nov)", "Full tropical suite"]],
    good: "Matches when people care most and feels fair.", watch: "Revenue is seasonal." },
  { id: "annual", name: "Monthly or yearly", line: "Any tier, with two months free on yearly.",
    tiers: [["Monthly", "$4.99/mo", "Cancel anytime"], ["Yearly", "$49.99/yr", "Two months free"]],
    good: "Yearly plans cut churn a lot.", watch: "Pair it with one of the other models." },
  { id: "builder", name: "Build your plan", line: "Base price plus modules, with the live price tracker on signup.",
    tiers: [["Base", "$1.99/mo", "Core weather"], ["+ Severe Suite", "+$1.99", "SPC, warnings, MDs, timing"], ["+ Tropical", "+$0.99", "NHC, battle royale"], ["+ Space", "+$0.99", "Aurora, stars, astronomy"], ["+ Extras Lab", "+$1.49", "Experimental engines"]],
    good: "Fits your idea of a price that climbs as they click options.", watch: "Too many choices can stall signups; cap it at five modules." },
  { id: "founder", name: "Founders lifetime", line: "A limited number of lifetime memberships at launch.",
    tiers: [["Founder", "$59 once", "Everything, forever, founder badge"], ["Then", "$4.99/mo", "Regular price after the cap"]],
    good: "Raises cash early to fund the build.", watch: "Lifetime users never pay again; cap the count (say 250)." },
  { id: "supporter", name: "Pay what you want", line: "Everything free, with optional supporter levels.",
    tiers: [["Free", "$0", "Everything"], ["Supporter", "$2 to $20/mo", "Badge, name on supporters wall, early access"]],
    good: "Maximum reach and goodwill.", watch: "Usually only 1 to 3 percent pay." },
  { id: "credits", name: "Credits for AI", line: "Core is free; AI features use monthly credits.",
    tiers: [["Free", "$0", "20 AI credits/mo"], ["Credit pack", "$2.99", "200 credits"], ["Unlimited", "$6.99/mo", "No credit limit"]],
    good: "Ties price to the one feature that costs you money.", watch: "Credits add friction and confusion." },
  { id: "family", name: "Household and team", line: "Shared plans for families and chase teams.",
    tiers: [["Solo", "$4.99/mo", "1 account"], ["Household", "$7.99/mo", "Up to 5 accounts"], ["Chase Team", "$14.99/mo", "Up to 10 accounts, shared chase logs"]],
    good: "Groups churn less and spread by word of mouth.", watch: "Needs account linking." },
  { id: "alerts", name: "Alert tiers", line: "Priced by how personal the warnings get, matching your Personal Warnings plan.",
    tiers: [["Basic", "$0", "Standard in-app alerts"], ["Personal", "$2.99/mo", "Custom alerts for your saved places"], ["Direct Line", "$19.99/mo", "Direct contact with the team during events"]],
    good: "Clear value for people who need it most.", watch: "Direct Line needs staff time during outbreaks." }
];

/* ---------- Section B ---------- */
const B1_DECISIONS = [
  { id: "hosting", q: "When subscriptions start, where should the app live?", why: "Vercel's free plan does not allow selling. Cloudflare Pages stays free and allows it.",
    opts: [["vercelpro", "Vercel Pro, $20/mo"], ["cloudflare", "Move to Cloudflare Pages, free"], ["later", "Decide when we start charging"]] },
  { id: "sms", q: "Text-message briefs cost about 1 cent each. What should we do?", why: "Email, push and in-app briefs are free.",
    opts: [["skip", "Launch without SMS"], ["later", "Add SMS once revenue covers it"], ["now", "Pay for SMS from launch"]] },
  { id: "iphone", q: "How should iPhone users install the app?", why: "A file install is not possible on iPhone without Apple's $99/yr program.",
    opts: [["pwa", "Add to Home Screen (free)"], ["appstore", "App Store ($99/yr)"], ["both", "Home Screen now, App Store later"]] },
  { id: "android", q: "How should Android users install it?", why: "An .apk file installs directly and is free. Google Play is a one-time $25.",
    opts: [["apk", ".apk file only (free)"], ["play", "Google Play ($25 once)"], ["both", ".apk now, Google Play later"]] },
  { id: "engines", q: "How often should Extras engines update?", why: "GitHub Actions is free; faster updates use more of the free minutes.",
    opts: [["hourly", "Hourly (fits free limits)"], ["30", "Every 30 min during storm season"], ["10", "Every 10 min (needs a paid runner)"]] }
];
const B1_FREE = [
  ["Hosting", "Vercel Hobby", "Free while nothing is sold"],
  ["Database & logins", "Supabase Free", "500 MB, 50k monthly users, pauses after 7 idle days"],
  ["AI", "Gemini free tier", "Rate-limited; results are cached"],
  ["Weather data", "NWS, SPC, WPC, CPC, NHC, USGS, MRMS, GOES, HRRR, IEM, SWPC", "Free"],
  ["Maps", "MapLibre + free basemaps", "No key, no limit"],
  ["Email briefs", "Resend", "3,000 a month, 100 a day"],
  ["Push alerts", "Web Push", "Free and unlimited"],
  ["Payments", "Stripe", "No monthly fee, about 2.9% + 30¢ per sale"],
  ["Python engines", "GitHub Actions", "Free on public repos, 2,000 min/mo private"],
  ["Domain", "Weather.SSWX.Space", "Already owned"]
];
const B2_ENGINES = [
  ["probtor", "ProbTor 0–60 min tornadogenesis", "Buildable", "Good at 0–20 min, weak past 30", "Built on NOAA's free ProbSevere tornado probabilities, plus AzShear trend and lightning jumps, projected along storm motion as cones."],
  ["probhail", "ProbHail 2\"+ swath & size", "Buildable", "Good 0–30 min", "MESH plus storm motion gives a reliable short swath, shown as probability bands for 1\", 1.75\" and 2.5\"+."],
  ["ci", "Convective Initiation 90-min", "Buildable", "Fair", "GOES cloud-top cooling, HRRR cap erosion and first radar echoes, as fuzzy 30/60/90-min areas."],
  ["merger", "Supercell Merger & Boundary Interaction", "Hard", "Experimental only", "Can flag a likely interaction and its timing; predicting good vs bad outcome is research-level, so no outcome label."],
  ["llj", "Nocturnal Low-Level Jet Ramp-Up", "Buildable", "Good", "HRRR/RAP 850 and 925 mb winds, low-level helicity and instability overnight."],
  ["derecho", "Derecho & Bow Echo Corridor", "Buildable", "Fair at 6–12 h", "Shear, DCAPE and Corfidi vectors make the corridor; radar notches only describe storms already there."],
  ["dryline", "Dryline Bulge & Triple Point", "Buildable", "Fair", "Finds the dryline from HRRR moisture gradients and shades probability, not exact counties."],
  ["photogenic", "Photogenic Supercell & Viewshed", "Buildable", "Entertainment, not verifiable", "A 0–100 Structure Score from cloud base height, rain efficiency, anvil winds and sun angle."],
  ["pyrocb", "Wildfire Blowup & PyroCb", "Buildable", "Fair", "GOES fire heat output and smoke, plus the Hot-Dry-Windy Index and dry soundings."],
  ["blindspot", "Radar Horizon Blind Spot", "Buildable", "High (it is geometry)", "Beam height from Earth curvature and terrain, computed once per radar. Cheapest and most trustworthy."],
  ["svc", "Streamwise Vorticity Current Mapper", "Buildable", "Experimental", "HRRR's 3 km grid blurs the small features it looks for, so it is a research layer."],
  ["nsv", "Non-Supercell Landspout & Waterspout", "Buildable", "Fair", "Close to SPC's proven Non-Supercell Tornado parameter."]
];
const B3_ENGINES = [
  ["ljump", "Lightning Jump Alert", "A sudden rise in a storm's flash rate, often 10–20 minutes before severe weather."],
  ["rottrack", "Rotation Track Persistence", "MRMS rotation tracks drawn as glowing trails showing which storms keep rotating."],
  ["training", "Training Storms & Flash Flood Corridor", "Finds storms crossing the same ground again and again."],
  ["burnscar", "Burn Scar Debris-Flow Watch", "Heavy rain rates over recent wildfire burn scars."],
  ["capbust", "Cap Bust Meter", "How likely a big setup underperforms, from model spread in the cap and timing."],
  ["recovery", "Airmass Recovery Clock", "A countdown to when instability returns after morning storms."],
  ["intercept", "Chaser Intercept Planner", "Storm motion plus the road network gives the best roads and timing to intercept."],
  ["downburst", "Downburst & Microburst Potential", "Microburst index from DCAPE, moisture and lapse rates."],
  ["hailfoot", "Hail Damage Footprint", "Past hail swaths over population, feeding Disaster Response."],
  ["squall", "Snow Squall Threat", "SPC's Snow Squall Parameter mapped hourly for drivers."],
  ["ice", "Freezing Rain Accretion", "Ice thickness with power-outage risk tiers."],
  ["fog", "Dense Fog for Drivers", "Satellite night fog plus visibility along interstates."],
  ["ri", "Tropical Rapid Intensification Watch", "Ocean heat and shear for the Tropical Battle Royale."],
  ["tctor", "Landfalling Hurricane Tornado Risk", "Shear and helicity in a landfalling storm's outer bands."],
  ["heatburst", "Heat Burst & Wake Low Detector", "Sudden overnight temperature spikes and pressure falls."]
];
const B4_PHASES = [
  ["Planning", ["Section A lab", "Section B answers and phase list", "Questionnaire", "Full BuildPlan with bug & glitch log"]],
  ["Foundation", ["Project skeleton, checks, CI, performance budget", "Vercel, Supabase, secrets, domain", "Installable app: PWA, icons, offline, splash", "Design system and motion rules", "StormSync Media intro as launch screen", "Main menu with every launch page routed", "Second menu", "Accounts and Row Level Security", "Roles and subscription tiers", "Saved location and shared weather-data layer"]],
  ["Admin Panel", ["Admin shell, admins and permissions, audit log", "News & Announcements editor", "Chosen admin extras, part 1", "Chosen admin extras, part 2"]],
  ["Homepage", ["Weather News (top 15, auto)", "SSWX News with unread glow", "App Updates"]],
  ["Localized Data", ["Dashboard widgets", "Dashboard: WPC subtab", "Dashboard: CPC and Fall Forecast subtabs", "Daily Brief", "Forecast Discussion (Simplified + Standard)", "AQI & Pollen", "Mosquito Index", "Daylight Tracker"]],
  ["Community", ["Forecast Game", "Daily Trivia + admin editor", "Leaderboard + admin points and past winners", "Weekly Polls + admin scheduling", "Raffles (if confirmed)"]],
  ["Severe Weather", ["SSWXCon Score", "Warnings & Reports", "SPC & Probability", "Mesoscale Discussions", "Atmospheric Ingredients", "Storm Timing Index", "Tropical Outlook", "Tropical Model Battle Royale", "Hazards & Droughts + interactive hazards map", "Flooding Outlook", "Fire Weather with active wildfires", "Winter Center", "Storm Chasing Outlook with lasting stats", "Severe Weather History, rebuilt for speed"]],
  ["Tools & Other Data", ["Radar & Model Runs", "River & Flood Gauges + top 5", "3D Soundings map", "StormNet, DeepMind, Traffic Cameras (if confirmed)"]],
  ["Specialty Monitoring", ["Star Gazing map", "Astronomy", "Aurora Center", "Lightning Monitoring", "FairWeather Tracking (if confirmed)"]],
  ["Educational", ["Climatology", "Weather Glossary", "Free Content Library"]],
  ["Everything Else", ["Weather Patterns", "Extras: engine pipeline", "Extras: first engines", "Extras: next engines", "Disaster Response + admin inbox"]],
  ["Account", ["My Profile", "Notifications center", "Signup with live price tracker and Stripe"]],
  ["Second menu", ["Tornado Archive: data pipeline", "Tornado Archive: replay", "Storm Chasing Log"]],
  ["Finish", ["Bug, glitch, performance and style sweep", "Full walkthrough as a real user", "Packaging and launch"]]
];
