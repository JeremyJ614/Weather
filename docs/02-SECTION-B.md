# Section B: answers

Written 2026-10-13. These answers feed the questionnaire (Step 3A) and the BuildPlan (Step 4A).

## B1. Can all of this be built for free at first?

**Yes, with four honest exceptions.** Every data source the outline needs is free and public, and every service has a free tier big enough for launch.

| Need | Free option | Free limit that matters |
| --- | --- | --- |
| Website + app hosting | Vercel Hobby | Hobby is for **non-commercial** use. Free while nothing is sold; once subscriptions go live the terms require Vercel Pro ($20/mo). Cloudflare Pages is the free alternative that allows commercial use. |
| Database, logins, storage | Supabase Free | 500 MB database, 1 GB files, 50,000 monthly users. Free projects pause after 7 days with no traffic (a daily ping prevents it). |
| AI (translated discussions, briefs) | Gemini API free tier | Rate-limited per minute and per day. Cache every AI result so each discussion is translated once, not once per user. |
| Weather data | NWS, SPC, WPC, CPC, NHC, USGS, NOAA MRMS, GOES, HRRR (AWS Open Data), IEM, NOAA DAT, SWPC | All free. NWS asks for a contact address in the request header. |
| Maps | MapLibre + free basemaps (the VIP app already does this) | No key, no limit. Your Mapbox keys stay as a fallback (50,000 free map loads a month). |
| Email briefs | Resend (already connected) | 3,000 emails a month, 100 a day on the free plan. |
| Push notifications | Web Push (VAPID) | Free and unlimited. Works on Android, and on iPhone once the app is added to the Home Screen. |
| Payments | Stripe | No monthly fee; about 2.9% + 30¢ per charge, only when you earn. |
| Python engines (Extras page) | GitHub Actions on a schedule | Free on public repos; 2,000 minutes a month on private ones. Enough for hourly runs of a few engines, not every-5-minute runs of all of them. |
| Domain | Weather.SSWX.Space | Already owned. A subdomain is a free DNS record at GoDaddy. |

**The four things that are not free:**
1. **Text-message briefs.** SMS always costs money (roughly 1¢ per text via Twilio). Email, push and in-app briefs are free. Recommendation: launch without SMS and add it when revenue covers it.
2. **The Apple App Store.** Publishing an iPhone app costs $99 a year. The free path is a Progressive Web App: iPhone users tap Share → Add to Home Screen and get a full-screen app icon with push notifications. It looks and feels like a store app.
3. **The Google Play Store** is a one-time $25. It is optional: the same app can be shared as a single **.apk file** that Android phones install directly, which is exactly the "one file people download" you described. iPhones cannot install a file like that, so iPhone users use the Home Screen route.
4. **Charging subscriptions on Vercel** needs Vercel Pro (see above), or a move to Cloudflare Pages, which stays free.

## B2. Your prototype engines for the Extras page

**Short answer:** all of them can live on one Extras page and run smoothly, because none of the heavy math runs on the phone. A scheduled Python job does the work, saves small map layers (GeoJSON), and the page only draws them, one tab at a time. Some can be accurate; others can only ever be experimental indexes. That needs to be said on the page, and every engine gets an "Experimental" badge and a "How this works" panel.

The biggest shortcut: **NOAA/CIMSS ProbSevere v3 is public and free.** It already gives per-storm tornado, hail and wind probabilities from MRMS, satellite, lightning and the HRRR. Building on it instead of from scratch makes ProbTor and ProbHail far more accurate on day one.

