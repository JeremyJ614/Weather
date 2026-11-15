# Post-launch list (2026-11-15)

Generated from `design-lab/post-launch/data/` by `node design-lab/post-launch/build-md.mjs`. The owner picks in the Post-Launch Lab (artifact db doc `postlaunch/picks`); nothing here is built until picked.

## A1. What I'd upgrade in the app

I went back over the whole app: 48 pages, 20 Weather Engines, 13 Randoms, about 30 admin sections, the menus, plans and the server jobs. It is in strong shape: every page meets the design bar, the guest front door and SEO are in, and the last sweep found no errors. These are the parts I would still make better, most important first. Each one is a change to something we already have, not a new page.

### A1.1 Never get paused by Vercel again (Hosting)

On 2 November Vercel paused the site for going over the free plan. Most of that load is server work that doesn't need Vercel: engine maps, model frames and the scheduled jobs. I'd move the scheduled heavy work to free GitHub Actions runs (free and unlimited once the engines repo is public, which was already the plan) that write finished maps to Supabase Storage, so Vercel only serves pages. Add a daily usage estimate in admin → System health with a warning at 70%.

- Pros: The biggest risk to the app (going dark) mostly goes away; Room to grow members without paying for Pro; Engine maps get faster because they're ready before anyone asks
- Cons: Needs the engines repo public and Actions billing restored; One more place where jobs run (GitHub as well as Supabase)
- Effort: Medium
- Impact: 5/5

### A1.2 Speed limits on the app's data routes (Security & cost)

None of the 40-plus /api routes has a request limit. One script hammering an engine or model route could burn the free plan in an afternoon. I'd add a small per-visitor limit in our own code on the heaviest routes (free, no service needed), with a friendly 'slow down' answer.

- Pros: Protects the free plan from bots and scrapers; Stops one person from slowing the app for everyone
- Cons: Limits must be loose enough that a storm-day crowd never hits them
- Effort: Small
- Impact: 5/5

### A1.3 Turn the automatic checks back on (Reliability)

Every GitHub Actions check has failed before starting since 30 October (no runner, a billing problem on the account), so pull requests merge with no automatic test run. Checks pass locally, but nothing stops a bad merge. Once billing is restored (or the repo is public), I'd add a Playwright smoke test of the 10 most-used pages to the checks.

- Pros: A broken page can't reach members by accident; Smoke tests catch what typecheck can't (blank maps, crashes)
- Cons: Owner step: fix the Actions billing; Adds a few minutes to each pull request
- Effort: Small
- Impact: 4/5

### A1.4 An owner checklist that checks itself (Admin)

About ten one-time owner steps are scattered through BUILD_STATUS: the Weatherdle view-as migration, the database policy merge, Google and Bing verification codes, the Supabase email templates, the AirNow and Pollen keys, the Stripe portal, the leftover test user. I'd put them in admin as a checklist where each line tests itself (is the key set, is the migration in, does the sitemap answer) and turns green on its own.

- Pros: Nothing important stays half-finished; You see at a glance what's left and why it matters
- Cons: A few checks can only say 'not detected', not why
- Effort: Small
- Impact: 4/5

### A1.5 One chart system for the whole app (Look)

There are about 40 hand-built charts (hourly graph, sparklines, Kp, model compare, river hydrographs, Weather Patterns, Storm Timing, SSWXCon trend…). Each does tooltips, axes and touch a little differently. I'd move them onto one shared chart kit: the same drag-to-read scrubber, the same labels, an 'as a table' view for screen readers. Section B1 starts this with the infograph effect.

- Pros: Every graph feels like one app; Fixes in one place fix every chart; Accessible to screen readers
- Cons: Touches many pages, so it goes in waves
- Effort: Large
- Impact: 4/5

### A1.6 Units members can choose (Settings)

The app shows only °F, mph and inches. Chasers want knots, the science pages use mb and m/s, and anyone outside the U.S. wants °C. I'd add a Units setting (temperature, wind, rain, distance, pressure) in Account Settings, used by every page and chart.

