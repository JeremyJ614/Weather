# Phase list

Each phase is small enough to finish, test and push in one session. When a phase is done: push, tick it here, update the BuildPlan, then say "I will do my best for the upcoming phase", list what it covers and how it will be kept accurate, and continue without waiting.

Sources: **VIP** = `stormsync-dashboard/github-repo` (VIP Forecasts & Weather Data). **Log** = `Log` (Chase Log). **Academy** = `stormsync-academy`. **Archive** = `stormsync-archive`.

## Planning
- [x] S-A. Section A lab: menus, intro, admin extras, themes, pricing (`design-lab/section-a`)
- [x] S-B. Section B answers (`docs/02-SECTION-B.md`) and this phase list
- [x] S-Q. Questionnaire (interactive) answered by the owner
- [x] S-P. Full BuildPlan with bug & glitch log (`docs/05-BUILDPLAN.md`)
- [x] S-D. Owner picks Google DeepMind items

## Foundation
- [x] 01. Project skeleton: Next.js, TypeScript, lint, tests, `npm run verify`, CI, performance budget
- [x] 02. Vercel project linked to GitHub, Supabase connected, server-only secrets, Weather.SSWX.Space DNS
- [x] 03. Installable app: PWA manifest, icons, offline screen, splash, safe areas, device-tier detection
- [x] 04. Design system: chosen theme tokens, type scale, motion rules (transform/opacity only), base components
- [x] 05. StormSync Media 3D intro as the launch screen: short, tiny "Created By: Jay Myers" at the end, tap to skip, off switch in account settings
- [x] 06a. Navigation registry, every launch route with PhaseNotice, menu framework with declared spots and collision resolver, default menus (Corner Sweep, Morph FAB)
- [x] 06b. Remaining main-menu styles (Radial Plates, Glass Ledger, Split Sidebar, Mega Spotlight, Bento Board, Live Bento, Tab Bar + Sheet, Swipe Tabs, Bottom Rail Pop, StormSync Vortex, Notch Bar)
- [x] 06c. Remaining second-menu styles (Depth Drawer, Speed Dial, Curtain Reveal) and menu preferences stored per user
- [x] 07. Second-menu lists, defaults set from the admin panel (menus and theme), menu fixes (Radial Plates, Speed Dial; Color Morph Bar and Flip Tiles were not offered, so their fixes stay in the lab)
- [x] 08. Accounts: 4-digit PIN sign-in with lockout, email link, Google (Apple dropped); signup form (editable), referral codes; owner account; RLS on every table
- [x] 09. Roles: user, SSWX Member, Admin as a second role, subscription tiers mapped to roles
- [x] 10. Saved location, permission flow and a shared weather-data layer with caching
- [x] 10b. Storage safety: retention rule on every growing table (test-enforced), daily size watchdog (Vercel cron, emails at 60%/80%), cron history pruning. Database side waits on the ops migration being applied.
- [x] 10c. Shared map component: Mapbox GL v3 with automatic MapLibre v6 fallback at the monthly free limit

## Admin Panel (built early so later pages plug into it)
- [x] 11. Admin shell, owner-only access, add admins with per-section permissions, audit log
- [x] 12. News & Announcements editor (mobile-first, rich, image upload, schedule)
- [x] 13. Admin: outline requests + VIP AdminPanel port + chosen extras, part 1
- [x] 14. Chosen admin extras, part 2 (signup-form editor, members CSV export; the rest ship with their features, see BuildPlan §6)

## Homepage
- [x] 15. Weather News tab: top 15 auto-collected stories, refreshed 1–2 times a day
- [x] 16. SSWX News tab with the glowing unread section and "unread shows first" rule
- [x] 17. App Updates tab (new members, game winners, releases)