| Engine | Verdict | Accuracy you can claim | Notes |
| --- | --- | --- | --- |
| ProbTor 0–60 min tornadogenesis | Buildable | Good at 0–20 min, weak beyond 30 | Start from ProbSevere's tornado probability, add AzShear trend and GLM lightning jumps, project along storm motion as cones. Calibrate against tornado warnings and reports before showing 60-minute numbers. |
| ProbHail 2"+ swath and size | Buildable | Good 0–30 min | MESH plus storm motion makes a reliable short swath. Show 1", 1.75", 2.5"+ as probability bands, never as "will hit". MESH overestimates in some storm types. |
| Convective Initiation 90-min | Buildable | Fair | GOES cloud-top cooling + HRRR CIN erosion + first radar echoes. Output probabilities at 30/60/90 min, as fuzzy areas not hard polygons. |
| Supercell Merger & Boundary Interaction | Hard | Experimental only | Tracking cells and boundaries is doable; predicting "constructive vs destructive" is research-grade. Show "possible interaction in ~N minutes" with the storms and boundary highlighted, no outcome label. |
| Nocturnal LLJ Ramp-Up | Buildable | Good (it is a forecast of the jet, which models do well) | HRRR/RAP 850 and 925 mb winds, 0–1 km SRH, MUCAPE. Drop AzShear from this one, as ChatGPT said. |
| Derecho & Bow Echo Corridor | Buildable | Fair at 6–12 h | Environment outlook from shear, DCAPE, Corfidi vectors and cold-pool signals. Radar RIJ notches only describe storms already there. |
| Dryline Bulge & Triple Point | Buildable | Fair | Detect the dryline from HRRR dewpoint gradients; output probability shading, not "2 to 3 exact counties". |
| Photogenic Supercell & Viewshed | Buildable and fun | Not verifiable, entertainment | LCL, precipitation efficiency, anvil-level storm-relative winds and sun angle make a 0–100 Structure Score. Great for chasers. |
| Wildfire Blowup & PyroCb | Buildable | Fair | GOES Fire Radiative Power + smoke + HDWI + inverted-V soundings. Pairs with the Fire Weather page. |
| Radar Horizon Blind Spot | Buildable and **precise** | High (it is geometry) | Beam height from the 4/3 Earth model + terrain. Computed once per radar, shown as a static layer. Cheapest and most trustworthy engine. |
| Streamwise Vorticity Current Mapper | Buildable | Experimental | HRRR's 3 km grid smooths the small features this hunts for. Show as a research layer. |
| Non-Supercell Landspout & Waterspout | Buildable | Fair | Close to SPC's Non-Supercell Tornado parameter, which is a proven starting point. |

Your outline's Extras list also names Tornado Probability, Waterspout Forecasting and Airmass Recovery; those map onto ProbTor, the landspout/waterspout index and a new recovery engine below.

**Performance plan:** each engine is its own tab and loads its layer only when opened. The map stays one MapLibre instance shared by all tabs. Layers update on a fixed schedule (every 10, 30 or 60 minutes depending on the engine), so the page never waits on a computation.

## B3. More engines we could build

Each uses only free radar, MRMS, satellite or model data.

1. **Lightning Jump Alert.** GLM flash rate per storm; a sudden jump often comes 10–20 minutes before severe weather. Simple and well researched.
2. **Rotation Track Persistence.** MRMS 30/60-minute rotation tracks drawn as glowing trails, so people see which storms have kept rotating.
3. **Training Storms & Flash Flood Corridor.** Finds storms repeatedly crossing the same ground using Corfidi vectors and MRMS rainfall totals.
4. **Burn Scar Debris-Flow Watch.** MRMS rain rates over recent wildfire burn scars, the setup for deadly debris flows.
5. **Cap Bust Meter.** For big setups: how likely the day underperforms, from HRRR ensemble CIN spread and initiation timing. Chasers would love it.
6. **Airmass Recovery Clock.** After morning storms, estimates when instability returns by afternoon. Already on your list; this makes it a countdown.
7. **Chaser Intercept Planner.** Storm motion + road network = the best roads and timing to intercept a storm safely. Unique to us.
8. **Downburst & Microburst Potential.** DCAPE, precipitable water and lapse rates (the microburst index) for aviation and outdoor events.
9. **Hail Damage Footprint.** Combines past MESH swaths with population to estimate where roofs and cars were hit; feeds Disaster Response.
10. **Snow Squall Threat.** The SPC Snow Squall Parameter mapped hourly for the Winter Center; whiteout risk for drivers.
11. **Freezing Rain Accretion.** Ice thickness forecast with power-outage risk tiers.
12. **Dense Fog for Drivers.** GOES night fog product + surface visibility along interstates.
13. **Tropical Rapid Intensification Watch.** Sea-surface temperature, ocean heat content and shear for the Tropical page's Battle Royale.
14. **Landfalling Hurricane Tornado Risk.** Shear and helicity in the outer bands of a landfalling storm.
15. **Heat Burst & Wake Low Detector.** Spots sudden overnight temperature spikes and pressure falls from surface stations. Rare, but a great "wow" story when it happens.

## B4. Phase list

See `docs/03-PHASES.md`. Each phase is small enough to finish and verify in one session, is pushed when done, and is checked off there.
