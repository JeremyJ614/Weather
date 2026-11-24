# Free-tier audit (Fix it List #39, step 3, 2026-11-24)

How close Weather is to the free limits of Vercel (Hobby), Supabase (Free) and GitHub (Free),
checked from live numbers, not estimates, wherever a number could be read. Vercel's limits are
for the whole Hobby account: Weather shares them with Academy, Sports, VD, Jays School,
Goathouse, lesson-generator and the rest.

## How each number was read (so a later check can repeat it)

- **Vercel**: `GET https://api.vercel.com/v2/usage?teamId=team_mYhMQhL7zzdGg6fY96EWaT7y&type=<requests|builds|cron_jobs|data_cache>&from=…&to=…`
  with the owner's account token (Account Details). Hobby can't use `/v1/usage`, billing
  charges or Observability queries (Pro only). Active CPU isn't in that API on Hobby: it comes
  from the app's own meter, `npx tsx --conditions=react-server scripts/jobs/run.ts usage` on
  Actions (dispatch `jobs.yml` with job `usage`).
- **Supabase**: the owner lost the account's email, so no dashboard, SQL or connector (the
  Supabase connector reaches only Academy and Jays-education). The database and file sizes come
  from the storage watchdog's daily snapshots (`jobs.yml` job `sizes`, read through the site's
  relay with GitHub's OIDC token).
- **GitHub**: the REST API (`gh api repos/JeremyJ614/Weather`, Actions run lists).

## Vercel (Hobby), November 1 to 24, whole account

| Limit (a month) | Used so far | Month at this pace | Share |
| --- | --- | --- | --- |
| CDN requests, 1,000,000 | 250,296 | ~305,000 | 31% |
| Function invocations, 1,000,000 | 179,883 | ~218,000 | 22% |
| Provisioned memory, 360 GB-hrs | 30.7 | ~37 | 10% |
| Fast Data Transfer, 100 GB | 2.07 GB | ~2.5 GB | 2.5% |
| Image transformations, 5,000 | 0 (library images are `unoptimized`) | 0 | 0% |
| Active CPU, 4 hours | Weather's metered routes: ~0.14 h a month | (pages not metered) | ~3.5% metered |
| Deployments, 100 a day | peak 95 on Nov 18 (Academy 79) | | **95% on the worst day** |
| Cron jobs (daily only) | 5 daily (`vercel.json`) | | fine |

Weather is about 61% of the account's function time and 21% of its bandwidth. Exceeding a
Hobby limit blocks that feature until the 30-day window passes (Vercel paused this project once
for it, 2026-11-02, before the model maps moved onto the viewer's device).

## Supabase (Free), the Weather project

| Limit | Used | Share |
| --- | --- | --- |
| Database, 500 MB | 26.2 MB (growing ~0.3 MB a day) | 5% |
| File storage, 1 GB | 10.4 MB | 1% |
| Egress, 5 GB a month | not readable without the dashboard | low: the database is 26 MB, visitors' data calls are a handful a day, and the only files served from Supabase are the owner's own news-post images |

## GitHub (Free, public repository)

- Actions minutes: free and unlimited for a public repository.
- Repository: 34 MB. The new `data` branch is replaced each day (one commit), so it never grows.
- The default branch is `ccr-f5e0b71a-4vr2wk`, not `main`: GitHub starts schedules (and manual
  runs) only from workflows on the default branch, so new workflows need a sync PR from main.

## The app's own usage meter (Weather only)

`jobs.yml` job `usage`, last 7 days: ~5,500 metered calls a month and **0.14 CPU-hours a month
(3.5% of 4)**. Almost all of it is the database scheduler calling the cron routes (engines,
surge, notify, weather news, outdoor, brief, SSWXcon); real visitors' data-route calls are a
handful a day. The meter covers the data routes and crons only, not page rendering or
`/api/me`, and Vercel doesn't report Active CPU on Hobby, so this is the part that can be
measured; with memory time at 10% of its limit, CPU has room.

## What the new features (Fix it List #39) cost

Nothing on Vercel or Supabase. The History Globe's storm archive (~1.7 MB a visit, formerly
served by Vercel) and the 7-day rain and snow maps are built on GitHub Actions, kept on the
`data` branch and read by browsers from jsDelivr (pinned to the commit), with only
`latest.json` (under 1 KB) from GitHub's raw host. The 7-day frames are colored on the
viewer's device. The `data` branch never deploys on Vercel: each of its commits carries its own
`vercel.json` with deployments off (bug 165; Vercel reads that file from the commit itself).

## Risks, worst first

1. **Deployments a day (Vercel, whole account)**: 100 a day; Nov 18 reached 95, Academy 79 of
   them (430 of the account's ~590 builds this month, from pushes to its production branch
   `claude/virtual-academy-rebuild-istti1` and `ccr-*` previews). On a day like that a Weather
   release can be refused until the next day. Fix (Academy repository): switch off preview
   builds for `ccr-*` and `claude/*` branches in its `vercel.json`, as Weather does, and push
   to its production branch in fewer, larger commits.
2. **Supabase account access**: the owner lost the login email, so Supabase's warnings (quota,
   inactivity pause) can't be read and a paused project can't be restored from the dashboard.
   The project stays active (the database scheduler runs every few minutes) and is far under
   its limits, but recovering the account through Supabase support is worth doing.
3. **Hobby is for non-commercial use** (flagged in B11): Weather takes Stripe payments.
4. **Scheduled jobs on Actions run less often than written**: 106 scheduled runs from Nov 16
   to 24 against ~260 a day configured; GitHub delays and drops frequent schedules. No cost
   risk (Actions is free here), but the engine maps refresh less often than designed.
5. **Public repositories' schedules stop after 60 days without activity**: the daily data job
   pushes every day and the owner commits often, so this shouldn't trigger.

## Fine

Requests, invocations, memory time, bandwidth and images are all under a third of their
limits for the whole account; Supabase's database is at 5% and its files at 1%; GitHub
Actions is free and unlimited for this public repository.
