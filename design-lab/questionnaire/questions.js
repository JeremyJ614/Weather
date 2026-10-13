/* Step 3A questionnaire. Only questions not already settled in Sections A/B, the Theme Lab or chat.
   type: one = single choice, many = multiple choice, text = written answer. Every question also takes a note. */
const SECTIONS = [
  { id: "brand", title: "Brand & intro", qs: [
    { id: "appName", type: "one", q: "What name shows in the app header and on the phone's home screen?", opts: ["StormSync Weather", "SSWX Weather", "StormSync Media", "SSWX"] },
    { id: "appIcon", type: "one", q: "What should the app icon be?", opts: ["Tornado mascot from logo 1", "Lightning bolt from logo 2", "An SSWX monogram", "Let Claude design one from the logos"] },
    { id: "logo2", type: "many", q: "Where should the second (lightning) logo appear?", opts: ["Loading spinner", "Admin panel header", "Members Suite (later)", "Email briefs", "About page", "Nowhere yet"] },
    { id: "introLength", type: "one", q: "How long should the intro run?", help: "The full version is about 10 seconds.", opts: ["Full length", "Shortened to about 5 seconds", "Full on first launch, short after that"] },
    { id: "introWhen", type: "one", q: "When should the intro play? (Users can still turn it off.)", opts: ["Every time the app opens", "Once a day", "Only the very first launch"] },
    { id: "introSlow", type: "one", q: "On older, slower phones the 3D intro may stutter. What then?", opts: ["Play a lighter 2D version", "Skip it automatically", "Play it anyway"] }
  ] },
  { id: "access", title: "Accounts & access", qs: [
    { id: "login", type: "many", q: "Which ways can people sign in?", opts: ["Email and password", "Email sign-in link (no password)", "Google", "Apple", "Text message code"] },
    { id: "browse", type: "one", q: "What can people see without an account?", opts: ["Nothing, account required", "Homepage only", "All free pages; an account for the rest"] },
    { id: "signupFields", type: "many", q: "What should the signup form ask? (You can change this later in the admin panel.)", opts: ["Display name", "Username", "Email", "Phone", "ZIP code", "Birthday", "How they found us", "Weather experience level", "Are you a storm chaser?", "Profile photo"] },
    { id: "age", type: "one", q: "Minimum age to make an account?", opts: ["No minimum", "13+", "16+", "18+"] },
    { id: "publicName", type: "one", q: "On leaderboards and polls, what name shows?", opts: ["Username", "First name and last initial", "User chooses"] },
    { id: "roles", type: "text", q: "Roles planned: Free user, subscription tiers, SSWX Member, and Admin as a second role. Any other roles?" }
  ] },
  { id: "home", title: "Homepage & news", qs: [
    { id: "newsSources", type: "many", q: "Which sources should the automatic Weather News pull from? Headlines link back to the source.", opts: ["NWS", "SPC", "NHC", "NOAA news", "NASA Earth", "AP weather", "Reuters climate", "Fox Weather", "Weather.com headlines", "Local TV stations"] },
    { id: "newsTimes", type: "one", q: "When should Weather News refresh?", opts: ["7 AM and 5 PM", "6 AM and 6 PM", "Once at 7 AM", "Every 6 hours"] },
    { id: "newsRank", type: "one", q: "How should the top 15 stories be ordered?", opts: ["Most severe first", "Newest first", "AI ranks them by importance"] },
    { id: "newsAI", type: "one", q: "Add a short AI summary under each headline?", opts: ["Yes", "No"] },
    { id: "unreadGlow", type: "one", q: "When does an SSWX News post stop glowing as unread?", opts: ["When the user opens it", "After 7 days", "Whichever comes first"] },
    { id: "newMembers", type: "one", q: "Should App Updates announce new members by name?", opts: ["Yes", "Only if they opt in", "No"] }
  ] },
  { id: "local", title: "Localized data", qs: [
    { id: "location", type: "one", q: "How should the app find a user's location?", opts: ["Phone GPS", "ZIP code entry", "Either, user's choice"] },
    { id: "places", type: "one", q: "How many saved places per user?", opts: ["1", "3", "5", "More for paid tiers"] },
    { id: "units", type: "one", q: "Units?", opts: ["US units only (\u00b0F, mph, inches)", "User can switch to metric"] },
    { id: "widgets", type: "many", q: "Which dashboard widgets should exist? (Users can move, hide or add them.)", opts: ["Today", "7-day", "Hourly graph", "SPC level", "UV", "Mini radar", "Active alerts", "Sunrise and sunset", "Moon phase", "Wind", "Pressure trend", "Rain chance", "Feels like", "Dew point", "AQI", "Pollen", "Nearby lightning", "Rain totals", "Nearest river gauge", "Fire danger"] },
    { id: "briefContent", type: "many", q: "What goes in the Daily Brief?", opts: ["Today's forecast", "SPC risk for your area", "Active alerts", "Hourly rain timing", "AQI and pollen", "Sunrise and sunset", "What to wear", "SSWX News headline", "Tomorrow at a glance"] },
    { id: "briefChannels", type: "many", q: "Daily Brief channels at launch?", opts: ["In-app", "Push notification", "Email", "Text (you send these separately)"] },
    { id: "discussionLevel", type: "one", q: "How plain should the Simplified forecast discussion be?", opts: ["Everyday language", "For weather enthusiasts", "Let the user choose"] },
    { id: "office", type: "one", q: "Which forecast office's discussion shows?", opts: ["The user's local office, automatically", "User can pick any office"] }
  ] },
  { id: "community", title: "Community", qs: [
    { id: "gameRules", type: "text", q: "Forecast Game: keep the VIP rules, or what should change?" },
    { id: "triviaSource", type: "one", q: "Where do Daily Trivia questions come from?", opts: ["You write them", "AI drafts, you approve", "A mix"] },
    { id: "triviaCount", type: "one", q: "Trivia questions per day?", opts: ["1", "3", "5", "10"] },
    { id: "prizes", type: "one", q: "What do winners get?", opts: ["Badges and bragging rights", "Real prizes", "Both"] },
    { id: "weekStart", type: "one", q: "When does a leaderboard week start?", opts: ["Sunday", "Monday"] },
    { id: "tz", type: "one", q: "Which time zone runs the games and resets?", opts: ["Central", "Eastern", "Each user's own"] },
    { id: "pollResults", type: "one", q: "When can people see poll results?", opts: ["Before voting", "After they vote", "After the poll closes"] },
    { id: "raffles", type: "one", q: "Raffles?", opts: ["At launch", "Post-launch", "Not at all"] }
  ] },
  { id: "severe", title: "Severe weather", qs: [
    { id: "sswxcon", type: "text", q: "SSWXCon Score: keep the VIP formula, or what should change?" },
    { id: "warnPush", type: "one", q: "Push alerts for warnings in a user's area are for:", opts: ["Everyone, free", "Paid tiers", "SSWX Members"] },
    { id: "basins", type: "many", q: "Tropical basins to cover?", opts: ["Atlantic", "East Pacific", "Central Pacific", "West Pacific", "Indian Ocean"] },
    { id: "hazardLayers", type: "many", q: "Must-have layers on the interactive hazards map?", opts: ["Warnings", "Watches", "Advisories", "Radar", "Lightning", "Wildfires", "River gauges", "Road conditions", "Traffic cameras", "Earthquakes"] },
    { id: "historyRange", type: "one", q: "Default date range on Severe Weather History?", opts: ["Last 30 days", "Last 6 months", "Last year"] },
    { id: "chaseStats", type: "text", q: "Storm Chasing Outlook: which stats must carry over between days?" }
  ] },
  { id: "tools", title: "Tools & data", qs: [
    { id: "stormnet", type: "one", q: "StormNet, if they approve their API?", opts: ["Add it", "Skip it"] },
    { id: "deepmind", type: "many", q: "Google DeepMind: which interest you?", opts: ["WeatherNext AI forecasts", "AI hurricane track model (feeds the Battle Royale)", "Skip for now"] },
    { id: "cams", type: "one", q: "Traffic cameras?", opts: ["Include", "Post-launch", "Skip"] },
    { id: "radar", type: "many", q: "Radar products?", opts: ["Reflectivity", "Velocity", "MRMS composite", "Rain rate", "Hail size (MESH)", "Rotation tracks", "Satellite", "Lightning overlay"] },
    { id: "models", type: "many", q: "Model runs to show?", opts: ["HRRR", "NAM 3 km", "RAP", "GFS", "ECMWF (open data)", "NBM", "CMC", "ICON"] },
    { id: "soundingModels", type: "many", q: "3D Soundings from?", opts: ["Weather balloons (observed)", "HRRR", "RAP", "NAM 3 km", "GFS"] }
  ] },
  { id: "specialty", title: "Specialty & learning", qs: [
    { id: "stars", type: "one", q: "Star Gazing Forecast shows:", opts: ["The map only", "The map plus a score for your location"] },
    { id: "aurora", type: "one", q: "Aurora Center layout?", opts: ["One map with an interactive toggle", "Two tabs: image and interactive"] },
    { id: "lightning", type: "one", q: "Lightning Monitoring data?", opts: ["NOAA satellite lightning (free, 1\u20132 min delay)", "Also ask Blitzortung for permission (faster, needs their OK)"] },
    { id: "fairweather", type: "one", q: "FairWeather Tracking?", opts: ["At launch", "Post-launch", "Skip"] },
    { id: "climo3", type: "one", q: "Third Climatology tab?", opts: ["Hail", "Damaging wind", "Temperature records", "Snowfall", "Hurricanes", "None"] },
    { id: "glossary", type: "one", q: "Weather Glossary?", opts: ["Port as is", "Expand with AI-drafted entries you approve"] },
    { id: "library", type: "one", q: "Free Content Library?", opts: ["Copy the Academy content into this app", "Link out to the Academy"] }
  ] },
  { id: "else", title: "Everything else & account", qs: [
    { id: "extrasAccess", type: "one", q: "Who can see the Extras engines?", opts: ["Everyone", "Paid tiers", "SSWX Members"] },
    { id: "drOrgs", type: "text", q: "Disaster Response: which groups, teams or nonprofits should be listed at launch?" },
    { id: "drFields", type: "many", q: "Disaster Response sign-up form fields?", opts: ["Organization name", "Contact name", "Email", "Phone", "Website", "Areas served", "Services offered", "Logo upload", "Social links", "Description"] },
    { id: "profile", type: "many", q: "What shows on a user's profile?", opts: ["Game stats", "Badges", "Streaks", "Leaderboard history", "Saved places", "Chase logs", "Poll history", "Member since", "Subscription tier"] },
    { id: "notifs", type: "many", q: "Which notification types should users be able to switch on or off?", opts: ["Warnings for my area", "Watches", "SPC risk upgrades", "Daily Brief", "SSWX News", "Game results", "New trivia", "New polls", "Tropical updates", "Aurora alerts", "Engine alerts"] }
  ] },
  { id: "second", title: "Tornado Archive & Chasing Log", qs: [
    { id: "archiveScope", type: "one", q: "Which tornadoes go in the Official Tornado Archive?", opts: ["EF2+ since 2000", "EF1+ since 2000", "All ratings since 2000", "EF2+ since 2000 plus every EF4\u2013EF5 since 1950"] },
    { id: "archiveNew", type: "one", q: "New surveyed tornadoes from the NWS:", opts: ["Publish automatically", "Wait for your approval"] },
    { id: "logWho", type: "one", q: "Who can log chases in the Storm Chasing Log?", opts: ["All users", "Paid tiers", "SSWX Members"] },
    { id: "logVisibility", type: "one", q: "New chase logs are:", opts: ["Private until shared", "Public by default"] }
  ] },
  { id: "ops", title: "Admin & running the app", qs: [
    { id: "adminDevice", type: "one", q: "Where will you mostly use the admin panel?", opts: ["Phone", "Computer", "Both equally"] },
    { id: "otherAdmins", type: "text", q: "Who else should be an admin at launch, and what should they control?" },
    { id: "testUsers", type: "one", q: "May I create test accounts in the live database to test every page (deleted afterwards)?", opts: ["Yes", "No"] },
    { id: "mainBranch", type: "one", q: "The Weather repo has no main branch yet. May I create `main` as the production branch?", opts: ["Yes", "No"] },
    { id: "analytics", type: "one", q: "Visitor analytics?", opts: ["Vercel Analytics (free tier)", "Our own, stored in Supabase", "None"] },
    { id: "errors", type: "one", q: "Error tracking?", opts: ["Our own, shown in the admin panel", "Sentry free tier", "None"] }
  ] },
  { id: "feel", title: "Feel", qs: [
    { id: "motion", type: "one", q: "Default animation level? (It always tones down on slow phones and for people who turn motion off.)", opts: ["Maximum", "Balanced", "Subtle"] },
    { id: "haptics", type: "one", q: "Small vibrations on taps (Android)?", opts: ["Yes", "No", "User setting, off by default"] },
    { id: "sound", type: "one", q: "Sound effects?", opts: ["None", "Subtle, user can turn off", "User setting, off by default"] },
    { id: "anything", type: "text", q: "Anything else I should know before writing the BuildPlan?" }
  ] }
];