- Pros: Chasers and weather nerds get the units they think in; Opens the app to Canadian and international members
- Cons: Every number on every page needs to pass through one converter (a careful sweep)
- Effort: Medium
- Impact: 4/5

### A1.7 Search everything, not just page names (Navigation)

The Command Palette finds pages. It can't find a glossary word, a library article, a Tornado Archive event, a town, or a tab inside a page. I'd add one search that covers all of them ('Joplin', 'dryline', 'Moore 2013', 'hodograph', 'Tulsa') and jumps straight to the right tab.

- Pros: With 48 pages, people find things instead of giving up; Shows how deep the app goes
- Cons: A small index to keep up to date (built at deploy time, free)
- Effort: Medium
- Impact: 4/5

### A1.8 Spanish for the life-safety parts (Reach)

Tens of millions of Spanish speakers live in Tornado Alley, Dixie Alley and on the hurricane coasts. I'd translate the warning cards, SSWXCon, the Daily Brief, notifications and the sign-up path first (not every page), with a language switch in settings.

- Pros: Reaches a huge audience almost no small weather app serves; Warnings in your own language save lives
- Cons: Ongoing: new text has to be translated too; Weather Service text itself stays in English
- Effort: Large
- Impact: 4/5

### A1.9 A real accessibility pass (Accessibility)

The pages have alt text and labels, but nobody has run an automated checker on every page, and the maps say nothing to a screen reader. I'd run axe on all 48 pages, fix what it finds, and give every map a one-line spoken summary ('Your area: Enhanced risk, 10% tornado').

- Pros: Usable by blind and low-vision members; Helps Google and AI search understand the pages too
- Cons: Some fixes are small visual changes (contrast on a few muted labels)
- Effort: Medium
- Impact: 3/5

### A1.10 Velocity on the live radar (Radar)

The Tornado Archive replay already decodes Level 2 velocity, storm-relative velocity and correlation coefficient, but the live Radar tab only shows reflectivity products. I'd bring those three into the live Radar tab for the nearest radar site, so members can see rotation and debris live.

- Pros: The one radar view chasers ask for most; Reuses code we already wrote and tested
- Cons: Level 2 files are big: only the site in view, only when the tab is open
- Effort: Medium
- Impact: 5/5

### A1.11 A map plan B before Mapbox costs money (Maps)

Maps are Mapbox-first. Mapbox's free tier is 50,000 map loads a month; a busy storm week with a few thousand members could pass it, and then it bills. I'd count map loads in admin and switch to MapLibre with free OpenFreeMap tiles automatically near the limit (the app already ships MapLibre).

- Pros: Maps never stop and never bill by surprise; Same look, because our map style is ours
- Cons: Two map styles to keep matching
- Effort: Medium
- Impact: 4/5

### A1.12 The homepage changes on storm days (Homepage)

The homepage looks the same on a quiet Tuesday and on a High Risk day. I'd let it rearrange itself when there's something big near you: a tornado watch, a Moderate risk or higher, a hurricane cone or a flash flood emergency moves to the top with the pages that matter for it.

- Pros: The app feels alive when it matters most; Members land on the right page in one tap
- Cons: Needs careful rules so it never cries wolf
- Effort: Medium
- Impact: 5/5

### A1.13 Show the engines' report cards (Engines)

The engine-verify job already checks every engine flag against storm reports and keeps a hit rate, but members never see it. I'd put a small 'how it did' badge on each engine (hit rate last 30 days, last big hit) and a full report card in admin.

- Pros: Trust: members see the engines are checked, not guessed; Tells us which engines need work
- Cons: A bad week is visible too (that's honest, and it's the point)
- Effort: Small
- Impact: 4/5

### A1.14 Smarter notifications (Notifications)

Notifications work, but they're all on or off by topic. I'd add quiet hours with a 'warnings break through' rule, a 'not more than N a day' cap, and a weekly digest choice, plus a test button for each topic so members know it works.

