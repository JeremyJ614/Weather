-- Final List #7 engines: what each experimental engine flagged (a lightning jump, a place
-- storms should start, a boundary crossing), and whether the real weather followed, so every
-- engine shows its own hit rate. Only the server (service role) reads or writes it.
-- Retention: 120 days, pruned hourly by the engine-verify job.
create table if not exists public.engine_checks (
  id bigint generated always as identity primary key,
  engine text not null check (char_length(engine) <= 16),
  -- One flag per storm or place and time, so a job running twice never counts it twice.
  key text not null check (char_length(key) <= 80),
  at timestamptz not null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  label text not null default '' check (char_length(label) <= 120),
  -- What counts as the weather following: inside this many minutes after `at` and km away.
  window_min smallint not null check (window_min between 1 and 720),
  radius_km real not null check (radius_km between 1 and 300),
  -- Null until checked against the reports.
  hit boolean,
  checked_at timestamptz,
  unique (engine, key)
);
create index if not exists engine_checks_pending on public.engine_checks (engine, at) where hit is null;
create index if not exists engine_checks_recent on public.engine_checks (engine, at desc);
alter table public.engine_checks enable row level security;
-- No policies: the engine routes report the hit rates; the table itself stays private.

-- Two new alerts in the Notifications center: lightning surges near you, and rainbow chances.
alter table public.notify_prefs drop constraint if exists notify_prefs_topics_check;
alter table public.notify_prefs add constraint notify_prefs_topics_check check (
  topics <@ array['warnings', 'watches', 'spc', 'news', 'engines', 'game', 'trivia', 'polls', 'tropical', 'aurora', 'surge', 'rainbow']::text[]
);

-- Every 10 minutes: log storms whose lightning just jumped (ahead of the 10-minute alerts).
select cron.schedule(
  'engine-surge',
  '8,18,28,38,48,58 * * * *',
  $$ select net.http_get(
    url := 'https://weather.sswx.space/api/cron/surge',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  ); $$
);

-- Hourly: check flags old enough for the reports to be in, and prune old rows.
select cron.schedule(
  'engine-verify',
  '41 * * * *',
  $$ select net.http_get(
    url := 'https://weather.sswx.space/api/cron/engine-verify',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  ); $$
);
