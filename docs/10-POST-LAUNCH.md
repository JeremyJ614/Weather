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

## A6. Engine by engine: pros, cons and upgrades

All 20 Weather Engines on the Extras page, one at a time. For each: how it works today in plain words, what's good about it, where it falls short, and the specific upgrades that would make it more accurate, with how much each one would help. Most engines run as TypeScript on our server; Severe Analogs' archive is built with Python. The heavier upgrades (machine learning, big archives) would run in Python on free GitHub Actions and write their results where the app already reads them. Tick the engines you want upgraded; you can also tick single upgrades.

### A6.1 ProbTor (Storm-by-storm tornado chance, next hour)

Starts from NOAA's ProbSevere tornado probability for every storm (new every 2 minutes), nudges the next 20 minutes up or down by how fast low-level rotation is tightening and whether lightning is jumping, then fades beyond 20 minutes because skill drops fast.

- Pros: Built on NOAA's best-tested storm nowcast; Updates every 2 minutes, storm by storm; Honest about how quickly skill fades
- Cons: Inherits ProbSevere's blind spots: tornadoes in squall lines (QLCS) and in hurricanes are under-forecast; The rotation and lightning nudges are set by hand, not fitted to results; Doesn't use the radar's own velocity directly
- Upgrades:
  - **Squall-line tornado boost**: For storms in a line, apply the Three Ingredients Method (0–3 km shear of 30 kt or more, shear nearly across the line, a surge or bow), which is how forecasters catch QLCS tornadoes ProbSevere misses. (accuracy gain: High)
  - **Real velocity rotation**: Use the Level 2 velocity decoder we already have (Tornado Archive) to measure each storm's rotation (normalized rotation, NROT) from the nearest radar, the strongest single tornado signal there is. (accuracy gain: High)
  - **Debris check**: A drop in correlation coefficient right at the rotation (a tornado debris signature) marks a likely tornado on the ground, shown as 'Debris detected'. (accuracy gain: Medium)
  - **Fitted to results**: Replace the hand-set nudges with weights fitted to our own verify log (isotonic calibration), and show a reliability chart in admin. (accuracy gain: Medium)
- Effort: Medium

### A6.2 Lightning Surge Detector (Storms whose lightning is jumping now)

Follows each storm's total flash rate through the last ~20 minutes of ProbSevere files and runs the published '2-sigma' lightning-jump test (a rise far beyond the storm's own recent ups and downs, in a storm already flashing 10+ times a minute). Jumps backed by tightening rotation or a growing hail core are marked strong. Each jump is logged and checked against reports.

- Pros: A well-researched method (Schultz and others) with 10–20 minutes of lead time before severe weather; Cheap and fast; Already verified against reports
- Cons: Storm IDs can swap when storms merge or split, which can fake a jump; The 10 flashes a minute floor misses winter and low-topped storms; Only says 'jump' or not, not how big
- Upgrades:
  - **Merge and split handling**: Track storms by overlap instead of ID alone, so a merger isn't read as a jump. (accuracy gain: High)
  - **Jump size (sigma level)**: Show 2σ, 3σ, 4σ as rising strength; bigger jumps verify far better. (accuracy gain: Medium)
  - **Regional floors**: Lower thresholds for winter, the West and tropical air, fitted from the verify log. (accuracy gain: Medium)
  - **Straight from GLM**: Read GOES-East and GOES-West lightning (GLM flash extent) directly, merged where they overlap, for a cleaner rate than the summary in ProbSevere. (accuracy gain: Medium)
- Effort: Medium

### A6.3 First Storms (Where storms start, next 6 hours)

Looks at the last four HRRR runs together (a time-lagged ensemble). In each, a new storm is a 35 dBZ echo with nothing within 25 miles the hour before. The chance is the share of runs that start one near you, weighted by whether the cap is weakening and winds are converging, only where there's instability (MUCAPE 100+). Checked against real storms on radar.

- Pros: Gives real odds instead of one model's guess; Checks itself against radar; Free and quick
- Cons: Four runs of one model is a small ensemble; HRRR timing is often off by an hour or two; Ignores what satellite sees right now (towering cumulus)
- Upgrades:
  - **Satellite first hour**: Use GOES cloud-top cooling (tops chilling fast = a growing tower) to nowcast the first hour, where the model is weakest. (accuracy gain: High)
  - **More members**: Add the RRFS and NAM 3 km runs to the lagged ensemble (12+ members instead of 4). (accuracy gain: High)
  - **Smooth, calibrated odds**: Neighborhood probabilities with a 40 km smoothing and calibration from the verify log, the method SPC's guidance uses. (accuracy gain: Medium)
- Effort: Medium

### A6.4 Severe Analogs (Past days like today)

Like Saint Louis University's CIPS analogs: today's and tomorrow's GFS weather over the U.S. (500 mb height, 850 mb temperature, winds at two levels, moisture and instability) is matched against every day since 2004 within six weeks of the date. The closest 15 days, and the severe reports they had, make an outlook. The archive is built by our Python script.

- Pros: Easy to trust: 'days like this did X'; Grounded in real history; Cheap to run
- Cons: 2.5° grid (about 170 miles) can't see a dryline or warm front; Daily averages blur the afternoon setup that matters; Only 22 years of days to choose from; Compares a forecast model to an old reanalysis, which have different biases
- Upgrades:
  - **ERA5 archive**: Rebuild the archive from ERA5 (0.25°, hourly, free and allowed for commercial use with credit) at the afternoon hour instead of a daily mean, back to 1990. (accuracy gain: High)
  - **Severe ingredients in the match**: Add CAPE, 0–6 km shear and helicity to the fingerprint, not just heights and winds. (accuracy gain: High)
  - **Regional matching**: Match each region on its own (Plains, Dixie, Midwest, Northeast), as CIPS does, so a good Plains match isn't spoiled by Florida. (accuracy gain: Medium)
  - **Weighted analogs**: Closer matches count more than the 15th-best, and the GFS is bias-corrected to ERA5 first. (accuracy gain: Medium)
