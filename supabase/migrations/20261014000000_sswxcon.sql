-- Phase 31: SSWXCon v2. An hourly snapshot of the national score so the page
-- can draw a real trend (VIP showed only the current number).

-- Retention: one row an hour; over 30 days pruned daily by the storage watchdog.
create table if not exists public.sswxcon_snapshots (
  at timestamptz primary key,
  total real not null check (total >= 0),
  parts jsonb not null default '{}'::jsonb
);
alter table public.sswxcon_snapshots enable row level security;
-- Public weather data, readable by anyone; written only by the server.
create policy "anyone reads snapshots" on public.sswxcon_snapshots
  for select to anon, authenticated using (true);

select cron.schedule('sswxcon-hourly', '10 * * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/sswxcon',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
