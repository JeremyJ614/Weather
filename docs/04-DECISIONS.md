# Owner decisions

Newest wins. Source of each: the Section A/B lab (`picks/selection`), the Theme Lab (`themes/selection`), or chat.

## Look and feel
- **Menus.** Users choose from offered lists. Main offers: Corner Sweep (default), Radial Plates, Glass Ledger, Split Sidebar, Mega Spotlight, Bento Board, Live Bento, Tab Bar + Sheet, Swipe Tabs, Bottom Rail Pop, StormSync Vortex, Notch Bar. Second offers: Morph FAB (default), Radial Plates, Depth Drawer, Split Sidebar, Swipe Tabs, Speed Dial, Curtain Reveal, StormSync Vortex. A user cannot pick the same menu for both. When two chosen menus put controls in the same place, the second one moves to its next free spot (each menu declares its preferred spots). Defaults are set in the admin panel; users change theirs in account settings.
- **Menu fixes.** Radial Plates: dark with bright outlines, better icons. Speed Dial: better icons. Color Morph Bar: dark colors, never opens search or the keyboard on its own. Flip Tiles: show that the board scrolls.
- **Themes.** Default palette VIP Gold, default fonts Editorial Crown. Offered palettes: Twilight Silver, Storm Cell, Pastel Frost, Pastel Nebula, Sapphire Court, Amethyst Crown, StormSync Royal, VIP Gold. Users can either pick a ready-made template (the saved combos below) or mix their own palette + font set from every palette and font set used in those combos plus the offered lists. Saved combos (templates): Silver+Storm Desk, Frost+Mission Control, Royal+Radar Room, VIP+VIP Classic, Titanium+Arcade Storm, Steel Rose+Clean Pro, Slate Storm+Logo Match, Thunderhead+Broadcast, Carbon+Royal Seal, Midnight Ink+Radar Room, Ash & Ember+Field Report, Nightshade+Velocity, Eclipse+VIP Classic. Theme changer lives in account settings only, never in the intro guide, and shows only what the owner offers.
- **Intro screen.** The 3D StormSync Media intro (pending final approval). Short. Tiny "Created By:" / "Jay Myers" appears in a corner at the same moment the StormSync Media lockup completes. Two versions for the owner to choose: original cube, or storm edit (lightning bolt that becomes a tornado on impact). Every user can turn it off completely in account settings.
- **Intro guide.** New users get a guided tour of everything and how to do it, ending with picking their main and second menus (or keeping defaults).

## Platform
- **Hosting.** Vercel Hobby until revenue covers Pro.
- **Install.** iPhone: Home Screen now, App Store later. Android: .apk now, Google Play later.
- **SMS.** Offer it; the owner sees requests in the admin panel and sends texts outside the app.
- **Engines.** Repo goes public at launch so scheduled engine runs are free; hourly while private only if within limits.
- **Pricing.** The owner supplies his own pricing before the signup phase.
- **Maps.** Every map, including ported ones, uses one shared map component: Mapbox GL JS (newest v3) with ONE key, switching automatically to MapLibre GL JS v6 when our own monthly map-load counter nears the free limit, and back when the month resets. Not rotating several accounts' keys: that breaks Mapbox's terms and risks all accounts being closed.
- **Storage safety.** No rendered images stored in Supabase; every growing table has a retention rule; a daily watchdog reports database and storage size to the admin panel with alerts at 60% and 80% of quota. See `docs/06-STORAGE-SAFETY.md`.

## Admin panel
Outline's requests + VIP AdminPanel (what fits) + the owner's 19 chosen extras + more of our own. Goal: see and control anything.

## Engines
- **At launch:** ProbTor, ProbHail, Nocturnal LLJ, Wildfire/PyroCb, Radar Blind Spot, Landspout/Waterspout, Rotation Track Persistence, Snow Squall, Landfalling Hurricane Tornado Risk.
- **Post-launch, built first in a private admin-only preview for approval:** Convective Initiation, Supercell Merger, Derecho Corridor, Dryline/Triple Point, Photogenic Supercell, Streamwise Vorticity, Cap Bust Meter, Downburst Potential, Lightning Jump, Airmass Recovery, Tropical RI Watch, Training Storms.
- **Skipped:** Burn Scar, Dense Fog, Hail Footprint, Heat Burst, Freezing Rain, Intercept Planner.

## House style (owner, after Phase 06)
- **Dark everywhere; the primary color is text, outline and glow, never a fill.** Selected and primary controls use `--lit` (a dark tint of the primary) with primary text and a primary outline. Applied to every menu, Button and Chip.

