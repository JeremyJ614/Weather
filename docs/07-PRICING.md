# Pricing, promotions and the signup page (owner, 2026-10-13)

Built in phase 64 (signup + Stripe) with the guest intro in phase 62c. Prices are USD.

## Model
- **Subscription tiers** (templates below) **or a custom plan**: the member picks exactly the pages they want.
- **Add-ons on any plan:** any page or module can be added to any subscription. Price **$0.50/month** each,
  except **Storm Chasing Outlook $0.75**, **Extras page $0.75**, **Storm Chasing Log $1.00**.
  Every add-on price is editable in the admin panel.
- **Referral program** (phase 08) stays on top of everything below.

## Guests (no account)
Homepage · News · Disaster Response.

**Guest intro guide:** first visit only, a showcase of everything the app does (like an advertisement,
not a how-to; no menu or theme steps). Skippable. A **Replay** button sits in the second menu.
It plays again after 7 days. Also playable from the signup page ("See what you get").

## Tiers
| Tier | Monthly | Yearly | Pages |
| --- | --- | --- | --- |
| Free | $0.00 | $0.00 | Homepage, News, Dashboard, Forecast Discussion, Radar & Model Runs, SPC, WX Games, Leaderboard, Weekly Polls, Weather Glossary, Free Content Library, Disaster Response |
| Basic | $1.49 | $13.99 | Free + Daily Brief, AQI & Pollen, Mosquito Index, Daylight Tracker, Mesoscale Discussions, Storm Timing Index, Hazards & Droughts, Flooding Outlook, Traffic Cameras (if built), Official Tornado Archive |
| Storm Chasers | $2.99 | $19.99 | Basic + Atmospheric Ingredients, Tropical Outlook, Storm Chasing Outlook, Severe Weather History, 3D Soundings, Weather Patterns, Storm Chasing Log |
| Advanced | $3.99 | $25.99 | Basic + SSWXCon Score, Warnings & Reports, Atmospheric Ingredients, Fire Weather, Winter Center, Severe Weather History, River & Flood Gauges, Star Gazing Forecast, Astronomy, Climatology (no Tropical Outlook, Storm Chasing Outlook, 3D Soundings, Weather Patterns or Storm Chasing Log; add-ons cover those) |
| VIP | $4.99 | $29.99 | Everything, forever, plus early and beta access to every future update |

The owner's lists are the source of truth; the page-to-tier map lives in code (`src/lib/billing/plans.ts`, phase 64) and is editable in the admin panel.

## Launch promotions (on at launch)
1. **First 15 signups:** month 1 free (100% off), month 2 50% off.
2. **Next 10 signups** (after the first 15 fill): month 1 75% off, month 2 50% off.

## Ready-made promotions (built, off until the owner turns them on)
3. **Storm Season Kickoff:** 30% off the first 3 months (suggested March–May).
4. **Go Yearly:** 20% off the first year of any yearly plan.
5. **Bring a Friend:** when a referral signs up, both get their next month free (on top of normal referral rewards).
6. **Hurricane Season Pass:** Storm Chasers 40% off June 1–November 30.
7. **Holiday Bundle:** any yearly VIP includes 2 add-ons free for the year (suggested Nov 20–Dec 31).

## Admin
- Edit tier prices, the tier→page map and add-on prices.
- Create, edit, turn on/off any promotion (limits by date, tier, number of uses, first-N signups).
- Create discount codes and coupons (percent or fixed, date range, tier, max uses).
- Active promotions are advertised on the signup page automatically.

## Signup page (`/join`)
- The first impression: state-of-the-art, maximum wow (3D/animated hero, smooth on mid-tier phones,
  transform/opacity only, toned down on low-tier devices and reduced motion).
- Flow: plans first (tiers + "build your own" + add-ons) → account (Google or email) → the signup form
  (always, Google included) → PIN → checkout (Stripe) or Free.
- A live, animated **pricing tracker** at the bottom shows the running total as plans and add-ons change.
- "See what you get" button plays the guest intro guide.
- Active promotions show as banners with remaining spots (for the first-N promos).
