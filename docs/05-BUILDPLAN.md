# StormSync Weather BuildPlan

Living document. Updated at every phase. Any AI or person picking this up: read `BUILD_STATUS.md`, this file, `docs/04-DECISIONS.md`, then `docs/03-PHASES.md`. The owner's answers are stored in three lab artifacts (see BUILD_STATUS) and summarized here.

## 1. Product
One mobile-first app and website at **Weather.SSWX.Space**, named **StormSync Media** on the home screen, with the tornado mascot as its icon. It merges the team's apps: VIP Forecasts (`stormsync-dashboard/github-repo`), Chase Log (`Log`), StormSync Academy content (`stormsync-academy`) and the archive work (`stormsync-archive`). Every ported page gets a full redesign. Free to run until revenue.

## 2. Stack
| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript on Vercel Hobby |
| Install | PWA (iPhone Home Screen); Android `.apk` built free with Bubblewrap (Trusted Web Activity); stores later |
| Data | Supabase `weather` project (ztzqemzuanwqwqzsaigd): Postgres with RLS on every table, Auth, Storage (small files only), Edge Functions |
| Maps | One shared map component (`src/features/map/WeatherMap.tsx`): Mapbox GL JS v3 (one URL-restricted public token) with automatic fallback to MapLibre GL JS v6 on free OpenFreeMap tiles |
| 3D / motion | three.js + anime.js v4 (intro, select visuals); CSS transforms/opacity elsewhere |
| AI | Gemini API, server-only, every result cached |
| Email | Resend |
| Push | Web Push (VAPID) |
| Payments | Stripe (owner supplies pricing before the signup phase) |
| Engines | Python on GitHub Actions (hourly while private, more often once public), writing small GeoJSON that is overwritten in place |
| Analytics / errors | Vercel Analytics free tier; our own error log shown in the admin panel |

