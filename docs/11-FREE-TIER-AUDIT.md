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
| Active CPU, 4 hours | see the usage meter below | | |
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
| Egress, 5 GB a month | not readable without the dashboard | low: see below |

## GitHub (Free, public repository)

- Actions minutes: free and unlimited for a public repository.
- Repository: 34 MB. The new `data` branch is replaced each day (one commit), so it never grows.
- The default branch is `ccr-f5e0b71a-4vr2wk`, not `main`: GitHub starts schedules (and manual
  runs) only from workflows on the default branch, so new workflows need a sync PR from main.
