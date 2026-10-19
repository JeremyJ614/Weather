-- Fix-It #7.9: Weather Patterns reads a daily ledger of SPC storm reports and precomputed
-- period recaps instead of fetching a year of SPC files on every visit. Applied 2026-10-19.

-- Retention: one small row per day; rows over 3 years old pruned by the storage watchdog.
create table if not exists public.report_days (
  day date primary key,
  torn integer not null default 0,
  hail integer not null default 0,
  wind integer not null default 0,
  states jsonb not null default '{}'::jsonb,
  torn_states jsonb not null default '{}'::jsonb,
  big_hail jsonb,
  big_gust jsonb,
  updated_at timestamptz not null default now()
);
alter table public.report_days enable row level security;
-- Public weather data: anyone reads it, only the server writes it.
create policy "anyone reads report days" on public.report_days
  for select to anon, authenticated using (true);

-- Retention: a fixed handful of keys (the four periods and the season), overwritten daily.
create table if not exists public.pattern_cache (
  key text primary key check (char_length(key) <= 40),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.pattern_cache enable row level security;
create policy "anyone reads pattern cache" on public.pattern_cache
  for select to anon, authenticated using (true);

-- SPC posts each day's final filtered reports by about 12Z; refresh the ledger, then the recaps.
select cron.schedule('patterns-ledger', '50 12,18 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/patterns?part=ledger',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
select cron.schedule('patterns-recaps', '57 12,18 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/patterns?part=' || p,
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  ) from unnest(array['yesterday', 'week', 'month', 'year', 'season']) as p;
$$);