## Pricing (owner, 2026-10-13)
See `docs/07-PRICING.md`: tiers Free / Basic $1.49 / Storm Chasers $2.99 / Advanced $3.99 / VIP $4.99 (monthly; yearly $0 / $13.99 / $19.99 / $25.99 / $29.99), build-your-own plans, add-ons on any plan ($0.50; Storm Chasing Outlook and Extras $0.75; Storm Chasing Log $1.00; admin-editable), launch promotions for the first 15 and next 10 signups, five ready-made promotions off by default, admin coupons. Guests see Homepage, News and Disaster Response plus a showcase intro that replays every 7 days.

## Fall Forecast (phase 20)
The outline asked for states colored over time. There is no public peak-foliage forecast, and state-level colors from the only public record (USA-NPN first-color reports) reflect which species volunteers watch, not climate (VIP tested it: New England "turned" a month early). The Fall subtab therefore replays each real report as a dot, colored by how long ago it turned, with a play/scrub timeline. Revisit if a public state-level product appears.

- **Forecast Game (phase 26, 2026-10-13):** VIP's contest scoring kept exactly (placings, consolation, tornado bullseye, quiet-day call). Originally pins locked at noon Eastern; on 2026-10-13 the owner removed the lock: pins move freely until the midnight Eastern reset (today only; members can never set scores; enforced by the database trigger). Scored daily at 13:20 UTC against SPC's storm reports for the convective day; points go to the shared `game_points` ledger that Trivia will use; the month's champion is crowned on the 1st and shown with an award badge. Lives at /wx-games (the nav's "WX Games", phases 26–27).

- **SSWXCon v2 (phase 31, owner approved 2026-10-13):** VIP's buckets, caps, 0–250 scale and band names kept. Fixed: SPC Day 1 risk and active watches add a capped Setup bucket (30) so the score rises before warnings; Tornado Emergency/PDS/observed and considerable/destructive/catastrophic damage tags weigh more; marine hurricane-force and coastal/lakeshore floods no longer count; only warnings count for winter; every active alert is read (no 500 cap); the viewer's local instability is shown beside the national score, not inside it.
- **SPC & Probability (phase 33, owner 2026-10-13):** VIP's map colors and wording kept exactly (including the probability scale's "Near Guaranteed" / "Destructive Storms Guaranteed"). The Forecast Game's SPC map now uses VIP's categorical palette too.
- **Map & data colors (owner 2026-10-13):** an admin page (/admin/colors, permission "colors") changes any map or data color by hex code: SPC palettes, probability scale, EF tornado paths, WPC/CPC/drought, warnings, storm reports, SSWXCon. Overrides live in app_config "color_overrides"; a color reset to its default stops being an override. New colored features register their keys in `src/lib/colors/registry.ts`.