- Pros: Fewer people turn notifications off entirely; Warnings still always get through
- Cons: More settings to explain (kept on one tidy screen)
- Effort: Small
- Impact: 4/5

### A1.15 A storm-day offline pack (Offline)

Instant reopen shows your last data when signal is weak. For chasers and storm days I'd add one button that saves an offline pack: your SPC outlook, Storm Timing, the latest warnings near you and radar loop frames, so they still open in a dead zone.

- Pros: Works where chasers actually are (no signal); A clear reason to install the app
- Cons: A few MB on the phone while saved (auto-clears after 24 hours)
- Effort: Medium
- Impact: 3/5

### A1.16 Admin that works one-handed on a phone (Admin)

Most admin sections were built and checked on desktop widths (the last sweep couldn't sign in as admin). Tables like Members, Pricing and the color editor are cramped on a phone. I'd give each admin table a phone layout (cards, sticky save bar) and check every section at 390 px with a real admin session.

- Pros: You can run the app from your phone during a storm; Fewer accidental taps on dense tables
- Cons: Admin-only, so members never see the gain
- Effort: Medium
- Impact: 3/5

### A1.17 A 'where this comes from' on every page (Trust)

Data sources are named in places, but not consistently. I'd add a small Sources & freshness drawer to every page: which agency, when it was updated, when it updates next, and a link. It's what serious weather people check first.

- Pros: Builds trust fast with weather-savvy people; Helps search engines see the pages as authoritative
- Cons: Small amount of text to keep accurate
- Effort: Small
- Impact: 3/5

### A1.18 Try a paid page before you pay (Sign-up)

Guests can open the 5 front-door pages, then hit the plans. I'd let a new member open any locked page once (a 'peek' that lasts the session), with a bar showing which plan unlocks it. People pay for what they've touched.

- Pros: Usually lifts paid sign-ups; Shows off the best pages instead of a lock icon
- Cons: Some people will peek and never pay (that's fine: they're still members)
- Effort: Small
- Impact: 4/5

### A1.19 Real-phone speed tracking (Speed)

Speed budgets are checked at build time, but we don't know how fast pages really are on members' phones. I'd record Core Web Vitals from real visits (free with Vercel Speed Insights' Hobby allowance, or our own tiny beacon into Supabase) and show the slowest pages in admin.

- Pros: We fix what's actually slow for real people; Google ranks pages partly on these numbers
- Cons: A tiny extra request on some page views
- Effort: Small
- Impact: 3/5

### A1.20 Nightly backups we own (Safety)

