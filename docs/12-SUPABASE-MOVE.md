# Moving Weather to a new Supabase project (owner's list #41, item 13)

**Short answer:** yes. A complete copy is possible, and almost nothing has to reset. The one
thing Supabase never lets anyone export is password hashes, and there is a known way around
it (below), so members keep their PINs and passwords. **Difficulty: 6 out of 10.** About one
focused session to build and rehearse, then a cutover of roughly 30 minutes with the site in
read-only mode.

## What we can reach today without the lost login

The live site's server holds the project's service key (in Vercel, write-only). The scheduled
jobs already use it through `/api/jobs/sb/*` (GitHub OIDC only), which reaches the database's
REST API and Storage. From that, and from the repository:

| Piece | How it comes across | Kept? |
| --- | --- | --- |
| Table structure, policies (RLS), functions, triggers | the 49 files in `supabase/migrations/`, replayed on the new project, then checked table by table against the old project's live schema (its REST API publishes every table, column and function) | Yes |
| Every row of every table | a GitHub Actions job pages through each table with the service key and loads it into the new project | Yes |
| Storage files (`news`, `ops`, `outdoor`, `sswx` buckets) | listed and copied object by object | Yes |
| Member accounts (ids, emails, names, roles, plans, sign-up dates, Google links) | the Auth admin API, recreated with the same ids so every row still points at the right person | Yes |
| Passwords and PINs | not exportable (Supabase never hands out hashes). **Lazy move:** when someone signs in, the new project is tried first; if it doesn't know their password yet, the old project checks it, and if it's right the new project saves it on the spot. Members notice nothing. Keep the old project running a few months, then anyone who never came back uses "Email me a link". | Yes, as people sign in |
| Scheduled jobs | already on GitHub Actions; any left in `pg_cron` are recreated from the migrations | Yes |
| Settings: email templates, Resend SMTP, redirect URLs, Google sign-in | redone in the new dashboard (templates are in `supabase/templates/`) | Yes, by hand |
| Links to old storage URLs saved inside rows (news images, say) | rewritten to the new project's address during the copy | Yes |

What could be missed: anything ever changed by hand in the old dashboard and never written into
a migration (a policy tweak, a function). The schema check catches tables, columns and
functions; policies and triggers can't be listed through the REST API, so those come from the
migrations, which have been kept in step.

## Steps

1. Create the new project (it needs a Supabase account with a free slot: free accounts get 2
   projects, and each of the owner's accounts in the sheet already has 2).
2. Replay the migrations; compare the schema with the old project's.
3. Run the copy job (tables, files, accounts) as a rehearsal; check counts match.
4. Cutover: switch the site to read-only, run the copy again for anything new, swap the
   Supabase URL and keys in Vercel and GitHub, turn on the lazy password move, leave read-only.
5. Keep the old project for a few months for sign-ins, then pause it.

## Pros

- Full control again: SQL, dashboard, logs, backups and the advisors, with an access token
  saved (the sheet keeps one per account). The SQL steps the build log has waited on (several
  owner-only migrations) can finally run.
- Daily database backups to GitHub become possible (the free plan has no point-in-time
  restore).
- The project sits in an account the owner controls, with recovery details that work.

## Cons

- Real work and some risk: a missed policy or function would show up as a page error until
  fixed; a rehearsal and the schema check lower that risk but can't remove it.
- A short read-only window at cutover (sign-ups and saves pause about 30 minutes).
- The old project must stay up (free, but it can be paused by Supabase after a week with no
  activity, which the lazy password move itself prevents) until most members have signed in.
- Google sign-in, email templates and SMTP have to be set again by hand in the new dashboard.

## Alternative

Ask Supabase support to recover the old account (proof of ownership: the organization's name,
project id `ztzqemzuanwqwqzsaigd`, the Vercel and GitHub accounts using it). If that works,
nothing has to move. It can take days, and without the old email it may not succeed.

## The move (owner chose it, 2026-11-26)

- **New project:** `stormsync-weather`, ref `katgjzkvscexswsqqooi`, us-east-1, free plan, in the
  "jays backup backup" organization (account jaytester39; its access token is in the owner's
  account sheet). Jays-education stays paused there; paused projects don't take a free slot.
- **Schema:** all migrations replayed. The live project never got
  `20261020060000_disaster_no_volunteers` (its volunteers table still exists there), so the
  new project is the first to have every migration. `20261126200000_project_move` adds
  `password_unset()` for the sign-in carry-over and unschedules the retired analogs job.
- **Scheduled jobs:** the 18 pg_cron jobs exist in the new project, paused until cutover.
- **Auth settings (done by API):** site URL `https://weather.sswx.space`, redirect list, Resend
  SMTP (`account@send.sswx.space`, "StormSync Weather"), the four branded templates.
  **Google sign-in waits on the owner:** in Google Cloud → APIs & Services → Credentials, open
  the OAuth client and add the redirect URI
  `https://katgjzkvscexswsqqooi.supabase.co/auth/v1/callback`; then in the new project's
  dashboard → Authentication → Sign In / Providers → Google, paste the client ID and secret.
- **Copy:** `jobs.yml` job `export` (sealed artifact, one day) → `wximport.py` in the working
  session (users with the same ids and no password, every table in raw-copy mode with Storage
  links rewritten, sequences, buckets and files) → counts checked against the export.
- **Sign-in carry-over:** `src/lib/auth/carry.ts`. Off while the site points at the old project.
- **Cutover:** final export and import, then the three Vercel variables
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and
  `jobs.yml`'s two lines switch to the new project, a production redeploy, and the cron jobs
  resume. Writes made on the old project between the final export and the redeploy (a few
  minutes) don't come across.