- Effort: Large

### A6.5 Boundary Collisions (Where boundaries meet, next 3 hours)

Your design: takes the newest HRRR (now to 3 hours), airport observations and WPC's analyzed fronts, finds lines of converging wind with a sharp temperature or dew point change (fronts, outflow, drylines), tracks them hour to hour, and marks where two will meet.

- Pros: Nobody else offers this; Mixes model, observations and the official analysis; Shows motion, not just a snapshot
- Cons: Airports are 50–100 miles apart, so small outflow boundaries are missed; Model boundaries can be tens of miles off; Doesn't say how likely a storm is where they meet
- Upgrades:
  - **Boundaries from radar**: Find thin lines on the lowest radar scan (the fine lines outflow boundaries make) with the Level 2 decoder and the MRMS low-level mosaic. This is how forecasters actually see them. (accuracy gain: High)
  - **Satellite arc clouds**: Detect arc clouds and cumulus lines in GOES visible imagery by day. (accuracy gain: Medium)
  - **Storm chance at each collision**: Score each meeting point with the local instability, cap and shear, so it reads 'storms likely here at 5 pm'. (accuracy gain: High)
- Effort: Large

### A6.6 Significant Tornado (STP) (SPC's tornado parameter, this evening)

SPC's fixed-layer Significant Tornado Parameter from the HRRR (surface CAPE, cloud base height, 0–1 km helicity, 0–6 km shear, CIN) at the coming 00Z, drawn as SPC-style areas.

- Pros: The number every severe forecaster knows; SPC-style map, easy to read; Fast (seconds)
- Cons: One model, one hour: if the HRRR is wrong or the peak is at 22Z or 03Z, it misses; Fixed-layer STP is less skillful than the effective-layer version SPC prefers
- Upgrades:
  - **Effective-layer STP**: Work out the effective inflow layer ourselves from the HRRR's 25 mb pressure levels and compute the effective-layer STP SPC uses on its mesoanalysis. (accuracy gain: High)
  - **Evening maximum**: Take the highest value from 18Z to 06Z instead of only 00Z, with the hour it peaks. (accuracy gain: Medium)
  - **Chance of STP ≥ 1**: Use the lagged HRRR and RRFS runs to show the probability STP passes 1, like SPC's ensemble guidance. (accuracy gain: High)
- Effort: Medium

### A6.7 Supercell Composite (SCP) (Where supercells are possible)

Most-unstable CAPE × 0–3 km helicity × 0–6 km shear with the CIN term, right movers only, from the HRRR at the coming 00Z.