Secrets are server-only env vars (names: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PIN_PEPPER`). Never committed. The Mapbox token is a public `pk.` token restricted to our URLs (`NEXT_PUBLIC_MAPBOX_TOKEN`); a secret `sk.` token is refused in code.

## 3. Accounts, sign-in and roles
- **Sign-in:** a 4-digit PIN instead of a password, plus email sign-in link, Google and Apple (text-message codes dropped: not free). Supabase needs longer passwords, so the server turns the PIN into a long secret (keyed hash with `PIN_PEPPER` and the user id); the PIN itself is never stored. Five wrong PINs locks sign-in for 15 minutes, doubling each time, and offers the email link instead. A 4-digit PIN alone is weak, so admin actions also require a recently confirmed email code on a new device. Built (phase 08): `/login` (Google, email + PIN, email link), `/welcome` signup form, `/auth/callback`, PIN change on `/login` when signed in; profiles are created only by the server; a trigger stops members changing their own referral code, referrer, birthday or PIN flag.
- **Owner account:** created from the owner's email in chat; the PIN the owner gave is set at creation and never written to the repo.
- **Signup form (editable from the admin panel):** first and last name; optional nickname, then "use it as your display name?"; email; optional phone; city and state; birthday (must be 18+); how they found us; "referred by an SSWX Member?". Public name elsewhere: first name and last initial.
- **Referrals:** every account gets a numeric referral code. A code entered at signup credits the referrer (reward chosen by the owner in the admin panel). Admin panel lists members, adds/removes/edits them, and shows referral counts.
- **Roles:** Free User, subscription tiers, SSWX Member, SSWX Administration (a second role on top of any other), SSWX Founder (owner only, full access). Only the owner is admin at launch.
- **Without an account:** all free pages are open; everything else asks to sign in.

## 4. Look and feel
- **Menus:** see Decisions. Each menu style is a component that declares the screen spots its controls use; combining two moves the second to its next free spot. Same menu can't be both. Owner sets defaults in the admin panel; users change theirs in account settings and at the end of the intro guide.
- **Themes:** default VIP Gold + Editorial Crown. Users pick a ready-made template (the owner's 13 saved combos) or mix their own palette and font set from those offered. Changer in account settings only. A theme is a token swap; no component branches on the theme.
- **Intro:** the original (cube) version, cut to about 5 seconds. Plays once a day by default; users choose every launch / once a day / first launch only / off in account settings. Tiny "Created By: Jay Myers" appears with the finished lockup. Plays on all phones. **Waiting on:** the owner is sending the logo the ending should become; everything else stays the same.
- **Motion:** maximum by default, automatically toned down on slow phones and when the phone asks for reduced motion. Animate transform and opacity only.
- **Haptics:** on by default, user setting. **Sound:** none.
- **Units:** US only.

## 5. Platform rules
- **Maps:** every map, ported or new, uses the shared component. The app counts its own Mapbox map loads per month and switches all maps to MapLibre just before the free limit (45,000 of 50,000), then back when the month resets. Anything uncertain (no token, counter unreachable, a URL the token does not allow) uses MapLibre, so maps never cost money.
- **Storage safety:** `docs/06-STORAGE-SAFETY.md`. No rendered images in Supabase, retention on every growing table (enforced by a test), bounded cache keys, daily size watchdog with alerts at 60% and 80%.
- **Accounts for testing:** test users may be created in the live database and are deleted afterwards.
- **Git:** `main` is the production branch (owner approved).

## 5b. Weather data layer (phase 10)
- `src/lib/weather/nws.ts` (server only): NWS points, 7-day and 48-hour forecasts, normalized in `types.ts`. ZIP lookup via zippopotam.us.
- Coordinates are snapped to a 0.02° grid before any request or cache, so cache keys are bounded and no precise GPS position is stored.
- Caching: Next fetch cache (grid point 7 days, forecasts 15 min, ZIPs 30 days) plus edge caching on `/api/weather` and `/api/geo/zip`. Nothing is stored in Supabase.
- Saved places: up to 5 on the device (`sswx-places`), synced to the account in phase 08.

## 6. Sections
**Homepage.** Weather News (built, phase 15): top 15 from NWS (Extreme alerts), SPC, NHC, NOAA, NASA Earth Observatory, Climate.gov and NPR Climate, refreshed once at 7 AM Eastern, most severe first, no AI summaries. AP and Reuters publish no public feeds, so Climate.gov and NPR Climate stand in. Admins pin, hide and reorder stories at /admin/stories and can collect on demand. SSWX News: owner's posts with the editor; unread glow ends when opened or after 7 days. App Updates: new members by initials, game winners, releases.

**Localized Data.** Location by GPS or ZIP; up to 5 saved places with manual switching. Dashboard widgets: Today, 7-day, Hourly graph, SPC level, UV, Sunrise/sunset, Moon phase, Wind, Pressure trend, Feels like, Dew point, AQI, Pollen, Nearest river gauge. WPC, CPC and Fall Forecast subtabs per the outline. Daily Brief by in-app, push and email (SMS requests surface in the admin panel for the owner): today's forecast, SPC risk, active alerts, hourly rain timing, AQI and pollen, tomorrow at a glance. Forecast Discussion from the user's local office: Simplified (everyday language, AI) and Standard. AQI & Pollen, Mosquito Index ported; Daylight Tracker rebuilt.

**Community.** Forecast Game: VIP rules, easier location picking, a fully interactive map, full redesign. Daily Trivia: 3 AI-written questions a day, no approval, with a duplicate guard (stored question fingerprints and similarity check against the past year). Prizes as in VIP. Leaderboard weeks start Monday, Eastern time. Weekly Polls: results after voting. Raffles: post-launch.

**Severe Weather.** SSWXCon: review the VIP formula; keep it if sound, otherwise propose changes for approval. Push warnings: paid tiers and SSWX Members. Tropical: all five basins plus the Battle Royale, with the best one or two tropical models added. Hazards map layers: warnings, watches, advisories, radar, lightning, wildfires, road conditions, earthquakes. Severe Weather History: VIP ranges, plus last 7 days / month / 6 months / year for warnings and tornado paths. Storm Chasing Outlook: VIP stats carried over, redesigned. All other severe pages port from VIP with the redesign.

**Tools & Other Data.** Radar and Model Runs: VIP ported and redesigned, plus the best one or two tropical models. River & Flood Gauges with the top 5. 3D Soundings from balloons, HRRR, RAP, NAM 3 km and GFS. StormNet: add when their API is approved. Google DeepMind: Weather Lab AI cyclone tracks (WeatherNext Cyclones, owner checked the terms) join the Battle Royale and get their own subtab in the Tropical section next to the ported VIP hurricane tracker. WeatherNext live forecasts, AI probability maps and the Flood Hub API all need an access request with a wait, so they are left out; WeatherNext's historical archive (CC BY 4.0, no request) may be used for an "AI forecast scorecard" on past events. Traffic cameras: built, visible only to the owner until approved; aim for wider coverage and add weather/hazard cams.

**Specialty Monitoring.** Star Gazing: map plus a location score, plus everything star-related from VIP's Star Gazing & Aurora module. Aurora: two tabs (image and interactive) plus everything aurora-related from that module. Lightning: NOAA satellite lightning (GLM); look for other good free sources (no Blitzortung without permission). FairWeather: post-launch.

**Educational.** Climatology: tornado, lightning, and hurricanes. Glossary ported as is. Free Content Library copied from the Academy.

**Everything Else.** Weather Patterns: ported from VIP, which uses Gemini for its analysis; keep that, server-side and cached. Extras: access set engine by engine. Disaster Response: owner gives starting organizations when we reach it; form fields as chosen, with areas served, logo and social links optional.

**Account.** Profile: game stats, badges, leaderboard history, saved places, chase logs, member since, tier, plus more worth showing (streaks, referral count, contributions). Notifications toggles: warnings, watches, SPC upgrades, Daily Brief, SSWX News, game results, new trivia, new polls, tropical updates, aurora alerts, engine alerts.

**Second menu.** Official Tornado Archive: EF2+ since 2000 plus every EF4–EF5 since 1950; new NWS surveys publish automatically. Storm Chasing Log: paid tiers and SSWX Members; logs private until shared.

**Admin panel.** Phone-first. Built (phase 11): `/admin` dashboard of sections (unbuilt ones show their phase), Admins & access (Founder makes admins and picks their sections), Audit log (append-only), Storage watchdog. Phase 13 added Live ops (counts, live data-feed health, kill switches, maintenance banner), Members & referrals with a read-only member lookup and SSWX Member toggle, and the Error inbox (browser errors grouped). The owner's 19 picked extras are placed with the feature they need: push composer → 21, Stripe revenue + coupons → 64, content calendar → 29, homepage story curation → 15, AI usage meter → 22, moderation + ban/mute/warn → 26–29 and 61, brief delivery report → 21, game integrity → 26, data export and signup-form editor → 14; audit log, role matrix, theme controls, ops console, feed health, kill switches, banner, user lookup and error inbox are built. Admin pages return 404 to non-admins and need a Google or email-link session, not a PIN-only one. Outline requests + VIP AdminPanel (what fits) + the owner's 19 extras + our own. Includes engine preview/approval, owner-only previews (traffic cams), member and referral management, signup form editor, menu and theme defaults, storage watchdog, error log, SMS requests.

## 7. Engines
At launch: ProbTor, ProbHail, Nocturnal LLJ, Wildfire/PyroCb, Radar Blind Spot, Landspout/Waterspout, Rotation Track Persistence, Snow Squall, Landfalling Hurricane Tornado Risk. Post-launch engines are built in the private Engine Preview first. Access per engine is set in the admin panel.

## 8. Post-launch (on the plan, not on menus)
Personal Warnings & Alerts, Affected Communities Outlook, FairWeather Tracking, Raffles, Virtual Store, Services, Partnerships, Non-Profit Campaigns, Donations, Members Suite (Forum, Active Roster, 2026 Storm Chases, New Members Onboarding), App Store and Google Play listings, post-launch engines. Notes for later: Google AlphaEarth satellite embeddings and Earth Engine datasets (damage, burn scars, drought, flooded land; commercial use needs an Earth Engine license); WeatherNext live data and Flood Hub API if the owner later requests access.

## 9. Waiting on the owner
- Logo for the end of the intro.
- Pricing setup (before the signup phase).
- Disaster Response starting organizations (at that phase).
- Approval of any SSWXCon formula changes.

## 10. Bug & glitch log
| # | Where | Bug | Fix |
| --- | --- | --- | --- |
| 1 | Section A lab | Saved answers came back read-only, so later taps and notes silently stopped saving | Copy saved data on load |
| 2 | Section A lab | Corner Sweep overlay didn't cover the full screen | Fixed-size circles anchored to the corner |
| 3 | Theme Lab intro | On tall screens the final logo was beyond the camera's far limit and vanished | Far limit raised |
| 4 | Theme Lab intro | "Press Play" label stayed over the running animation | Hidden state styled explicitly |
| 6 | App icon | The mascot is only ~170 px tall inside the logo file, so the icon is slightly soft | Cut out and sharpened; a high-resolution mascot file from the owner would make it crisp |
| 7 | Theme system | The default theme's CSS block outranked themes listed before it, so some picks didn't apply | Default block uses zero-specificity `:where(:root)` |
| 8 | Launch intro | On tall screens the dropped floor stayed in view at the end once the far limit was raised | Floor hidden after it has fallen away |
| 9 | Menus | With one menu open, the other menu's button floated on top of it | The other menu hides while one is open |
| 10 | Menus | Three second-menu styles were written but never registered, so picking them silently fell back to Morph FAB | Registered; a test now requires every offered style to exist |
| 5 | Storm-edit intro | Later "from" values showed the hidden cube and bolt early | Visibility driven by timeline time |
| 11 | Shared map | The map rendered blank: the map libraries set `position: relative` on the map element, overriding its full-size positioning, so it collapsed to zero height | Map element sized with width/height 100% instead |
| 12 | Shared map | MapLibre v6 could not start its tile worker because the bundler does not emit the worker file | Worker copied to a versioned `public/vendor` path before dev/build and set with `setWorkerUrl` |
| 13 | Sign-in page | The Supabase browser library pushed `/login` 25% over the JavaScript budget | Google and email-link sign-in moved to server actions; the page ships 2.4 kB |
| 14 | Homepage | Weather News never appeared on the homepage after phase 15: a scripted edit silently missed a line Prettier had reformatted | Wired by hand with the SSWX News tabs; scripted edits now assert their target exists |
| 15 | CI | From phase 08 on, CI (which has no Supabase settings) failed while prerendering admin pages: the server client validated settings before reading cookies | Cookies are read first, so those pages are per-request; verified by building without the env file |
| 16 | Fall map | Every fall-color dot drew black: the map libraries reject space-separated `hsl()` colors | Colors use the comma form |
| 17 | Daily Brief | At 2 AM the brief called today's daytime "Tomorrow", because NWS's first period is "Overnight" | Days matched by each period's local date |
| 18 | CI | Builds failed at random fetching 24 Google font families at build time | Fonts bundled with the app (`src/lib/theme/fonts/`, latin subset); builds never fetch fonts |
| 19 | Sign-in | The owner's email and PIN were refused: no account existed for that email yet | Account is created through the email link + welcome form; founder role is granted automatically on profile creation |
| 20 | Menus | Reopening Corner Sweep showed the last-opened group's sub-pages before the sweep animation, over the page | Closing folds every group |
| 21 | Homepage | Two logos stacked at the top (header + page) | One small logo in a free top corner; the page opens with the Weather Clock |
| 22 | Dashboard maps | WPC/CPC/Fall maps opened zoomed into one spot with tiles that looked like embeds | Static national maps drawn in our Albers projection (vector layers projected on the server, rasters exported by NOAA in the same projection), framed on the whole country, with PNG download and share |
| 23 | Forecast Discussion | The Standard tab reworded section titles and reflowed the text, so it wasn't the official product | Standard now shows the NWS text verbatim (header, sections, && breaks, signature), with jump links |
| 24 | Account | The installed app kept a signed-out viewer for its whole life, so the Admin Panel never showed after signing in | The viewer re-reads on session-cookie change, focus, visibility and every 15 s |
| 25 | Menu | "Log in / Sign up" still opened the login page when signed in | Signed in, it reads "My Account"; the login page offers the Admin Panel to admins |
| 26 | Installed app | The intro never played on the app's first launch | The boot script plays it once on the installed app's first launch |
| 27 | Dashboard · Fall | Opening Fall widened the page into a blank void (scrubber lane translated past the card) | Scrubber clips its lane; the page clips sideways overflow |
| 28 | Dashboard maps | WPC/CPC/Fall lagged on phones (blur filters on full-country outlines and dots, a reveal on every map) | Glow drawn as a wide faint stroke, no filters, no reveal; map paint contained; Fall dots rebuilt only when the date moves; each product in its own subtab |
| 29 | Subtabs | The morph never showed on phones: the speed probe ran during page load, so capable phones were rated low tier | Probe runs after the page settles and uses the median frame; morph is stronger and longer; low-tier phones get a light slide-in |
| 30 | Homepage · Weather News | Weather News never loaded: the stored stories table stayed empty (the 7 AM collector run never saved) | The page collects in the background whenever stories are missing or over a day old, independent of the cron |
| 31 | Email | App emails landed in Gmail spam: a bare default sign-up template linking to a different domain, and no unsubscribe header | Branded templates link to our own `/auth/confirm`; brief emails carry one-click List-Unsubscribe, a full plain-text part and a clear sender |
| 32 | Forecast Game | The month's champion could be crowned before the month's last day was scored (both ran at once) | The scorer runs first, then the crowning |
| 33 | Forecast Game | Pins locked at noon ET and couldn't be moved | Pins move freely until the midnight ET reset (database-enforced, today only, scores untouchable) |
| 34 | Daily Trivia | (VIP) points were minted from the browser and silently rejected | Answers are graded and paid only by `trivia_answer()` in the database; the key is never readable before answering |
| 35 | Homepage · Weather News | Still empty after #30: the daily run was missed and the page's background refresh never fired on the cached homepage | Hourly database job collects whenever stories are missing or over a day old; read cache shortened to 15 min |
| 36 | Account | Admins tapping Account were sent to "create an account": the "my profile" lookup read every profile admins can see and failed | Every own-row lookup filters by the signed-in user's id (account, welcome, sign-in links, brief, games) |
| 37 | Warnings & Reports | Every warning said "The full text couldn't be loaded": NWS alert ids contain hex letters, the check allowed digits only | Id check accepts the real CAP format (tested); on an NWS outage the card shows the basic alert facts |
| 38 | Dashboard · WPC Drought | The rapid-drought map bled everywhere: the service layer drew a white footprint and outline over the map, and a shared clip id could resolve to a hidden map | Image-only layer; each map has its own clip ids |
| 39 | Admin · Daily Trivia | The Points box ran under the Bonus/Hidden buttons | The box stays its own width; the buttons sit beside it |
| 40 | Admin | Menu & theme defaults and Signup form were built but locked as "coming" tiles | Both open from the panel |
| 41 | Atmospheric Ingredients | The SWTI number in the ring showed tiny and grey (the label style caught the number) | Label has its own class |
| 42 | Subtabs | Still no visible transition on the owner's phone: with Remove animations or Data Saver on, the morph is skipped and CSS animations are zeroed | Every switch slides the new panel in through the Web Animations API (a gentle fade under reduced motion); the morph still plays on top where allowed |
| 43 | SPC Outlook | Seven type chips ran off the side of the screen; "Tomorrow" ran into "Thu" in the 8-day strip | Overview over a 3 × 2 hazard grid that fits in one view; the strip says "Tmrw" and clips labels |
| 44 | SSWX News | An uploaded team logo stretched past the screen | Post images always fit the column and at most 75% of the screen height (reader, preview and editor) |
| 45 | Admin · SSWX News | Writing meant Markdown symbols (bold showed `**stars**`) | Rich what-you-see editor saved as a validated document (see D-entry); older Markdown posts open converted |
| 46 | Admin · Menu & theme defaults | Saving silently did nothing: the two settings rows were never created, so the update matched no row | Rows seeded; the save now reports an error if it ever updates nothing |
| 47 | Admin · Live ops | The kill-switch and banner page was built but linked from nowhere | Listed under System on the admin overview |
| 48 | Storm Timing (VIP) | Shear and helicity alone produced 20% tornado chances and a "Slight" window on stable, zero-CAPE nights | Chances and timing threat scale with available instability (tested) |
| 49 | Everywhere | Phones lagged with many moving multicolor borders on one screen (10+ in an open menu) | Static multicolor outlines (ring, fading half ring, underline, edge bar); the moving beam stays only on the current menu page, Arrange, the Forecast Game lock-in and the Fall play button |
| 50 | Subtabs | The morph never ran on the owner's phone: the speed check, taken while those borders lagged the page, rated it "low" and low phones skipped the morph | The morph runs on every phone (lower resolution on slow ones); only Reduce Motion swaps it for a fade |
| 51 | Admin · Menu & theme defaults | "The defaults couldn't be saved": the read and edit rules for those settings were never applied in production | Rules applied (checked: every rule in the migrations now exists in production) |
| 52 | Admin · Menu editor | The save bar sat out of view behind the menu button | Floating save bar slides in on any change, plus a Save button at the top |
| 53 | Guests | Signed-out visitors could open every page and saw the full menus | Proxy sends guests on members' pages to the signup gate; guest menus list only guest pages plus Sign Up |
| 54 | View as member · Polls | Polls refused votes while viewing as a member and showed the owner's own votes | Owner-only audited `lens_poll_list` / `lens_poll_vote` |
| 55 | Flooding Outlook · CI | The flood test failed on CI (merged red): the server ICU writes "Sat 7 AM" where the local one writes "Sat, 7 AM" | ERO times are built from date parts, so every machine prints the same |
| 56 | River & Flood Gauges | Lake gauges (Devils Lake) report elevation stages against 0.1 ft flood thresholds, so they read "50 ft over flood stage", topped the worst-5 and flattened the hydrograph | Thresholds dropped when a stage runs 5x past major; tested |
| 57 | 3D Soundings | Most-unstable CAPE could read lower than surface CAPE when a shallow elevated layer won on θe but not on buoyancy | MU takes the stronger of the top-θe and surface parcels |
| 58 | Traffic Cameras | Most Caltrans stills were the agency's white "Temporarily Unavailable" card, filling Near You with blanks | Cards read the frame (Caltrans allows it) and hide placeholder frames; Near You fetches 30 and shows the first 12 that work |
| 59 | Traffic Cameras | Finding cameras inside warnings took 7–20 s (4 MB of every advisory, each camera tested against every polygon) | Warnings-only query, bounding-box prefilter, 2-minute memo: 32 ms warm |
| 60 | Star Gazing | VIP scored cloud straight through, so thin cirrus counted as much as a low deck, and the map used state centroids | Layered cloud and visibility in the one score; a 220-point lattice painted as a smooth field |
| 61 | Astronomy | Phase and season times printed to the minute from algorithms good to about 15 minutes, implying precision they lack | They read "about" the hour; tests hold 2026 solstices, equinoxes and the October full moon within 30 min of USNO |
| 62 | Aurora Center | "Kp needed" summed 0.1 steps, so exactly 50°N read Kp 5.1 (carried over from VIP); the 1-minute Kp estimate restarts every 3 hours and showed 0.0 while Kp was 2.3 | Integer tenths; the headline uses the official 3-hour Kp with the minute estimate beside it |
| 63 | Lightning | VIP-era plan named only GOES GLM, but no public live GLM feed exists in a form a web app can read | Built on NOAA's public NLDN/GLD360 density frames, decoded server-side; GLM logged for the engine pipeline |
| 64 | Climatology | NASA GIBS monthly lightning tiles are resampled, so their colors never match the colormap exactly and every month read 0 | Nearest colormap entry within a small distance; exact hits first |
| 65 | Menus | Tapping a page left the menu open over it until a slow page finished loading, so it looked like nothing happened | Every menu closes the moment a link inside it is tapped |
| 66 | Map downloads | Saved PNGs showed black land and no data: CSS-module styles do not travel with a serialized SVG | Export clones the map and inlines every element's computed style, and embeds all same-site images |
| 67 | Climatology | Lightning climatology stopped at 38°N (TRMM LIS orbit); major-hurricane tracks crossing 180° drew lines across the map | Bundled NASA LIS/OTD combined grid covering the Lower 48; track longitudes unwrapped |
| 68 | Warnings maps | NOAA's alert map service briefly answers empty and that was cached for 2 minutes (blank national warnings map) | An empty answer is refetched uncached; the flood map asks NOAA for flood products only |
| 69 | Climatology | Bundling the lightning grid pushed /climatology 1% over the performance budget, failing CI after #6.14 | The grid is served by the lightning API and fetched by the page |
| 70 | Warnings maps | The national alert layer is over Next's 2 MB fetch-cache limit, so every visit refetched it (7 s) and an empty NOAA answer could be held | Built map kept in memory for two minutes; empty national answers are never kept and report an outage |
| 71 | Hazards & Droughts | Drought Monitor drew as bright, heavy-outlined blobs on the web map | Drawn on the national map with clean category fills under the state lines; Ohio gets its own zoomed tab |
| 72 | Badges | The badge library (VIP admin imports) replaced the owner's chosen award-badge plates with round medallions | Every badge (profile, login, admin member, badge editor) is the gunmetal award plate again, with the badge's icon and rarity |
| 73 | Award badge | Several plates on one page shared SVG filter/mask ids, and the stripe ignored reduced motion | Ids are per plate; the stripe holds still for reduced motion and low-tier devices |
| 74 | Menus | Live Bento's zoomed section panel stayed on screen after a page was picked (the menu closed underneath it); seven other menus kept their open section the same way | The open section lives in `useMenuNav` with the open state, so closing a menu always folds it |
| 75 | Climatology | A cached tornado record from before deaths were added crashed the page (`deaths.reduce`) | Missing deaths read as none |
| 76 | Signup | The email-link step stopped new members before the signup questions and plans | No email confirmation: human check, account made and signed in, then questions, then Plans |
| 77 | Aurora | The oval's lines stopped short and broke into pieces where OVATION had no value | One continuous, smoothed edge from side to side of the map |
| 78 | Weather Patterns | Past Month showed "SPC's storm reports aren't answering" because 30 live report fetches timed out | Counts come from a daily ledger and a twice-daily precomputed cache |
| 79 | Tropical | Battle Royale stayed zoomed out on the basin, so the storm it was playing was hard to follow | The camera follows the storm; "All models" zooms back out |
| 80 | Storm Chasing | Only days since the page went live were in the year's ledger (3 days), so Yearly started the season over; nothing ran the scan if no one opened the page | Missing days rebuild from SPC's archive and archived model runs every 30 minutes until the year is full, and any missed day refills |
| 81 | Tour | Finishing the tour's menu pick saved only on the device, so another phone never got it | The pick saves to the account too |
| 82 | Routing | Storm Chasing Outlook, My Profile, Account Settings and Notifications showed "In the build queue" in production: the phase-notice route still prerendered those addresses from a hand-kept list, and Vercel served that HTML over the live pages | The notice route now covers only registry pages with no route folder, read at build time; a test fails if a built page is ever covered again |
| 83 | Extras | The Weather Slider could free the photo it was sliding away from while the slide was still drawing it | Unused photos are released only after the slide finishes |
| 84 | Extras | The Storm Visualizer's supercell sat off screen and too dim on narrow phones | The camera now fits the storm to the screen's width as well as its height, and the cloud shading is brighter |
| 85 | Routing | Files under /archive and /extras (event files, the blind-spot grid) went through the page gate like pages, so a guest or a plan without the page got HTML instead of data | Both folders are skipped by the proxy, like other static files |
| 86 | Tornado Archive | Tornado days in the Florida peninsula and the Keys were timed in Central, because the ported time-zone line stopped at 29°N | The Eastern/Central line now runs down the Gulf to 24°N, and Door County reads Central |
| 87 | Tornado Archive | A few NWS surveys carry an end time days after the start, which stretched a day's window across three days | End times more than four hours out are replaced by length at 30 mph |
| 88 | Replay | Follow and the chase camera zoomed in only part way while playing: each frame's camera move cancelled the zoom started on the first | The framing zoom rides along on every frame until it lands |