Supabase's free plan keeps no downloadable backups. Members, plans, chase logs, points and badges live only there. I'd add a nightly job that exports the important tables to a private, encrypted file (Storage or the GitHub repo's private releases), keeping 14 days.

- Pros: One mistake or outage can't erase members' data; Lets us restore a single table
- Cons: A few MB of storage; Needs the service key in the job's secrets
- Effort: Small
- Impact: 5/5

## A2. 15 new pages and modules

My best ideas for new pages and modules. I checked each against the 48 pages we have, the 15 page ideas from the October review and the post-launch list (Personal Warnings, Affected Communities, Store, Services, Partnerships, Campaigns, Members Suite, Raffles, FairWeather), so nothing here clashes or repeats. Every data source is free.

### A2.1 Storm Lookup (Tools & Data)

Type an address and a date: did it hail there, how big, how strong was the wind, did a tornado pass, which warnings covered it, and the radar at that moment. One tap makes a clean PDF storm report for an insurance claim or a roofer. A second tab shows today's hail swaths across the country, live.

- Pros: Something people search for after every storm ('did it hail at my house'); Brings in homeowners, not just weather fans; A strong reason to pay for a plan
- Cons: Hail size is radar-estimated (MESH), so the report says so
- Data: NOAA MRMS hail size (MESH) archive on AWS since 2020, SPC reports, IEM warning archive, NWS Damage Assessment Toolkit
- Effort: Medium
- Impact: 5/5

### A2.2 Warning Scorecard (Severe Weather)

How good are the warnings where you live? For every Weather Service office: how many tornadoes were warned, how many warnings had no tornado, and average lead time, by year. Your office's rank, the best and worst years, and a map of the country colored by lead time.

- Pros: Nobody else shows this in plain words; Great for weather nerds and local news; Updates itself
- Cons: Can read as criticism of the Weather Service, so it's written respectfully
- Data: Iowa Environmental Mesonet 'Cow' verification service (free), SPC reports
- Effort: Small
- Impact: 3/5

### A2.3 Event Planner (Localized Data)

Add an event (a wedding, a ball game, a camping trip, a cookout) with its place and time. The page counts down with the forecast for that hour, shows how sure the forecast is (it narrows as the day gets closer), and notifies you when it changes for the worse or a watch or warning is issued.

- Pros: A reason to open the app every day for a week; Shareable: 'here's the forecast for our wedding'
- Cons: Beyond 7 days it can only show odds, which the page explains
- Data: NWS forecast (api.weather.gov), NOAA GEFS ensemble on AWS for the confidence band
- Effort: Medium
- Impact: 4/5

### A2.4 Backyard Stations (Community)

Members connect their own home weather station (Ambient Weather, Ecowitt, WeatherFlow Tempest) with the station's own free key. Their readings show on their dashboard, and with permission on a members' station map beside official airport stations, so the map has far more points than the Weather Service's.

- Pros: Weather hobbyists love this and stay; Our own live data network, free
- Cons: Some stations are badly placed (shown as 'member station', never official); Members need their own station key
- Data: Ambient Weather, Ecowitt and Tempest APIs (free for station owners), IEM airport observations
- Effort: Medium
- Impact: 4/5

### A2.5 Storm Totals (Localized Data)

'How much did we get?' after any storm: a rain, snow and ice totals map, the totals spotters and the Weather Service reported (with the town and time), your place's total and how it ranks, and 24, 48 and 72 hour views.

- Pros: The most-asked question after every storm; Snow totals are a big draw in winter
- Cons: Spotter totals come in over a few hours after a storm
- Data: MRMS multi-sensor rain totals, NWS Public Information Statements (parsed), CoCoRaHS daily reports
- Effort: Medium
- Impact: 5/5

### A2.6 Sky Gallery (Community)

Members post their storm, sky and snow photos. Each photo is stamped with the weather at that time and place (warnings, hail size, the radar). A monthly contest with a points prize and a badge, voted by members, plus an admin approve queue.

- Pros: Members make content for us every day; Photos are the most shared thing on social media
- Cons: Needs moderation (admin queue); Storage: photos shrunk to about 250 KB each, about 4,000 photos per GB
- Data: Members' uploads to Supabase Storage, our own weather data for the stamp
- Effort: Medium
- Impact: 4/5

### A2.7 Chase Day Fantasy (Community (WX Games))

A new WX Games game for storm days: before 18Z, drop a pin where you think the best tornado or hail will be. You score by how close the real reports land. Season standings, a 'called it' badge for a tornado within 25 miles, and it counts on the Leaderboard.

- Pros: Makes every storm day a game; Teaches forecasting by doing it
- Cons: Only active on days with an SPC Slight risk or higher
- Data: SPC outlooks (to choose game days) and storm reports (to score)
- Effort: Small
- Impact: 4/5

### A2.8 Storm Prep Planner (Everything Else)

A personal plan built from where you live and who's in your home: the hazards your area actually gets (from our climatology), your safe room, a go-bag list with expiry reminders (water, batteries, meds), pets and kids. When a watch is issued for you, the app opens your plan.

- Pros: Real life-safety value, which builds trust; Schools, churches and families share it
- Cons: Lists must stay simple or people won't finish them
- Data: Our climatology, Ready.gov and Red Cross guidance (public domain / free to cite)
- Effort: Small
- Impact: 4/5

### A2.9 Your Town Through the Years (Educational)

How your town's weather has changed since records began: warming stripes, the hottest and coldest years, rain by decade, first and last freeze dates moving, number of 100° days. Plain-word summaries and a share card.

- Pros: Very shareable ('look at our town's stripes'); Long records for almost every town
- Cons: Climate is a touchy subject for some (the page sticks to the measurements)
- Data: RCC-ACIS station records (free, NOAA's regional climate centers)
- Effort: Small
- Impact: 3/5

### A2.10 Earth Watch (Specialty Monitoring)

What's happening on the whole planet right now: tropical cyclones, floods, wildfires, volcanoes, dust storms and sea ice on one 3D globe, each with a short story card and how serious it is. A 'biggest event today' banner.

- Pros: A wow page: a live spinning globe; Brings in people from outside the U.S.
- Cons: Global data is less detailed than our U.S. pages
- Data: NASA EONET and GDACS (both free and public)
- Effort: Medium
- Impact: 3/5

### A2.11 Smoke Forecast (Module: AQI & Pollen, Fire Weather)

An animated 48-hour smoke forecast: smoke at the ground (what you breathe) and smoke overhead (what makes red sunsets), with the hours your air will be worst. Added as a tab to AQI & Pollen and to Fire Weather.

- Pros: Wildfire smoke now affects most of the country every summer; Feeds the Sunset & Sunrise engine too
- Cons: Only as good as the fire detections the model starts from
- Data: HRRR-Smoke fields (near-surface and column smoke) from NOAA's AWS archive
- Effort: Small
- Impact: 3/5

### A2.12 Ask StormSync (Everything Else)

Ask the weather in plain words: 'Will it storm during the game Saturday at 6?', 'Should I chase Tuesday?', 'Is my drive to Dallas safe tonight?'. The answer comes from our own pages' data (forecast, SPC, warnings, engines) with links to the pages it used, never made up.

- Pros: The most modern-feeling feature in any weather app; Shows off the depth of the app in one box
- Cons: A daily question cap per member to stay inside the free AI allowance; Must say 'I don't know' when the data doesn't answer
- Data: Gemini (the owner's keys, free tier) reading only our own API answers
- Effort: Medium
- Impact: 5/5

### A2.13 Listen to the Brief (Module: Daily Brief)

A play button on the Daily Brief that reads it aloud like a short radio forecast (about a minute), with the most important line first. Works on the lock screen, so you can listen while getting ready.

- Pros: Costs nothing: the phone's own voice does the reading; Great for drivers and early mornings
- Cons: Voice quality depends on the phone
- Data: The Daily Brief we already write; the browser's built-in speech
- Effort: Small
- Impact: 3/5

### A2.14 Kids Weather Lab (Educational)

A bright corner for kids and classrooms: how a tornado forms (animated), make-a-cloud and rain-gauge experiments, a safety quiz with a printable certificate, and 'what's the weather doing at your school'. A teacher mode shows a lesson plan.

- Pros: Teachers share it with whole classes (and parents follow); Good-news stories for the brand
- Cons: Needs a gentle, separate look from the rest of the app
- Data: NOAA SciJinks and JetStream (public domain), our own forecast
- Effort: Medium
- Impact: 3/5

### A2.15 Travel & Aviation Weather (Tools & Data)

Flying or picking someone up? Airport delays and ground stops nationwide, the weather at both airports, turbulence and icing areas along the flight, and pilot-style reports translated into plain words. Pilots get a raw METAR/TAF view.

- Pros: Travelers check this before every flight; Pilots are a loyal niche
- Cons: Flight-level data is for awareness, never for flight planning (said clearly)
- Data: FAA airport status (free), aviationweather.gov METAR, TAF, PIREP, G-AIRMET (free)
- Effort: Medium
- Impact: 3/5