- Pros: Standard and well-understood; Good at picking the broad supercell zone
- Cons: Same single-run, single-hour weakness as STP; Fixed layers instead of effective ones; Can't tell supercells from a messy line (storm mode)
- Upgrades:
  - **Effective helicity and shear**: The effective-layer SCP (Thompson's updated version), from the same effective inflow work as STP. (accuracy gain: High)
  - **Storm-mode hint**: Compare the deep shear direction with the starting boundary: shear across it favors discrete supercells, along it favors a line. (accuracy gain: Medium)
  - **Evening max and ensemble chance**: As for STP. (accuracy gain: Medium)
- Effort: Medium

### A6.8 Derecho Composite (DCP) (Where long-lived wind storms could organize)

Evans and Doswell's DCP: downdraft energy (DCAPE, which we compute ourselves from a moist-adiabatic table), MUCAPE, 0–6 km shear and mean wind.

- Pros: We compute DCAPE the HRRR doesn't carry; A respected derecho index
- Cons: DCP was built for places where a storm complex already exists; without one, it over-warns; Doesn't show where a complex would go
- Upgrades:
  - **Only where a complex can feed it**: Mark areas where the HRRR has an organized line (40 dBZ, 100 km long) heading in, the condition DCP was made for. (accuracy gain: High)
  - **Corfidi path**: Draw where a complex would travel from the Corfidi vectors (downwind propagation), the path a derecho takes. (accuracy gain: High)
  - **Model wind swaths**: Add the HRRR's hourly maximum 10 m wind gusts as a second ingredient. (accuracy gain: Medium)
- Effort: Medium

### A6.9 Lightning Threat (Lightning in the next 3 hours)

The HRRR's own lightning forecast (flashes per km² per 5 minutes), the most expected over the next three hours.

- Pros: A direct model forecast of lightning; Fast and simple
- Cons: The first hour misses storms already going or about to start; Not checked against real lightning yet
- Upgrades:
  - **Real lightning for hour one**: Blend in the lightning happening now (GOES GLM), moved forward with storm motion, so the first hour is near-certain where it's already flashing. (accuracy gain: High)
  - **Calibrated**: Compare with GLM flashes each day and correct the model's bias by region. (accuracy gain: Medium)
- Effort: Small

### A6.10 Rain-Wrap Index (Will a tornado be visible or hidden)

Where supercells could form (SCP 1+): weak storm-relative wind at anvil level keeps rain falling around the updraft (rain-wrapped, HP storms), strong flow carries it away (LP storms); deep moisture and a low cloud base add to it. Rotating storms ProbSevere tracks now get their own score from their environment.

- Pros: Built on solid research (Rasmussen and Straka; Brooks and others); Something chasers really care about
- Cons: Environment only: it can't see whether a storm is actually rain-wrapped right now
- Upgrades:
  - **Look at the storm itself**: For rotating storms, measure the rain falling around the rotation on the lowest radar scan (the hook and inflow notch), a direct reading of rain-wrap. (accuracy gain: High)
  - **9–11 km storm-relative wind**: Use Thompson's 9–11 km storm-relative wind, which separates HP from classic supercells better than 250–300 mb. (accuracy gain: Medium)
- Effort: Medium

### A6.11 Blizzard Composite (Hours of whiteout, next 2 days)

The Weather Service's blizzard test (gusts 35 mph+ with snow cutting visibility to a quarter mile) through the HRRR: falling snow where the model has snow and low visibility, blowing snow where 2+ inches lie, it's −5 °C or colder and gusts reach 40 mph. It stops counting at 35 seconds and says how far it got.

- Pros: Uses the official blizzard definition; Counts hours, which is what matters
- Cons: Model visibility is a weak forecast; The model's own snow depth can be far off; Fresh snow blows at lower winds than old crusted snow; it treats them the same; The 35-second limit can cut it short
- Upgrades:
  - **Real snowpack**: Use NOAA's NOHRSC snow depth analysis (observed) instead of the model's snow. (accuracy gain: High)
  - **Snow age physics**: The Li and Pomeroy blowing-snow threshold: fresh, cold snow drifts at lower winds; snow that has thawed and crusted doesn't. (accuracy gain: High)
  - **Precomputed**: Run it on GitHub Actions after each HRRR run, so there's no time limit and the page opens instantly. (accuracy gain: Medium)
- Effort: Medium

### A6.12 Sunset & Sunrise (How colorful the sky will be)

At each place's next sunset and sunrise: high and mid cloud overhead to catch the light, little low cloud in the way, a clear horizon toward the sun 60–400 km out, a little smoke, dry air, the clean air after rain. Factors multiply, and members' star ratings tune how much each counts.

- Pros: Thoughtful physics of why skies glow; Learns from members' ratings; Very shareable
- Cons: Model cloud heights and thin cirrus are often wrong; Smoke comes from a coarse aerosol field
- Upgrades:
  - **Satellite for tonight**: For tonight's sunset, use GOES cloud-type and cloud-top data from the last hour along the sun line, not only the model. (accuracy gain: High)
  - **HRRR-Smoke**: Swap the aerosol field for HRRR-Smoke's column smoke (much finer). (accuracy gain: Medium)
  - **Rating prompt**: Ask members for a quick star rating at sunset (more reports = better tuning). (accuracy gain: Medium)
- Effort: Small

### A6.13 Rainbow Chance (Now, +30 and +60 minutes)

Radar finds real rain (15 dBZ+); the HRRR's cloud and GOES visible satellite say whether the sky is open toward the sun; the sun must be low enough. Rain is moved forward on the 700 mb wind. A rainbow needs rain 5–20 km opposite the sun and sunlight reaching it.

- Pros: Physically exact geometry; Uses real radar and satellite, not just a model
- Cons: 700 mb wind is a rough guess for how showers move; Brightness depends on drop size, which it ignores
- Upgrades:
  - **Real storm motion**: Move showers with their own tracked motion (MRMS and ProbSevere) instead of one wind level. (accuracy gain: Medium)
  - **Drop size**: Favor heavier showers (bigger drops make brighter bows), from MRMS rain rate. (accuracy gain: Low)
  - **Sighting reports**: A 'I saw one!' button, like sunset ratings, to tune it. (accuracy gain: Medium)
- Effort: Small

### A6.14 Deer Activity (Day 1–3 outlook, lower 48)

Each half degree is scored at its own dawn and dusk from the GFS: temperature against the two days before (cold snaps get deer moving), pressure rising behind a front, wind, rain, cloud, the rut calendar and moon periods. Drawn SPC-style in five levels, members' reports tune it.

- Pros: Drawn like an SPC outlook, which hunters love; Learns from reports
- Cons: One rut calendar for the country, but the rut runs from early November in the North to January in parts of the South; Research on moon effects is weak, yet it counts; GFS is coarse for Day 1
- Upgrades:
  - **Rut by state**: Use each state wildlife agency's peak rut dates (some states have several zones). (accuracy gain: High)
  - **Hunting pressure**: Add each state's season dates (gun season opening pushes deer nocturnal). (accuracy gain: Medium)
  - **Research weights**: Weight temperature and pressure the way GPS-collar studies found (modest), and the moon least. (accuracy gain: Medium)
  - **HRRR for Day 1**: Use the 3 km HRRR for tomorrow morning's wind and temperature. (accuracy gain: Medium)
- Effort: Small

### A6.15 Fishing Bite (Day 1–3 outlook by species)

Five species scored at dawn and dusk from the GFS: low light, moon periods, slowly falling pressure ahead of a front, a light chop and cloud for the species that like it, and water temperature (estimated from five days of air temperature) in each species' comfort range.

- Pros: Species-aware; Uses the factors anglers trust; Learns from catch reports
- Cons: Water temperature is estimated, the factor that matters most; Ignores river flow (muddy high water shuts the bite off)
- Upgrades:
  - **Measured water temperature**: USGS stream and lake gauges, NOAA buoys and Great Lakes surface temperatures (all free) wherever they exist. (accuracy gain: High)
  - **River flow**: USGS flow vs. normal: high and rising water lowers the score for rivers. (accuracy gain: High)
  - **Lake satellite temps**: Satellite surface temperature for big lakes and reservoirs. (accuracy gain: Medium)
- Effort: Small

### A6.16 Nocturnal LLJ (Overnight low-level jet)

HRRR wind at 850 and 925 mb around 1 a.m. Central compared with six hours earlier, weighted by 0–1 km helicity and MUCAPE, on a 0–100 scale.

- Pros: Catches the classic night-time ramp-up behind Plains storms; Simple to read
- Cons: Two fixed levels can miss the jet's actual core; Doesn't show whether the jet feeds storms with moisture
- Upgrades:
  - **Find the real jet**: Search the HRRR's levels below 3 km for the wind maximum and apply the Bonner criteria (a true jet has a peak and a falloff above). (accuracy gain: High)
  - **Moisture transport**: Wind × moisture at 850 mb: the jet that keeps night storms alive. (accuracy gain: Medium)
  - **Through the night**: An hour-by-hour timeline for your place. (accuracy gain: Low)
- Effort: Small

### A6.17 Landspouts & Waterspouts (Non-supercell tornadoes)

SPC's Non-Supercell Tornado parameter from the HRRR (low-level lapse rate, 0–3 km CAPE, CIN, weak shear, surface vorticity), with waterspouts within about 40 miles of land.

- Pros: SPC's own formula; Covers a hazard most apps ignore
- Cons: Landspouts form on boundaries the model often can't place; Waterspouts depend on water temperature, which it doesn't use
- Upgrades:
  - **Szilagyi Waterspout Index**: The forecasting standard for waterspouts: water vs. 850 mb temperature difference, convective depth, light winds, with real water temperatures. (accuracy gain: High)
  - **Boundaries from the collision engine**: Raise the landspout chance along boundaries Boundary Collisions finds. (accuracy gain: High)
- Effort: Small

### A6.18 Wildfire & PyroCb (Fire spread weather and fire thunderstorms)

The Hot-Dry-Windy Index (dryness of the air × wind) at 21Z, and for each fire of 100+ acres a chance of a fire thunderstorm (pyroCb) from HDWI, the 700–500 mb lapse rate, mid-level moisture, fire size and containment.

- Pros: HDWI is a modern, well-tested fire weather index; Per-fire pyroCb chance is rare and useful
- Cons: How hot a fire is burning matters most for pyroCb, and it isn't used; Size and containment are slow to update
- Upgrades:
  - **Fire power from satellite**: Use fire radiative power from NASA FIRMS (VIIRS, MODIS) and GOES (free), the strongest single pyroCb predictor. (accuracy gain: High)
  - **PyroCb Firepower Threshold**: Compute Tory and Kepert's PFT from the HRRR sounding over each fire: how much fire power the atmosphere needs to make a pyroCb. Compare with the fire's real power. (accuracy gain: High)
- Effort: Medium

### A6.19 Hurricane Tornadoes (Tornadoes in landfalling storms)

0–1 km helicity × 0–3 km CAPE in the right half of each tropical storm or hurricane near the U.S., 50–400 miles from the center.

- Pros: Targets a real, often-missed hazard; Simple and physically sound
- Cons: Right half of the motion is a rough rule; research ties the risk to the shear direction; Only now, not the next two days of landfall
- Upgrades:
  - **Shear-relative quadrant**: Use the downshear quadrants (Edwards' research), which match where tropical tornadoes actually happen. (accuracy gain: High)
  - **Along the forecast track**: Step the storm along NHC's forecast track for 48 hours, so you see when the threat reaches you. (accuracy gain: High)
  - **Calibrated with history**: Check against SPC's tropical tornado database (free, since 1995). (accuracy gain: Medium)
- Effort: Medium

### A6.20 Radar Blind Spot (How high the lowest radar beam is)

For every NEXRAD radar, the height of the lowest (0.5°) beam over every spot in the lower 48, with the standard 4/3-earth beam model. Tap anywhere for the exact height. Built once by a script.

- Pros: Exact beam math; Tells people why radar can miss a tornado near them
- Cons: Ignores mountains: in the West and Appalachians, terrain blocks the beam and the real blind spots are much worse; Leaves out the airport (TDWR) and Canadian radars that fill gaps; Doesn't know which radars are down right now
- Upgrades:
  - **Terrain blocking**: Trace each beam over USGS elevation data so blocked areas show as blind (the biggest accuracy gain by far in the West). (accuracy gain: High)
  - **More radars**: Add the 45 TDWRs and the Canadian radars near the border. (accuracy gain: Medium)
  - **Radars down now**: Mark radars that are offline right now, with the area that lost coverage. (accuracy gain: Medium)
  - **Lowest real tilt**: Use each site's actual lowest tilt (some scan below 0.5°). (accuracy gain: Low)
- Effort: Medium

## A7. 10 new Weather Engines

Ten new engines for Extras. I checked each one against the 20 we have, the three we retired (ProbHail, Rotation Tracks, Snow Squalls), the 12 post-launch engines you already approved (Convective Initiation, Supercell Merger, Derecho Corridor and the rest) and the 15 engine ideas from the October review, so none repeats. All use free data and draw in our SPC style with editable colors.

### A7.1 Giant Hail Outlook (Severe)

The chance of 2-inch-plus hail this afternoon and evening. It reads the HRRR's built-in hail growth model (HAILCAST, the largest hailstone each hour) and checks it against the Significant Hail Parameter, so both the storm model and the environment have to agree.

How: HRRR hourly max hail diameter + SHIP from the same run; lagged runs for a probability; verified against SPC hail reports 2"+.

- Pros: Giant hail is the costliest severe hazard (cars, roofs); Two independent signals must agree, so fewer false alarms
- Cons: HAILCAST tends to run high in some setups (calibration fixes most of it)
- Data: HRRR on NOAA's AWS archive, SPC reports
- Effort: Small
- Impact: 5/5

### A7.2 Atmospheric Rivers (Flooding / West)

The rivers of moisture that bring the West Coast its floods and big snows (and sometimes the Southeast). Shows where the moisture plume will hit and rates it on the official AR scale from 1 (beneficial) to 5 (hazardous), with how long it lasts at your place.

How: Integrated vapor transport (wind × moisture through the column) from the GFS 0.25°, AR category by the Ralph et al. (2019) scale from strength and duration.

- Pros: Huge for California, Oregon and Washington, where we have few members today; The AR scale is what West Coast forecasters use
- Cons: Mostly a West Coast and winter engine
- Data: GFS on NOAA's AWS archive
- Effort: Small
- Impact: 4/5

### A7.3 Downslope Windstorms (Wind)

Chinooks on the Front Range, Santa Anas in Southern California, and windstorms off the Appalachians and Wasatch: the damaging winds that race down mountain slopes. Shows where and when, and how strong the gusts may get.

How: Cross-barrier wind at ridge level, a stable layer near the ridge top and a critical level above (the mountain-wave recipe), plus the offshore pressure gradient for Santa Anas, from the HRRR.

- Pros: These winds topple trucks and spread fires, and most apps never mention them; Ties into Fire Weather
- Cons: Each mountain range needs its own tuning
- Data: HRRR, USGS terrain
- Effort: Medium
- Impact: 3/5

### A7.4 Snow Band Finder (Winter)

Where the heavy snow bands will set up inside a winter storm (the narrow stripes that drop 2–3 inches an hour while the next town gets an inch), with a thundersnow flag.

How: 700 mb frontogenesis with low or negative moist stability (conditional symmetric instability, EPV) from the HRRR, the method behind the Weather Service's banding forecasts.

- Pros: Explains the 'why did they get 18 inches and we got 4' storms; A favorite of winter weather fans
- Cons: Bands are narrow, so placement can be off by 20–30 miles
- Data: HRRR
- Effort: Medium
- Impact: 4/5

### A7.5 Black Ice Tonight (Winter / roads)

Where wet roads will freeze tonight: rain or melting earlier, then clearing skies and calm winds that drop the road surface below freezing, even when the air stays a degree or two above. Hour of first freeze for your place.

How: HRRR surface (skin) temperature, the day's rain and melt, overnight cloud and wind; checked against road weather stations where states publish them.

- Pros: A danger drivers can't see; Fits the Daily Brief and notifications perfectly
- Cons: Bridges freeze first; the map says so rather than guessing each bridge
- Data: HRRR, state road weather stations (free where published)
- Effort: Small
- Impact: 4/5

### A7.6 Haboobs & Dust Storms (Southwest / Plains)

Walls of dust that drop visibility to zero on the highway: Arizona's monsoon haboobs and Plains dust storms. Shows where strong storm outflow or wind meets dry, bare ground, and the highways at risk.

How: Storm outflow and gust potential from the HRRR (DCAPE, simulated gusts), dry topsoil from the HRRR's soil moisture, known dust source areas; highways from our road data.

- Pros: Dust storms cause deadly pile-ups; Unique in a weather app
- Cons: Regional (mostly the Southwest and High Plains)
- Data: HRRR, dust source map (published research), roads
- Effort: Medium
- Impact: 3/5

### A7.7 Surprise Detector (Observations)

Watches every airport weather station every 5 minutes for the strange events models miss: sudden pressure jumps (gravity waves), wake lows that bring a burst of wind after storms pass, heat bursts at night (temperature jumping 10–20° in minutes). Each one pops up on the map with a story card.

How: Five-minute ASOS observations from IEM; jump tests on pressure, temperature and wind against the station's last hour.

- Pros: Live, real observations, no model; The kind of thing weather nerds screenshot and share
- Cons: Rare on most days (that's the point)
- Data: IEM 5-minute ASOS
- Effort: Small
- Impact: 3/5

### A7.8 Coastal Impact (Tropical)

When a hurricane threatens: the chance of more than 3, 6 or 9 feet of storm surge at each stretch of coast and at your saved places, and when tropical-storm winds are likely to arrive (the time you have to finish preparing).

How: NHC's P-Surge exceedance probabilities and its tropical-storm-force wind arrival times (both free files), drawn on our map with your places.

- Pros: Surge kills more people in hurricanes than wind; Official NHC data, our clear design
- Cons: Only active when NHC issues advisories for a U.S. threat
- Data: NHC P-Surge, NHC wind arrival times
- Effort: Small
- Impact: 5/5

### A7.9 How Rare Is Today (Severe / climate)

Puts today in perspective for your spot: how today's SPC tornado, wind and hail odds and the key ingredients compare with every past day of the same season. 'Today's tornado setup is in the top 2% for Norman in May.'

How: SPC outlook archive and our engine fields vs. climatology for the place and date window (SPC's own climatology for the outlooks).

- Pros: Instantly tells people whether to take a day seriously; A great one-line share
- Cons: Rare isn't the same as certain (the card says so)
- Data: SPC outlook archive and climatology, HRRR
- Effort: Small
- Impact: 4/5

### A7.10 Chaseability Index (Chasing)

Scores the country for how chaseable it is: road density and grid layout, hills and trees blocking the view, river crossings, and cell coverage. Laid over the Storm Chasing Outlook targets so a chaser can see 'great storms, terrible roads'.

How: OpenStreetMap roads, USGS terrain and tree cover (NLCD), FCC mobile coverage maps; scored on a 0.1° grid once, then joined with each day's targets.

- Pros: Something every chaser wants and no one has; Built once, cheap to serve
- Cons: Cell coverage maps are what carriers report, not perfect
- Data: OpenStreetMap, USGS NLCD and elevation, FCC coverage
- Effort: Medium
- Impact: 3/5

## A8. 5 new Randoms

Five new toys for the Randoms tab, each one playable right here. They join the 13 we have without repeating any (and not Plasma Globe, which you passed on). In the app each gets the usual Stage (paused off screen), lighter settings on slow phones, a still frame with Reduce Motion, and an admin switch.

### A8.1 Lightning Sculptor (Touch to strike)

Touch anywhere and a lightning bolt searches its way down from the clouds to your finger, branching as it goes, then the return stroke flashes and the channel glows and fades. Drag to steer the next one.

- Pros: Instantly fun, works with one tap; Branching follows how real stepped leaders grow
- Cons: Bright flashes: a softer flash with Reduce Motion
- Effort: Small
- Impact: 5/5

### A8.2 Snowflake Forge (Grow your own)

Grow a snowflake crystal live. Two sliders set the temperature and humidity of the cloud, and the crystal grows the shape real ice does there (the Nakaya diagram): thin plates, needles, or wild branching dendrites. Every flake is one of a kind and can be saved as an image.

- Pros: Beautiful and educational at once; Shareable: 'here's my snowflake'
- Cons: Calm rather than action-packed
- Effort: Small
- Impact: 4/5

### A8.3 Rain on Glass (Rainy window)

A rainy window at night with the city lights blurred behind it. Drops land, bead up, merge and race down leaving trails, each one bending the lights like a tiny lens. Tap to make it pour.

- Pros: Deeply relaxing, the kind of thing people leave running; Very realistic for its size
- Cons: The lens effect is the heaviest part (fewer drops on slow phones)
- Effort: Small
- Impact: 4/5

### A8.4 Aurora Painter (Paint the sky)

Drag across a starry night sky above the mountains and paint your own northern lights: green curtains with purple tops that ripple and fade, the way real aurora arcs fold and drift.

- Pros: Gorgeous with almost no instructions; Pairs with Aurora Center
- Cons: Needs a dark room to look its best (like the real thing)
- Effort: Small
- Impact: 4/5

### A8.5 Doppler Playground (How radar sees wind)

Drag a storm around and watch its waves bunch up in front and stretch out behind. A radar on the side reads the storm as coming toward it (green) or going away (red), exactly how velocity radar sees rotation. A quiet lesson in why a red and green couplet means a tornado.

- Pros: Teaches the most important radar idea in seconds; Fun to fling
- Cons: More of a lesson than the other four
- Effort: Small
- Impact: 3/5

## A9. 20 free ways to get the app out there

All twenty are free. The app already has the technical SEO basics (titles, share cards, structured data, sitemap, robots, llms.txt, RSS, IndexNow, the guest front door). These build on that. Each has a score out of 10 for how much it could grow the app. I checked the live site today: the Google and Bing verification tags aren't on it yet, so #1 and #2 are still open unless you verified another way (DNS).

### A9.1 Google Search Console, verified, sitemap submitted (Search)

Verify weather.sswx.space (the app's code is ready: set GOOGLE_SITE_VERIFICATION in Vercel) and submit the sitemap (132 pages today). Then Google indexes everything quickly and shows you which searches find you.

- Pros: The single most important free step for Google; Shows the exact searches people use
- Cons: Ten minutes of your time; results build over weeks
- Impact: 10/10

### A9.2 Bing Webmaster Tools (Search + AI)

Import from Search Console in one click. Bing powers ChatGPT search, Microsoft Copilot and DuckDuckGo, and our IndexNow pings already reach it, so new stories appear within hours.

- Pros: One step covers several search and AI engines; Our IndexNow setup starts working fully
- Cons: Smaller than Google on its own
- Impact: 8/10

### A9.3 A page for every town (Search)

'Tulsa tornado risk today', 'Moore tornado history', 'Is it going to storm in Wichita'. Pages for about 1,000 towns, each with real data: today's SPC risk and timing there, the town's tornado and hail history from our climatology, its biggest storms from the Tornado Archive, and a sign-up card. Built automatically from what we already have.

- Pros: Thousands of local searches a day we could rank for; Pages are genuinely useful, so Google treats them well
- Cons: Must be rich, not copy-paste, or Google ignores them; A few days of build
- Impact: 9/10

### A9.4 Shorts, Reels and TikToks from the app (Video)

The app already exports radar and model loops as video and GIF. Post one 10–20 second clip every storm day (the SPC map building, a radar loop, a Tornado Archive replay) to YouTube Shorts, Instagram Reels, Facebook Reels and TikTok, each ending on the app's name.

- Pros: Short weather video gets huge free reach on storm days; The content makes itself from our own share tools
- Cons: Needs someone posting on storm days; Reach varies a lot clip to clip
- Impact: 9/10

### A9.5 A daily post on the StormSync page (Social)

Every morning: the SSWXCon score and SPC map card for the day, scheduled free in Meta Business Suite (Facebook and Instagram) and Buffer's free plan (X, Threads, Bluesky). The A3 Social Studio idea would automate this from admin.

- Pros: Habit: followers check it daily; Every post links back to the app
- Cons: Quiet days need a different post (On This Day works well)
- Impact: 8/10

### A9.6 Local weather Facebook groups (Community)

Most counties in Tornado Alley have a big local weather or storm-spotting Facebook group. Join, help on storm days with our maps and plain-word answers, and share the app when it truly helps. Many allow a pinned resources post.

- Pros: Exactly our audience, already gathered; Trust builds fast when you help first
- Cons: Each group has rules on self-promotion; Slow, hand-done work
- Impact: 8/10

### A9.7 Reddit on big days (Community)

r/weather, r/tornado, r/TropicalWeather, r/stormchasing and state subreddits fill up on big days. Post genuinely useful maps and breakdowns from the app, credit NOAA, and keep the app link to your profile and where rules allow.

- Pros: Very large, very engaged weather audience; Good posts get picked up by Google too
- Cons: Reddit punishes obvious self-promotion; must give value first
- Impact: 7/10

### A9.8 Free embeddable widgets (Links)

A copy-and-paste SSWXCon badge, a 'today's SPC risk' card and a radar loop that any website can embed (schools, churches, local news, fire departments, blogs), each with a 'Powered by StormSync Weather' link.

- Pros: Every embed is a permanent backlink and a stream of visitors; Useful to the sites that use them
- Cons: Light extra load on our servers (cached at the edge)
- Impact: 8/10

### A9.9 Free VIP for weather creators (Partners)

Offer free VIP to storm chasers, local weather YouTubers and TikTok forecasters with a following, asking only that they use and mention the app if they like it. No payment either way.

- Pros: Their audiences are exactly our members; Authentic recommendations convert best
- Cons: No guarantee they mention it; A few free accounts
- Impact: 8/10

### A9.10 A free weekly newsletter on Substack (Email)

'The Storm Week Ahead', every Sunday: the week's big threats in plain words with our maps, open to anyone. Substack is free and recommends newsletters to its readers, so it finds new people on its own.

- Pros: Substack's network brings readers we'd never reach; An email list we own
- Cons: A weekly writing commitment (the AI copilot in A3 could draft it)
- Impact: 8/10

### A9.11 Evergreen guides that rank (Search)

Plain-word guides for what people search all year: 'How to read a hodograph', 'What does a Moderate risk mean', 'Tornado watch vs warning', 'What is STP'. Each one uses our live maps as examples and links to the page that shows it.

- Pros: Steady search traffic every month, forever; Shows expertise, which Google rewards
- Cons: Each guide takes care to write well
- Impact: 8/10

### A9.12 Google Discover and Google News (Search)

Add the large-image preview setting, keep SSWX News stories fresh with strong photos, and register SSWX News in Google's free Publisher Center. Discover shows stories to people on their phones without them searching.

- Pros: Discover can send huge traffic on big weather days; Small code change
- Cons: Google decides what to show; it's unpredictable
- Impact: 7/10

### A9.13 Web Stories for big events (Search)

Tap-through visual stories (Google's Web Stories format) for each big storm and each Tornado Archive event: maps, photos, one line each. They show in Google search and Discover as a swipeable carousel.

- Pros: Stand out in search results; Made from images we already have
- Cons: A separate page format to build once
- Impact: 6/10

### A9.14 Free press and journalist requests (Press)

Answer reporters' free requests for expert sources (Featured, Qwoted and Source of Sources all have free tiers), and send local TV stations and newspapers a short note with a striking map before big events. Weather is one of the most covered topics in local news.

- Pros: One mention in a local paper can bring hundreds of members; Builds authority and backlinks
- Cons: Hit or miss; most pitches get no reply
- Impact: 7/10

### A9.15 Launch on Product Hunt and friends (Directories)

A one-day launch on Product Hunt, plus free listings on AlternativeTo (as an alternative to RadarScope and MyRadar), BetaList, SaaSHub, Indie Hackers and the PWA directories.

- Pros: A burst of early users and lasting backlinks; AlternativeTo catches people searching for apps like ours
- Cons: Tech audiences, not all weather people; One day of active replying for Product Hunt
- Impact: 6/10

### A9.16 Free app stores (Stores)

Google Play costs $25, but several stores are free: the Microsoft Store for our installed web app (free for individual developers, packaged with PWABuilder), the Samsung Galaxy Store for the Android app, and Uptodown and APKPure for the APK we already ship.

- Pros: People search stores, not just Google; The Microsoft Store puts us on Windows PCs
- Cons: Each store has its own review and listing to keep up
- Impact: 6/10

### A9.17 A StormSync Discord (Community)

A free Discord server with storm-day channels, a chase channel, automatic posts of new watches and SSWXCon changes (a webhook from the app), and member roles synced to plans.

- Pros: Where weather enthusiasts already hang out; Members bring friends to live storm days
- Cons: Needs moderators on busy days
- Impact: 7/10

### A9.18 Live threads on big days (Social)

On Moderate and High risk days, a running thread on X, Threads and Bluesky (the #wxsky community is big): the outlook, then each watch and the first warnings, with our maps. Big-day threads are what people share.

- Pros: The moments with the most attention on weather; Shows the app at its best
- Cons: Needs someone online during the event
- Impact: 7/10

### A9.19 Data reports that earn links (Links)

Twice a year, a short report with charts nobody else makes: 'The 2026 tornado season in numbers', 'The most tornado-prone towns', 'How warnings performed'. News sites and bloggers love to cite these.

- Pros: High-quality backlinks, the strongest SEO signal; Easy to pitch to the press (#14)
- Cons: A couple of days of work per report
- Impact: 7/10

### A9.20 Google Business Profile and Apple Business Connect (Maps)

Free business listings for StormSync Media with the app's link, logo and posts. People searching the brand get a proper card in Google and Apple Maps.

- Pros: Looks established and trustworthy; Free posts appear in brand searches
- Cons: Needs a business address or service-area setup and verification
- Impact: 5/10

## A10. 10 places that bring subscribers, no fee up front

Ten websites and companies that can bring in paying members without paying anything first: they're free, or they only take a share after a sale. For each: pros, cons, what they require and whether we qualify. I left out anything we don't qualify for today (Google Ad Grants needs a registered nonprofit; Discord's Server Discovery needs 1,000 members) and anything with an upfront fee (Google Play $25, Apple's App Store $99 a year, the big affiliate networks' setup fees). Fees are as published by each company; check the current terms when you sign up.

### A10.1 Kickstarter (Crowdfunding)

Run a 30-day campaign for the next big StormSync upgrade (the new engines or Storm Lookup), with yearly plans and Founder badges as rewards. Backers become paying members on day one, and Kickstarter's own discovery pages and newsletter bring people we'd never reach.

- Pros: Pays only if the goal is met (all or nothing); Backers are paid-up members and loud fans; Press often covers fun campaigns
- Cons: About 5% to Kickstarter plus 3–5% card fees, only when funded; A campaign is a month of steady effort
- Needs: A short video, reward tiers, a funding goal and a U.S. bank account; the person running it 18+. Software projects go in the Technology → Apps category.
- Eligible: Yes: the app is live, which Kickstarter likes (it shows we can deliver).

### A10.2 Patreon (Memberships)

A StormSync Patreon where storm-day coverage, behind-the-scenes chase content and early looks at new pages live, with each paid tier including the matching app plan (we hand out codes). Weather and chaser fans already pay creators there.

- Pros: Free to start; Patreon's audience already pays for weather and chasing content; Fits the team's videos and streams
- Cons: Patreon keeps about 10% of what patrons pay, plus payment fees; Two places to manage members (codes keep it simple)
- Needs: An account, tiers and a payout method; the creator 18+.
- Eligible: Yes: open to anyone.

### A10.3 AppSumo Marketplace (Software marketplace)

List a deal (for example a discounted first year of VIP) on AppSumo, a marketplace with millions of buyers who love trying new software. AppSumo markets it to its email list and site.

- Pros: No listing fee; AppSumo takes a share of each sale; A big burst of members and reviews in a few weeks
- Cons: Its buyers lean toward business tools, so a weather app is a less typical fit; AppSumo keeps a large share of each sale; Needs code redemption on our side (we already have promo codes)
- Needs: Live, working software, a partner application and their review, codes they can sell.
- Eligible: Yes to apply: they accept live software products. Acceptance is their call.

### A10.4 NewsBreak Creator Program (Local news app)

NewsBreak is the biggest local news app in the U.S. (tens of millions of monthly readers). Approved creators post local content and the app shows it to people in those towns. Our storm-day explainers and town forecasts, each with a link to the app, are exactly the local weather it surfaces.

- Pros: Free, and NewsBreak even pays creators for views; Puts us in front of local readers in storm-prone towns
- Cons: Needs regular, original posts; Approval isn't guaranteed
- Needs: A creator application with sample content; original posts that follow their content rules.
- Eligible: Yes to apply: U.S.-based creators of local content.

### A10.5 Nextdoor for Business (Neighborhoods)

A free StormSync business page on Nextdoor, where neighbors ask each other 'did anyone else just lose power?' and 'is that a tornado siren?'. Post storm-day updates and get recommended by members in their neighborhoods.

- Pros: Free page and free posts; Neighbor recommendations are trusted; Very local, very storm-relevant
- Cons: Posts reach nearby neighborhoods, so it grows town by town
- Needs: A business page with a business address or service area, verified.
- Eligible: Yes: StormSync Media qualifies as an online business.

### A10.6 Flipboard (Reader app)

Add SSWX News to Flipboard as a publisher using our existing RSS feed (/feed.xml). Flipboard readers who follow weather, science and local topics see our stories, and each story links to the app.

- Pros: Free; No extra work: the feed is already built
- Cons: Traffic depends on how often we publish
- Needs: A publisher account and an RSS feed.
- Eligible: Yes: our feed meets the requirements.

### A10.7 Pinterest Business (Visual search)

A free business account with boards of our maps, storm-prep checklists, Tornado Archive events and the evergreen guides. People save weather prep and tornado content all year, and Pinterest acts like a search engine, sending traffic for months after each pin.

- Pros: Free, and pins keep working for months; Prep checklists and infographics do very well there
- Cons: Slower to build than video platforms; Best for evergreen content, not live storms
- Needs: A business account, a verified website (a small tag, like Search Console).
- Eligible: Yes.

### A10.8 Stormtrack and American Weather forums (Weather communities)

Stormtrack is the long-running home of storm chasers; American Weather (americanwx) hosts regional forecast threads for every big storm. Being a helpful regular in both, sharing our maps and engines when they add something, reaches the most serious weather people in the country.

- Pros: Exactly our most valuable members (chasers and weather nerds); Free
- Cons: Both communities dislike advertising; value first, links second; Hand-done work
- Needs: Free accounts and following each forum's rules on promotion.
- Eligible: Yes.

### A10.9 Lemon Squeezy affiliate hub (Affiliates)

Lemon Squeezy (owned by Stripe) runs a free affiliate program for software it sells, with a public hub where affiliates go looking for products to promote. Creators and bloggers sign up to sell our plans and earn a commission only when someone pays.

- Pros: Free to run: we pay only commissions on real sales; Affiliates find us through their hub
- Cons: Sales go through Lemon Squeezy's checkout beside our Stripe one, and it keeps about 5% + 50¢ per sale; Commissions cut margin on those sales
- Needs: A Lemon Squeezy store with our plans, and their approval.
- Eligible: Yes: they sell software subscriptions.

### A10.10 LinkedIn page and newsletter (Professionals)

A free StormSync Media company page with a LinkedIn newsletter for emergency managers, school administrators, event planners and outdoor businesses: the people who need storm timing for work and will pay for a plan (and later for Services).

- Pros: Free, and LinkedIn newsletters notify every subscriber; Reaches buyers, not just fans
- Cons: A different, more professional tone; Slower growth than consumer social media
- Needs: A company page managed from a personal account.
- Eligible: Yes.
