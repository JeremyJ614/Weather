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

- **Forecast Game (phase 26, 2026-10-13):** VIP's contest scoring kept exactly (placings, consolation, tornado bullseye, quiet-day call). One change for fairness: pins lock at **noon Eastern** (VIP allowed locking until midnight, after storms had fired). Enforced by the database trigger, not just the page. Scored daily at 13:20 UTC against SPC's storm reports for the convective day; points go to the shared `game_points` ledger that Trivia will use; the month's champion is crowned on the 1st and shown with an award badge. Lives at /wx-games (the nav's "WX Games", phases 26–27).
