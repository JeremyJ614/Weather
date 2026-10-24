-- Final List #4: On This Day in Weather History. One row per calendar date: NOAA's records
-- for that date (SPC tornadoes since 1950, NHC landfalls) and the stories written from them.
-- Retention: one row per calendar date (366 at most), rebuilt in place once a year.
create table if not exists public.history_days (
  md text primary key check (md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  data jsonb not null check (octet_length(data::text) <= 300000),
  story jsonb check (octet_length(story::text) <= 20000),
  updated_at timestamptz not null default now()
);
alter table public.history_days enable row level security;
create policy "anyone reads weather history" on public.history_days
  for select to anon, authenticated using (true);
-- No insert/update policies: only the server (service role) writes.

-- Today's and tomorrow's dates, a little after midnight Central.
select cron.schedule('on-this-day', '17 5,6 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/onthisday',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