## Fix-It List #4 (2026-10-13)
- Admin panel: no step-up verification; admin rights are tied to the account.
- SSWX News editor: rich WYSIWYG (styles, sizes, fonts, colors, highlights, alignment, bullet/numbered/check lists, indents, callouts, tables, captioned images in four sizes, YouTube, links, date, undo/redo, Markdown-style shortcuts, clean paste from Google Docs, word count, local autosave). Posts are stored as a JSON document in `news_posts.doc`, rebuilt by `cleanDoc` on the server and rendered as React; never stored or rendered as HTML.
- Every national map can zoom and pan; city names appear when zoomed in and get denser further in.
- Subtab switches always animate (slide; fade under reduced motion), independent of the WebGL morph.
- Weather News has an hourly heal job besides the 7 AM run.
- Admin overview: sections in five labeled groups (Content, Games & community, Members, Look & menus, System) as list rows with descriptions and a filter, replacing the tile grid.
- Menu editor (admin → Menu editor, Menus permission): app_config `menu_layout` holds sections, order, page names/icons and hidden pages for both menus; pages built later join their built-in section automatically.
- Admin shortcuts: the owner's switch (stored on their account) adds an Admin group with every built section to their second menu.
- Map & data colors: each group with a live map shows today's real map recolored as you type; a test fails when a color pick isn't in the editor (AGENTS rule 11).
- View as member (VIP port): a lens, not a sign-in. The owner's session never changes; an httpOnly cookie names the member, `getViewer()` returns the member's view for the owner only (re-checked by `lens_target_ok`), admin checks use `getRealViewer()`. The Forecast Game and Trivia read and write through owner-only `lens_*` functions that pay the member and write the audit log under the owner. Daily Brief and poll changes are refused while viewing as. Admins and the owner can't be viewed as.
- Create member (VIP port): admin → Members → New member makes a confirmed account with an optional PIN, an optional sign-in link email and the SSWX Member role; logged.
- Pricing (docs/07-PRICING.md) is live as data: `src/lib/billing/plans.ts` defaults + app_config `billing` edits; plan choices are priced on the server and saved by the service-only `save_plan()`; promo codes in `coupons` (never listed publicly; `coupon_check`). Checkout and page locks wait for Stripe.
- Storm Timing: VIP's hazard chances and threat are multiplied by an instability gate (0 at no CAPE, full from 500 J/kg); VIP showed 20% tornado chances on stable nights from shear alone. The Ingredients page keeps VIP's exact SWTI.
- Signup (Fix-It #5): guests see Homepage, Disaster Response, Plans & Pricing, Log In and Sign Up; any other page sends them to the gate (Sign Up, Log In, Skip to the Homepage), which also opens once after the intro on a first visit. Sign up = email link or Google, then one question per screen (admin → Signup form: reorder, ask/skip, required/optional, own questions saved to `profiles.custom_answers`; name, location, birthday and PIN are always asked), then Plans & Pricing. "Build your own" plans are retired; extra pages are add-ons to a tier. An old custom plan still prices as before until changed.
- VIP admin imports (Fix-It #5):
  - Members: a comped plan sets `subscriptions.comped` (status active, $0, never counted as income).
  - Pages per member: `member_pages` either gives a page (takes effect with page locks at checkout) or closes it (enforced now: the proxy calls `page_closed()` and sends the member to /closed).
  - Referral corrections: `referral_adjust`, ±1 at a time, logged.
  - Revenue: counts only active, billed, non-comped plans.
  - Invoice email: template in app_config; members get it once checkout exists; admins can send themselves a test now.
  - Badges: library plus per-member awards; rarity colors are in the color registry.
  - Notifications: in-app toasts to everyone or one member, read receipts, kept 90 days.
  - Contact inbox: every form posts through `contact_send()` (5 per hour per sender, honeypot); /contact is the first form.
  - System health: `admin_health()`.
  - Page usage: `track_view()` stores one row per page, member and day; kept 180 days.
  - Pruning of the new tables runs in the storage watchdog cron.
- Radar & Model Runs: VIP rendered its own model map frames from GRIB (a Python pipeline we do not run). We play NOAA NCEP Model Analyses & Guidance maps instead (GFS nested folders, NAM flat files, newest run whose last frame exists). HRRR maps are not at a public stable path there, so HRRR appears in Model Compare (Open-Meteo) until one is found.
- 3D Soundings: balloons come from IEM's RAOB archive (only stations that actually launched at the newest 00Z/12Z show on the map; NWS has cut some launches). Model soundings use IEM's BUFKIT API (HRRR, RAP, NAM 3 km, NAM, GFS; every hour of the newest run at the nearest BUFKIT site) instead of Open-Meteo, which is rate-limited on shared server IPs. All parameters are computed in `src/lib/soundings/thermo.ts` from the raw profile and tested.
- Traffic Cameras (Phase 48): owner-only until approved (`CAMS_OPEN` in `src/lib/cams/style.ts` plus `adminOnly` on the menu entry). Only keyless public feeds with still images: Caltrans, NYC DOT, Iowa DOT (traffic + RWIS road-weather), INDOT/KYTC TrafficWise (http-only, served through `/api/cams/img`), ALERTCalifornia wildfire cams. Video-only feeds (MoDOT, Maryland CHART) are left out. States whose feeds need a free developer key wait for the owner to register. "Hazard cams" = every camera inside an active NWS warning area.
- StormNet stays a phase notice until their API is approved. WeatherNext's historical archive (AI scorecard) needs a Google Cloud project; not started.
- Star Gazing (Phase 49): one score for every view (`src/lib/sky/score.ts`, VIP's darkness × cloud × moon × air with layered cloud and visibility added). The national map is a 2.5° × 3° Open-Meteo lattice (one request per 3 hours, CDN-cached) painted client-side as a continuous raster under the land clip. VIP's `astro.ts` and deep-sky catalogue live in `src/lib/sky/` for Astronomy and Aurora to reuse.
- Aurora Center (Phase 51): all NOAA SWPC. The interactive map paints OVATION's North American sector (1° grid) as a Mercator-correct raster; the oval edge is OVATION's 10% line and the view line sits 6° equatorward of it. The headline Kp is the official 3-hour value; the 1-minute estimate is shown beside it. VIP's Kp → view-line table drives "Kp needed at your latitude".
