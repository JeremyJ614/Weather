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

## A3. 10 big admin panel upgrades

The admin panel already controls almost everything (members, plans, prices, menus, colors, games, content, Extras, health, storage). These ten turn it from a control panel into a place that tells you how the business is doing and does work for you. None repeats a current section.

### A3.1 Live Command Center (New: Command Center)

One live screen to keep open on storm days: a map of members in the app right now and which page they're on, sign-ups and payments ticking in as they happen, the active severe weather, errors in the last hour and every job's last run. A bell sounds (optional) on a new paid member.

- Pros: You see storm-day traffic spike in real time; Spot a broken page within minutes; Fun to watch the app grow
- Cons: Presence uses Supabase Realtime (free tier: 200 at once; beyond that it samples)
- Effort: Medium
- Impact: 5/5

### A3.2 Growth funnel and retention (New: Growth)

Where people drop off between visiting, opening a guest page, starting sign-up, choosing a plan and paying. Weekly cohorts (how many of October's sign-ups still use the app), churn with the reasons members give when they cancel, and a 3-month revenue forecast from your real numbers.

- Pros: Tells you exactly which step to fix; Shows if a promo actually worked
- Cons: Needs a small private event log (about 1 MB a month)
- Effort: Medium
- Impact: 5/5

### A3.3 Member timeline, tags and segments (Upgrade: Members)

Open any member and see their whole story on one timeline: joined, plan changes, payments, last seen, pages they use most, badges, messages to the inbox, your notes. Tag members ('beta tester', 'chaser', 'VIP friend') and build saved segments ('paid, inactive 14 days, in Oklahoma') to act on.

- Pros: Personal service at scale; Segments feed campaigns, rollouts and promos
- Cons: Notes are private to admins (and covered by the privacy policy)
- Effort: Medium
- Impact: 4/5

### A3.4 Email and push campaigns (New: Campaigns)

Write once, send to a segment by email and push: a winter-storm heads-up to the Northeast, a 'we miss you' to inactive members, a promo to free members. Templates in our style, schedule for later, then see opens, clicks and sign-ups each one brought in.

- Pros: The cheapest way to win back and upgrade members; Uses the Resend account we already have
- Cons: Resend's free plan is 3,000 emails a month (100 a day), so big sends are spread over days
- Effort: Medium
- Impact: 5/5

### A3.5 Rollouts, beta group and scheduled switches (Upgrade: Live ops)

Today a feature switch is on or off for everyone. This adds who sees it (admins only, the beta group, a percentage, a plan, a state) and when (turn on Friday at 6 pm, off on Monday). Perfect for testing new pages with a few members and for timed promos.

- Pros: Test new things safely with real members; Promos and events start and stop on their own
- Cons: One more thing to check when someone says 'I can't see it'
- Effort: Small
- Impact: 4/5

### A3.6 Content calendar (New: Calendar)

Every scheduled thing in one month view: news posts, polls, trivia, Weatherdle words, promos, campaigns, release notes, scheduled switches. Drag to move, tap to edit, and empty days glow so you can see where the app needs something new.

- Pros: No more forgetting a poll or a promo end date; Plan a whole month in one sitting
- Cons: Reads from several sections, so their own pages stay the place for details
- Effort: Medium
- Impact: 3/5

### A3.7 Data source monitor (Upgrade: System health)

The app reads from about 30 outside services (SPC, NHC, NWS, MRMS, NOAA's AWS model files, IEM, Mapbox, Stripe, Resend, Gemini…). This checks each one every few minutes and shows uptime, speed and last failure, emails you when one goes down, and puts a calm 'NOAA's feed is slow right now' note on the affected pages.

- Pros: You know before members do; Members see an honest note instead of a blank map
- Cons: A few hundred tiny checks a day (well inside the free plans)
- Effort: Medium
- Impact: 4/5

### A3.8 AI copilot for the admin (New: Copilot)

Ask the panel in plain words: 'how many paid members joined this week in Texas?', 'which page is slowest?'. It also drafts for you: a news post from today's SPC outlook, a reply to a contact message, a campaign email, a poll question. You approve everything; it never sends on its own.

- Pros: Saves you hours a week; Answers questions without digging through tables
- Cons: Read-only access to summary views only, never raw passwords or payment data; Uses the free Gemini allowance
- Effort: Medium
- Impact: 4/5

### A3.9 A/B tests for sign-up and prices (New: Experiments)

Try two versions of something and let the numbers decide: two headlines on the Join page, two prices for an add-on, two promo offers, two orders of plans. Members are split evenly, and the panel says which one wins and when the result is trustworthy.

- Pros: Stops guessing on prices and wording; Small wins add up to real revenue
- Cons: Needs a few hundred visitors per test to be sure
- Effort: Medium
- Impact: 4/5

### A3.10 Social Studio (New: Social Studio)

Make a post from any page in two taps: the SPC map, SSWXCon, a storm card, On This Day, with our branded frame and a written caption. Post it to the StormSync Facebook page right away or on a schedule (daily SSWXCon at 8 am), and see which posts bring sign-ups.

- Pros: Daily posting with almost no effort; Every post links back to the app
- Cons: Needs a one-time Facebook page connection (Meta's free Graph API)
- Effort: Medium
- Impact: 5/5

## A4. 20 promotions

Twenty promotions beyond the seven we have (Launch first 15, Launch next 10, Storm Season Kickoff, Go Yearly, Bring a Friend, Hurricane Season Pass, Holiday Bundle). Each one would get an on/off switch and its own settings in admin → Pricing & plans → Promotions, so you can run one at a time or several at once. 'Runs' says whether it switches itself on from the weather or a date, or only when you turn it on.

### A4.1 Storm Day Flash Sale (Runs: automatically)

When SPC issues a Moderate or High risk, a 24-hour offer lights up across the app and on the Join page: 'Big severe day ahead: 40% off your first month'. It turns itself off after 24 hours, at most once a week.

- Pros: Hits people exactly when they need the app most; Zero effort once it's on
- Cons: Some may feel it profits from danger, so the wording is about being ready, not fear
- Effort: Small
- Impact: 5/5

### A4.2 Storm Day Pass (Runs: always (when on))

$0.99 for 24 hours of everything, VIP included. For the person who only needs the app on one big day. After it ends, a one-tap offer to keep it with the day pass price taken off the first month.

- Pros: Easy first payment (the hardest one to get); Turns one-day visitors into members
- Cons: Stripe's fee eats about a third of 99¢ (0.30 + 2.9%)
- Effort: Small
- Impact: 4/5

### A4.3 7-day VIP trial (Runs: always (when on))

Try every page free for 7 days, card required, cancel any time in one tap. A countdown in the menu and a reminder two days before it ends (no surprise charges).

- Pros: The most proven way to convert to paid; Shows off the whole app
- Cons: Some sign up only for the free week (expected)
- Effort: Small
- Impact: 5/5

### A4.4 Founding Member price lock (Runs: until N spots are gone)

The first 100 paid members keep the price they joined at for as long as they stay, and get a gold Founder badge on their profile and the leaderboard. A live 'spots left' counter on the Join page.

- Pros: Urgency that's real (the counter is true); Founders become loyal ambassadors
- Cons: Those members never pay a future price increase
- Effort: Small
- Impact: 5/5

### A4.5 Storm Season Wrapped (Runs: every December)

Each member's year in review, Spotify Wrapped style: the storms they tracked, their busiest day, pages they used, points, badges, their best forecast. A shareable card for each slide, and a renewal offer on the last one.

- Pros: Members post it everywhere, for free; A great reason to renew
- Cons: Only as rich as what members did that year
- Effort: Medium
- Impact: 5/5

### A4.6 Students and teachers half off (Runs: always (when on))

50% off any plan with a school email (.edu, .k12) checked by a one-time code. Meteorology students are the app's biggest natural fans.

- Pros: Brings in future meteorologists and their classes; Teachers bring whole classrooms
- Cons: Some schools don't use .edu (a manual approve option in admin)
- Effort: Small
- Impact: 3/5

### A4.7 Spotters and first responders (Runs: always (when on))

30% off for SKYWARN spotters, firefighters, EMS, police and emergency managers, approved in the Contact inbox from a photo of their ID or spotter card.

- Pros: Goodwill and word of mouth in the right circles; These members use the app hard on storm days
- Cons: A few minutes of admin approval per person
- Effort: Small
- Impact: 3/5

### A4.8 Gift a plan (Runs: always (when on))

Buy a month, three months or a year for someone else. They get a branded gift email with a code; you pick the date it arrives. Strong around the holidays and Father's Day.

- Pros: New members who arrive already paid for; Easy holiday marketing
- Cons: Gifted members need a nudge to renew themselves
- Effort: Small
- Impact: 3/5

### A4.9 Come back for $1 (Runs: automatically)

30 days after a member cancels, they get one email and one push: 'Storm season's coming. Come back for $1 your first month.' Sent once per member, ever.

- Pros: Winning back is far cheaper than finding new members; Fully automatic
- Cons: Some may cancel hoping for the $1 deal (it only comes once)
- Effort: Small
- Impact: 4/5

### A4.10 Monthly game champion prize (Runs: monthly)

The top player of the month in WX Games (Forecast Game, Trivia, Weatherdle) wins a free month and a crown on the leaderboard. Shown all month as 'this month's prize'.

- Pros: Gives the games real stakes; Free members have a reason to stay daily
- Cons: One free month given away each month
- Effort: Small
- Impact: 3/5

### A4.11 Referral ladder (Runs: always (when on))

Builds on Bring a Friend: 3 friends who pay unlocks a free add-on for good, 10 unlocks a free year, and the top referrer each month gets VIP free for the next month. A progress ladder on My Profile.

- Pros: Members become the sales team; Rewards only after real payments
- Cons: Free years for the top referrers
- Effort: Small
- Impact: 4/5

### A4.12 Severe Weather Awareness Week (Runs: by date)

Each state's official Severe Weather Awareness Week (most are Feb–Apr): members in that state pick their own price for month 1 ($1 minimum), alongside safety tips from the app.

- Pros: Ties into the week local news already covers; Pay-what-you-want gets a lot of attention
- Cons: Some will pick $1 (they're still new paying members)
- Effort: Small
- Impact: 3/5

### A4.13 Winter Storm Pass (Runs: Dec–Mar)

Winter Center plus the Blizzard Composite and Storm Totals at a seasonal price, December to March, like the Hurricane Season Pass but for snow country.

- Pros: Sells to the Northeast and Great Lakes, who care less about tornadoes; Fills the quiet winter months
- Cons: One more plan option to explain
- Effort: Small
- Impact: 4/5

### A4.14 Chase Season Pass (Runs: Apr–Jun)

Storm Chasing Outlook, the Chasing Log, 3D Soundings and Extras for April through June at one price, with a 'season starts' push in late March.

- Pros: Exactly what chasers want, exactly when; A clear entry point for the chaser crowd
- Cons: Chasers may skip the rest of the year (the pass offers to roll into a plan)
- Effort: Small
- Impact: 4/5

### A4.15 Community goal unlock (Runs: until the goal is hit)

A progress bar everyone sees: 'At 1,000 members, everyone gets Extras free for a week.' Each sign-up moves it. When it fills, confetti and the reward for all.

- Pros: Members invite friends to reach it; A shared win builds community
- Cons: A free week of a paid page for everyone
- Effort: Small
- Impact: 4/5

### A4.16 Birthday month gift (Runs: automatically)

Members who add their birthday get a free add-on for their birthday month and a birthday badge. A friendly email on the day.

- Pros: Feels personal; Free members try a paid add-on
- Cons: Needs a birthday field (optional, month and day only)
- Effort: Small
- Impact: 2/5

### A4.17 Town vs. town challenge (Runs: monthly)

Each month the town (or county) with the most new members wins a free week of everything for every member there. A live board of the top 10 towns.

- Pros: Local pride spreads it on community Facebook groups; Grows us in clusters
- Cons: Big cities have an edge (it can be scored per 10,000 people)
- Effort: Small
- Impact: 3/5

### A4.18 Spin for a discount (Runs: always (when on))

New members spin a wheel once after sign-up: 10% to 100% off month 1 (you set the odds in admin). The wheel is a smooth, satisfying animation with a confetti finish.

- Pros: Fun, and everybody wins something; Pushes people from free to paid right away
- Cons: Odds must be set so the average discount fits your budget
- Effort: Small
- Impact: 3/5

### A4.19 Family & Friends pack (Runs: always (when on))

One payment covers up to four accounts at 40% less than four plans. The payer invites the others by link and manages them from My Profile.

- Pros: One purchase brings in four members; Families share weather worries
- Cons: Lower price per member
- Effort: Medium
- Impact: 3/5

### A4.20 Streak rewards (Runs: always (when on))

Open the app 30 days in a row and get a free week of a paid add-on; 100 days earns a free month. A streak flame on the menu and a gentle nudge before a streak breaks.

- Pros: Builds a daily habit; Free members taste paid pages
- Cons: A few free weeks given away
- Effort: Small
- Impact: 3/5

## A5. 15 visual upgrades and animations

Fifteen ways to make the app feel more alive, each running live in its box so you can see it, not imagine it. In the app every one follows our rules: dark surfaces, gold as light and never a fill, movement through transform and opacity only, lighter on slow phones, and still for anyone with Reduce Motion on.

### A5.1 Live Sky headers (Every page header)

The top of every page shows the sky over you right now: rain streaks when it's raining, drifting snow, a lightning flicker during a storm, slow stars at night, a warm glow at sunset. It's the Right-now scene widget's sky, spread across the page header, very subtle under the title.

- Pros: The whole app feels connected to the real weather outside; Instant 'wow' on first open
- Cons: A small canvas on each header (paused when off screen, off on slow phones)
- Effort: Medium
- Impact: 5/5

### A5.2 Flowing wind layer (National maps)

Thousands of glowing streaks flowing with the real surface wind from the GFS over our national maps, like a living weather map. A toggle on the maps, and the default background on Winter Center and Hazards.

- Pros: The most famous weather visual on the internet, in our colors; Makes fronts and storms readable at a glance
- Cons: GPU work: fewer streaks on mid-tier phones
- Effort: Medium
- Impact: 5/5

### A5.3 Radar-sweep reveal (Maps)

When a map's data arrives, it doesn't just fade in: a radar beam sweeps once around the center and the data appears behind it, with a faint afterglow on the beam.

- Pros: Turns waiting into a moment; Instantly says 'weather app'
- Cons: Only on first load of a map, never on every refresh
- Effort: Small
- Impact: 4/5

### A5.4 Rolling numbers (Numbers everywhere)

Temperatures, SSWXCon scores, probabilities and points roll to their new value like an odometer instead of snapping, each digit on its own wheel.

- Pros: You notice when a number changes; Feels premium with almost no cost
- Cons: None worth noting (skipped with Reduce Motion)
- Effort: Small
- Impact: 4/5

### A5.5 Severity pulse rings (Risk badges)

Risk badges send out slow rings like a radar ping, faster and brighter as the level rises: nothing for General Thunder, a slow ping for Slight, an urgent pulse for High. The color comes from the existing risk colors.

- Pros: Severity reads before you read the word; Draws the eye to what matters
- Cons: Must stay calm on low levels so it never feels alarming
- Effort: Small
- Impact: 4/5

### A5.6 Card grows into the page (Dashboard and lists)

Tap a dashboard card or a list item and it smoothly grows into the full page or detail sheet (the same card, expanding), instead of a hard page change. Back shrinks it home.

- Pros: The app feels like one connected space; You never lose your place
- Cons: Works on pages that share an element; others use the normal change
- Effort: Medium
- Impact: 5/5

### A5.7 Lightning page change (Page changes)

Changing pages, a thin gold lightning bolt cracks across the screen for a tenth of a second as the new page rises in, a signature StormSync moment. A softer fade for members who prefer it (setting).

- Pros: Unforgettable brand moment; Hides the brief load between pages
- Cons: Some will want it off (one switch in settings)
- Effort: Small
- Impact: 4/5

### A5.8 Holographic badges with tilt (Badges and cards)

Badges, the Founder card and plan cards tilt in 3D as you tilt your phone or move your finger, with a foil shimmer sliding across them like a trading card.

- Pros: Makes badges feel worth earning; Very shareable in screen recordings
- Cons: Motion sensor permission on iPhone (asked once, optional)
- Effort: Small
- Impact: 4/5

### A5.9 Tornado pull-to-refresh (Pull to refresh)

Pull down on a page and a little funnel cloud forms from the top, tightening as you pull; let go and it spins while the data refreshes, then lifts away.

- Pros: Delight in the most repeated gesture; On-brand for a storm app
- Cons: Only in the installed app, where browsers don't add their own pull
- Effort: Small
- Impact: 4/5

### A5.10 Scroll-built sections (Long pages)

As you scroll, each section assembles itself: the card rises, its chart lines draw, its numbers roll. Done with the browser's own scroll-driven animations, so it costs no JavaScript.

- Pros: Long pages feel crafted, not stacked; Free performance-wise
- Cons: Older browsers just show sections without the build (fine)
- Effort: Small
- Impact: 3/5

### A5.11 Data-decode headings (Headings)

Page titles and big readouts resolve out of scrambling characters for a moment, like data coming in from a radar, then settle. Once per page visit.

- Pros: Tech-forward feel that fits the science; Tiny and cheap
- Cons: Used sparingly or it gets tiring (titles only)
- Effort: Small
- Impact: 3/5

### A5.12 Hailstone celebrations (Wins and badges)

Earning a badge, winning a game or upgrading a plan sets off a burst of glinting hailstones that bounce and roll off the bottom of the screen, instead of generic confetti.

- Pros: Celebrations that are ours; Makes wins feel big
- Cons: None (rare by nature)
- Effort: Small
- Impact: 4/5

### A5.13 Living isobars (Backgrounds)

Behind the glass cards, faint pressure lines slowly drift and bend like a weather map breathing. Barely there, but it gives every page depth.

- Pros: Depth without clutter; Unique to a weather brand
- Cons: Kept extremely faint so text contrast never drops
- Effort: Small
- Impact: 3/5

### A5.14 The app follows the sun (Themes)

The theme's glow shifts gently with the real sun where you are: a warmer gold at sunrise and sunset, cooler and dimmer at night. It's a token swap on the active theme, so every theme gets it.

- Pros: The app quietly matches your day; Easier on the eyes at night
- Cons: Members who want a fixed look turn it off in settings
- Effort: Small
- Impact: 3/5

### A5.15 Warnings that arrive (Warnings)

When a new warning comes in while you're on a page, its card arrives with a quick flash, a short shake and a ring, so it's impossible to miss, then settles calmly. Tornado warnings get the strongest version.

- Pros: Life-safety info grabs attention; Feels like a real alert system
- Cons: Only for new warnings near you, never for old ones on load
- Effort: Small
- Impact: 5/5
