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
- [ ] 06c. Remaining second-menu styles (Depth Drawer, Speed Dial, Curtain Reveal) and menu preferences stored per user
- [ ] 07. Second-menu lists, defaults set from the admin panel, and the four menu fixes (Radial Plates, Speed Dial, Color Morph Bar, Flip Tiles)
- [ ] 08. Accounts: 4-digit PIN sign-in with lockout, email link, Google, Apple, text code; signup form (editable), referral codes; owner account; RLS on every table
- [ ] 09. Roles: user, SSWX Member, Admin as a second role, subscription tiers mapped to roles
- [ ] 10. Saved location, permission flow and a shared weather-data layer with caching

## Admin Panel (built early so later pages plug into it)
- [ ] 11. Admin shell, owner-only access, add admins with per-section permissions, audit log
- [ ] 12. News & Announcements editor (mobile-first, rich, image upload, schedule)
- [ ] 13. Admin: outline requests + VIP AdminPanel port + chosen extras, part 1
- [ ] 14. Chosen admin extras, part 2

## Homepage
- [ ] 15. Weather News tab: top 15 auto-collected stories, refreshed 1–2 times a day
- [ ] 16. SSWX News tab with the glowing unread section and "unread shows first" rule
- [ ] 17. App Updates tab (new members, game winners, releases)

## Localized Data
- [ ] 18. Dashboard: movable widgets (daily, 7-day, SPC level, UV, 5–10 more)
- [ ] 19. Dashboard: WPC subtab (days 1–7 precip, 1-2/1-3/1-5/1-7, rapid drought onset, HeatRisk)
- [ ] 20. Dashboard: CPC subtab and Fall Forecast subtab with the state color time scrubber
- [ ] 21. Daily Brief: in-app, push and email, with schedule options
- [ ] 22. Forecast Discussion: AI "Simplified" tab and restyled "Standard" tab
- [ ] 23. AQI & Pollen (port from VIP: AQI Outlook, Pollen Index)
- [ ] 24. Mosquito Index (port from VIP, restyled)
- [ ] 25. Daylight Tracker (rebuilt, modeled on Max Velocity's)

## Community
- [ ] 26. Forecast Game (port from VIP, redesigned)
- [ ] 27. Daily Trivia with admin question and points editor
- [ ] 28. Leaderboard (weekly, monthly, yearly) with admin points and past-winner entry
- [ ] 29. Weekly Polls with admin scheduling
- [ ] 30. (moved to post-launch: Raffles)

## Severe Weather
- [ ] 31. SSWXCon Score (port)
- [ ] 32. Warnings & Reports (port)
- [ ] 33. SPC & Probability (two subtabs, port)
- [ ] 34. Mesoscale Discussions (port)
- [ ] 35. Atmospheric Ingredients (port)
- [ ] 36. Storm Timing Index (port)
- [ ] 37. Tropical Outlook (port) with smoother playback
- [ ] 38. Tropical Model Battle Royale (includes Google Weather Lab AI tracks)
- [ ] 38b. Tropical: Google AI Cyclone Model subtab beside the ported hurricane tracker
- [ ] 39. Hazards & Droughts (port) plus the interactive hazards map subtab
- [ ] 40. Flooding Outlook (port)
- [ ] 41. Fire Weather with active wildfires, perimeters and details
- [ ] 42. Winter Center (port)
- [ ] 43. Storm Chasing Outlook with stats that persist across days
- [ ] 44. Severe Weather History rebuilt for speed (Ryan Hall's history page as the bar)

## Tools & Other Data
- [ ] 45. Radar & Model Runs on one page with subtabs (port)
- [ ] 46. River & Flood Gauges with the top 5 worst gauges
- [ ] 47. 3D Soundings map with clickable soundings and hodographs
- [ ] 48. StormNet (when API approved), chosen Google DeepMind items, Traffic Cameras (owner-only until approved)

## Specialty Monitoring
- [ ] 49. Star Gazing Forecast map (blended night-sky outlook, our style)
- [ ] 50. Astronomy (Moon & Astronomy port)
- [ ] 51. Aurora Center with view-line map, image download and interactive mode
- [ ] 52. Lightning Monitoring (rebuilt)
- [ ] 53. (moved to post-launch: FairWeather Tracking)

## Educational
- [ ] 54. Climatology: tornado, lightning and hurricane subtabs
- [ ] 55. Weather Glossary (port)
- [ ] 56. Free Content Library (port from Academy)

## Everything Else
- [ ] 57. Weather Patterns (port)
- [ ] 58. Extras: engine pipeline (scheduled Python jobs writing map layers)
- [ ] 59. Extras: first engines (Radar Blind Spot, ProbTor, ProbHail)
- [ ] 60. Extras: next engines (chosen in the questionnaire)
- [ ] 60b. Engine Preview: private admin-only area where post-launch engines are built and shown to the owner for approval before release
- [ ] 61. Disaster Response directory, sign-up form and admin inbox

## Account
- [ ] 62. My Profile
- [ ] 62b. Account settings: menus, offered themes, intro on/off
- [ ] 62c. New-user intro guide covering every section, ending with menu choice
- [ ] 63. Notifications center with every toggle
- [ ] 64. Signup with the live price tracker, editable form and Stripe

## Second menu
- [ ] 65. Official Tornado Archive: data pipeline (significant events, 2000 onward, NWS DAT updates)
- [ ] 66. Official Tornado Archive: replay experience
- [ ] 67. Storm Chasing Log: logging and replay

## Finish
- [ ] 68. Bug, glitch, performance and style sweep
- [ ] 69. Full walkthrough as a real user on every page
- [ ] 70. Packaging: Android .apk, iPhone Home Screen install, launch on Weather.SSWX.Space

Post-launch items (Personal Warnings, Affected Communities, Virtual Store, Services, Partnerships, Non-Profit Campaigns, Donations, Members Suite) go into the BuildPlan's post-launch section and stay off the menus until their work starts.