## Localized Data
- [x] 18. Dashboard: movable widgets (right now, 24-hour graph, 7-day, SPC level, UV, sunrise/sunset, moon, wind, pressure trend, feels like, dew point); AQI, pollen and river-gauge widgets join in phases 23 and 46
- [x] 19. Dashboard: WPC subtab (days 1–7 precip, 1-2/1-3/1-5/1-7, rapid drought onset, HeatRisk)
- [x] 20. Dashboard: CPC subtab (6–10, 8–14, monthly, seasonal, drought outlooks) and Fall subtab (first-color reports with a time scrubber; per-site, not state colors — see BuildPlan bug/decision note)
- [x] 21. Daily Brief: in-app, push and email, with schedule options (texts requested by members appear in the admin panel; owner sends them)
- [x] 22. Forecast Discussion: AI "Simplified" tab and restyled "Standard" tab (+ AI usage meter in Live ops)
- [x] 23. AQI & Pollen (port from VIP: AQI Outlook, Pollen Index) + dashboard widgets + brief line
- [x] 24. Mosquito Index (port from VIP, restyled)
- [x] 25. Daylight Tracker (rebuilt, modeled on Max Velocity's)

## Community
- [x] 26. Forecast Game (port from VIP, redesigned)
- [x] 27. Daily Trivia with admin question and points editor
- [x] 28. Leaderboard (weekly, monthly, yearly) with admin points and past-winner entry
- [x] 29. Weekly Polls with admin scheduling
- [ ] 30. (moved to post-launch: Raffles)

## Severe Weather
- [x] 31. SSWXCon Score (port, v2 formula approved)
- [x] 32. Warnings & Reports (port)
- [x] 33. SPC & Probability (two subtabs, port)
- [x] 34. Mesoscale Discussions (port)
- [x] 35. Atmospheric Ingredients (port: SWTI ring, 72-hour scrubber, ingredient cards with sparklines, SWTI parts, model agreement)
- [x] 36. Storm Timing Index (port of VIP Severe Timing: worst window with after-dark warning, tappable 72-hour ribbon with night shading, three day cards, hazard cards, chances chart, hourly table; chances held back by available instability)
- [x] 37. Tropical Outlook (port: basin map with outlook areas, cones, tracks, forecast points, past tracks and coastal watches; storm cards with forecast table and NHC products; parsed 7-day text outlooks with chance bars; GOES GeoColor basin and storm-floater loops that decode every frame first and dissolve between frames)
- [x] 38. Tropical Model Battle Royale (14-model roster from NHC ATCF a-decks incl. Google DeepMind (GDMN); newest tracks on the map with toggles and the best track; leaderboard scored against the NHC best track at 24/48/72 h with podium, wins and the CLIPER baseline)
- [x] 38b. Tropical: Google AI Cyclone Model subtab beside the ported hurricane tracker (Google DeepMind GDMN from NHC ATCF: last 4 runs vs the NHC track and best track, rank among the roster, average miss vs NHC, distance apart, winds chart; the 50-member Weather Lab spread needs a Google sign-in, so it is linked, not embedded)
- [x] 39. Hazards & Droughts (port, beyond VIP's static images: your-area card with Drought Monitor category, hazards over you and your state's drought trend; interactive CPC 3–7 / 8–14 day hazards map with tap details and merged list; interactive Drought Monitor map, national category bars and 13-week trend; CPC drought outlooks)
- [x] 40. Flooding Outlook (port: your answer first with worst day, WPC rain totals and active NWS flood alerts at your location; five-day strip with national top level and yours; interactive Excessive Rainfall map with tap details; level guide; WPC rainfall totals maps)
- [x] 41. Fire Weather with active wildfires, perimeters and details (NIFC WFIGS fires of 10+ acres colored by containment and sized by acres, burn perimeters, tap-for-details cards with acres, containment, start, personnel, cause and behavior; fires nearest you and Red Flag/Fire Weather alerts at your location; sortable fire list; SPC day 1–2 fire outlooks as a map overlay and their own map)
- [x] 42. Winter Center (port of VIP's five subtabs: storm map with WSSI impact and NOHRSC snow depth/SWE overlays on the live map; WPC day 1–3 odds of 4/8/12" snow and ¼" ice as vector maps with per-amount chips; national winter alerts grouped by type and state; your 72-hour snowfall/temperature timeline with the freezing line; snow-belt city snowfall board; your week with first flakes and alerts on top)
- [x] 43. Storm Chasing Outlook with stats that persist across days (daily engine: SPC Day 1 risk areas scanned on a 1° grid with Open-Meteo instability, shear, helicity, STP, cap, cloud base and daylight; two best targets 250+ km apart saved to chase_days by cron, or by the first visit; score hero, target map, Overview, Parameters comparison, Storm Mode with motion and hail size, Bust odds with reasons, Yearly ledger: percentile, chase days, average, best day, streak, daily bars)
- [x] 44. Severe Weather History rebuilt for speed (Ryan Hall's history page as the bar; server-projected paths with week-long caching for finished years: a full year of DAT tornado tracks is 163 KB and opens in ~40 ms cached; 30-day IEM warning archive with impact tiers; stat bands, composition bars, EF filters, by-month chart, longest tracks, downloadable maps)

## Tools & Other Data
- [x] 45. Radar & Model Runs on one page with subtabs (port: Radar tab with NEXRAD base reflectivity looping its last 50 minutes as preloaded fading layers plus hybrid-scan, echo tops, hydrometeor class, MRMS composite/VIL/1-hour rain/precip type and GOES IR/true color/water vapor, 4-minute refresh, centered on you; Model Runs tab playing the newest complete GFS and NAM runs from NOAA NCEP MAG maps with decode-first smooth playback; Model Compare tab with HRRR, NAM, GFS, ECMWF, ICON and GEM temperature and rain for your spot plus an agreement line)
- [x] 46. River & Flood Gauges with the top 5 worst gauges (summary band, worst 5 with stage bars + tap-for-hydrograph, national dot map, forecast-to-flood list, gauges near you)
- [x] 47. 3D Soundings map with clickable soundings and hodographs (balloons + HRRR, RAP, NAM 3 km, NAM, GFS via IEM BUFKIT; 3D wind profile, Skew-T, hodograph, parameters, run scrubber)
- [x] 48. StormNet (when API approved), chosen Google DeepMind items, Traffic Cameras (owner-only until approved). Traffic Cameras built, owner-only (Caltrans, NYC DOT, Iowa DOT incl. road-weather cams, INDOT/KYTC, ALERTCalifornia wildfire cams; near you, inside active warnings, map). DeepMind Weather Lab cyclone tracks shipped in 38–39. StormNet waits on their API approval (its page says so).

## Specialty Monitoring
- [x] 49. Star Gazing Forecast map (blended night-sky outlook, our style): smooth national score field (tonight, tomorrow night, by hour, tap any spot), your night with factor bars, dark and moon times, hour-by-hour, deep-sky targets (VIP astro, score and catalogue ported)
- [x] 50. Astronomy (Moon & Astronomy port): true-phase moon, planets tonight (JPL elements), 24 h sun/moon arcs, sun times and day length, season track, lunar phases, meteor showers with moon interference
- [x] 51. Aurora Center with view-line map, image download and interactive mode: your chance (oval, view line, Kp needed), interactive OVATION map with oval edge and view line, SWPC image with download (both hemispheres), Kp past day + 3-day forecast with G-scale, real-time solar wind (Bz, speed, density)
- [x] 52. Lightning Monitoring (rebuilt): lightning around you (nearest distance and direction, 10/30/60 mi coverage, trend, 120-mile scope), live 2-hour NOAA loop, national hotspots by town, NWS safety
- [ ] 53. (moved to post-launch: FairWeather Tracking)

## Educational
- [x] 54. Climatology: tornado, lightning and hurricane subtabs: near-you records (tracks within 25 mi, storms within 60 mi, LIS flash rate by month), national tornado density, hurricane passage density, yearly/monthly/hourly/EF/state charts, season curves, ACE seasons; data built by scripts/build-climo.py
- [x] 55. Weather Glossary (port): all 168 VIP terms, search, topic chips, A–Z jump, linkable terms
- [ ] 56. Free Content Library (port from Academy)

## Everything Else
- [x] 57. Weather Patterns (port; Fix-It #6.7: AI recaps of the past week, month and year from SPC reports)
- [ ] 58. Extras: engine pipeline (scheduled Python jobs writing map layers)
- [ ] 59. Extras: first engines (Radar Blind Spot, ProbTor, ProbHail)
- [ ] 60. Extras: next engines (chosen in the questionnaire)
- [ ] 60b. Engine Preview: private admin-only area where post-launch engines are built and shown to the owner for approval before release
- [ ] 61. Disaster Response directory, sign-up form and admin inbox

## Account
- [ ] 62. My Profile
- [ ] 62b. Account settings: menus, offered themes, intro on/off
- [ ] 62c. New-user intro guide covering every section, ending with menu choice; guest showcase guide (first visit, skippable, replay button in the second menu, replays after 7 days) — see `docs/07-PRICING.md`
- [ ] 63. Notifications center with every toggle
- [ ] 64. Signup page `/join` (wow-factor design, tiers + build-your-own + add-ons, live pricing tracker, promotions, coupons, guest-guide button) with Stripe; admin pricing/add-on/promotion/coupon editors; tier access enforcement — see `docs/07-PRICING.md`

## Second menu
- [ ] 65. Official Tornado Archive: data pipeline (significant events, 2000 onward, NWS DAT updates)
- [ ] 66. Official Tornado Archive: replay experience
- [ ] 67. Storm Chasing Log: logging and replay

## Finish
- [ ] 68. Bug, glitch, performance and style sweep
- [ ] 69. Full walkthrough as a real user on every page
- [ ] 70. Packaging: Android .apk, iPhone Home Screen install, launch on Weather.SSWX.Space

Post-launch items (Personal Warnings, Affected Communities, Virtual Store, Services, Partnerships, Non-Profit Campaigns, Donations, Members Suite) go into the BuildPlan's post-launch section and stay off the menus until their work starts.
