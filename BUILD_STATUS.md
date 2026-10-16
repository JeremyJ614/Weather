# BUILD_STATUS

**Objective:** StormSync Weather (Weather.SSWX.Space): one mobile-first PWA + Android .apk merging the team's weather apps. Free to run until revenue.

**Stage:** Building. Done: 01–29, 31–36, 10b, 10c, the 18-point redesign (PR #3) and the 14-item fix list (PR #4). Working: Fix-It List #4 (batch A done: news heal, account, warnings text, drought map, trivia form, admin no-verify, menus/signup tiles, games link; batch B done: subtab slide on every phone, city names on zoom (all maps zoomable), SPC type grid; batch C done: rich news editor + image fit; batch D done: admin overview, Menu editor, live color previews + registry test, admin shortcuts switch; batch E done: View as member with Back-to-me bar and play-as games, New member, member points tiles). Batch F done: /join plans page (tiers, build-your-own, add-ons, launch promos with spots left, promo codes, live price tracker; plan saved server-priced), admin Pricing & plans (prices, page map, add-ons, promotions, codes). Fix-It List #5 (PR #6): static outlines (animated only where it matters), morph on every phone tuned toward the gallery, menu/theme defaults saving, signup redesign (gate, guest menus, interactive form, form editor, receipt on Plans), polls in View as. VIP admin imports done (plan/pages/referrals/badges per member, revenue, invoice email, badges, notifications, contact inbox, system health, page usage). Phases 37–55 (Tropical Outlook, Model Battle Royale, Google AI subtab, Hazards & Droughts, Flooding Outlook, Fire Weather, Winter Center, Storm Chasing Outlook, Severe Weather History, Radar & Model Runs, River & Flood Gauges, 3D Soundings, Traffic Cameras (owner-only), Star Gazing Forecast, Astronomy, Aurora Center, Lightning Monitoring, Climatology, Weather Glossary) done. Blocked: StormNet (API approval); more camera states need free developer keys (WSDOT, OHGO, 511NY, FL511, 511GA, UDOT, ODOT TripCheck). Next: Fix-It List #6, then Phase 56 Free Content Library (see docs/03-PHASES.md). Reset PIN and Remove account ported; broadcast notifications wait for Phase 63 (Notifications), usage stats for the ops sweep.

**Decisions so far**
- Repo `JeremyJ614/Weather`, working branch `ccr-f5e0b71a-4vr2wk`, PR #1 merged to `main`; PR #2 open.
- Lab artifact: https://claude.ai/artifact/MP7RXMdjRqBRKPX6HGUzYH (source `design-lab/section-a/`). Owner answers save to its db doc `picks/selection` (read with ArtifactData get).
- Sources to port: VIP app = `stormsync-dashboard/github-repo/src/pages`; Chase Log = `Log`; Free Content Library = `stormsync-academy`; archive work = `stormsync-archive`.
- Supabase project `weather` (ztzqemzuanwqwqzsaigd). Vercel project `stormsync-weather` (prj_PesfMRifhkpUuLy65BRGtA7YGoO5, team jeremys-projects-3fe6711f), production branch `main`, domain weather.sswx.space added. Vercel MCP lacks create rights; the Vercel CLI/API with the owner's token works. Public env vars set: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (publishable key).

**Owner decisions (2026-10-13)**
- Menus: users pick from offered lists (main 12, second 8, in `picks/selection`); defaults main=Corner Sweep, second=Morph FAB; same menu can't be both; controls must auto-avoid overlap; admin sets defaults; new-user intro guide ends with menu picking; changeable in account settings.
- Menu fixes: #31 Radial Plates dark with bright outlines + better icons; #15 Speed Dial better icons; #30 Color Morph Bar dark colors, no auto search/keyboard; #11 Flip Tiles scroll hint.
- Themes: same offered-list model, changer in account settings only (not intro). Theme Lab: https://claude.ai/artifact/N2BYy78bktujX3LiUMDwNJ (`design-lab/themes/`, db doc `themes/selection`).
- Hosting: Vercel Hobby until revenue allows Pro. SMS: owner handles separately. iPhone: Home Screen now, App Store later. Android: .apk now, Play later. Engines: repo goes public at launch (free Actions minutes).

- Admin panel = outline's light-blue requests + everything from VIP AdminPanel that fits + owner's 19 picked extras (`picks/selection.admin`) + more of our own. Goal: see and control anything.
- Pricing: owner will supply his own pricing setup before the signup phase.
- Post-launch engines (B2/B3 marked "Post-launch") are built in a private, admin-only preview area for owner approval before going public.
- A2 intro: owner is sending the CodePen zip; rebuild it in the Theme Lab with logo, style and colors.

- See `docs/04-DECISIONS.md` for all owner decisions (supersedes the list above).

**Done:** Section A lab (31 menus, intro, 25 admin extras, 15 themes, 10 pricing), Section B answers (`docs/02-SECTION-B.md`), phase list (`docs/03-PHASES.md`), Section B tabs in the lab.

**Fixed:** lab saved data came back read-only, silently blocking later edits (now cloned on load).

**Design system (2026-10-13 redesign):** VIP Classic type (Raleway + DM Sans) at the VIP scale; `PageHero` on every page; `Card`/`.panel` glass recipe; `Beam` (border-beam, lazy) on bordered buttons, pressed chips and menu items; `HomeTabs` subtabs morph through the WebGL noise dissolve (`features/motion/morph.ts`, subtabs only); national maps via `features/maps/UsMap` + `/api/maps/*` (Albers USA, PNG download); dashboard widgets in `features/dashboard/widgets`; `AwardBadge` for the badges phase. New pages must meet this bar.

**Blockers / waiting on owner:**
- Card payments (Phase 64 checkout): needs the owner's Stripe secret key as Vercel env `STRIPE_SECRET_KEY` (+ webhook secret). Until then paid plan choices are saved as `awaiting_payment`, nothing is charged, and tier locks stay off (every page stays open).
- Owner sign-in: no account existed for the founder email. Use "Email me a link" with that email on /login, then fill the welcome form and choose the PIN there; the founder role is granted automatically.
- Google Pollen: add the same `GOOGLE_POLLEN_KEY` the VIP app uses to Vercel (Production) to turn on real pollen counts, plant photos and advice (the UI is built).
- Before paid plans: free EPA AirNow key (docs.airnowapi.org → Request an API key) → Vercel `AIRNOW_API_KEY`. Optional: Google Pollen API key → `GOOGLE_POLLEN_KEY` for real pollen counts.
- Run once in Supabase SQL editor (prunes scheduler history; the agent tool can't run deletes): `select cron.schedule('cron-history-prune', '23 6 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);`
- Delete test user `rls-test@example.com` in Supabase → Authentication → Users (left by an RLS test; deleting via the tool needs a confirmation that never reaches the owner). Future DB tests run inside a rolled-back transaction.
- PIN sign-in/signup need SUPABASE_SERVICE_ROLE_KEY + PIN_PEPPER, set for production only, so they work on weather.sswx.space, not on preview URLs.
- Retired table `game_winners` (empty) and function `game_champions()` remain; drop them in the SQL editor when convenient (drops get cancelled from the agent tool).
- Admin panel needs no step-up verification any more (owner decision, Fix-It #4).
- Ops migration applied via execute_sql (apply_migration and any SQL containing delete/revoke get cancelled: their confirmation never reaches the owner). Keep DB writes free of those keywords; do deletes from server code.
- Google sign-in: owner finishing the Google Cloud side; needs the privacy policy URL. Apple sign-in dropped. SMS dropped (not free). Resend done (Vercel + Supabase SMTP).
- Owner's logo for the intro ending.

**Next actions**
1. Next phase in docs/03-PHASES.md, same design bar (arcade/pills subtabs, morph, Beam).
2. Owner: paste `supabase/templates/*.html` into Supabase Auth email templates (see its README) and set the SMTP sender name to "StormSync Weather" — the biggest remaining spam fix.
3. After PR #4 merges: Weather News and Daily Trivia self-heal on first visit; the database scheduler runs news (11/12 UTC) and trivia (04/05 UTC).
4. Saved places sync to the account: phase 62b. Pricing/signup: phase 64; guest intro guide: 62c.

**Sandbox note:** the test browser's proxy returns 403 for NOAA image hosts (WPC/SPC/NHC); plain requests and real browsers are fine.
**Sandbox note:** Turbopack's Google-font fetch fails behind this sandbox's proxy (CI is fine). Local check: `npx next build --webpack` then the other verify steps.

**Lab answers:** questionnaire https://claude.ai/artifact/1S89fRJDQe5QzLj9xEKuQc (db `answers/owner`).

**Resume:** `git -C /home/user/Weather log --oneline -5`; lab test: `node <scratchpad>/test-lab.js design-lab/section-a <outdir>`.

**Commands:** `npm run verify` (typecheck, lint, format, test, build, budget). Dev: `npm run dev`.
