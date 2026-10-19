-- Fix-It #7.18–19: the Tornado Archive's automatic NWS days and the Storm Chasing Log.
-- Applied 2026-10-19.

-- Every tornado day the NWS surveys, grouped by storm system, added by /api/cron/archive.
-- Retention: kept. No geometry is stored: the survey is read from NOAA when a day is opened
-- and cached a day, so a row is a few hundred bytes (about 600 a year).
create table if not exists public.archive_auto (
  id text primary key check (id ~ '^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,40}$'),
  day date not null,
  name text not null check (char_length(name) <= 120),
  region text not null check (char_length(region) <= 160),
  tz text not null check (char_length(tz) <= 64),
  t0 bigint not null,
  t1 bigint not null check (t1 >= t0),
  west double precision not null,
  south double precision not null,
  east double precision not null,
  north double precision not null,
  count smallint not null check (count > 0),
  strongest text not null check (strongest in ('EFU', 'EF0', 'EF1', 'EF2', 'EF3', 'EF4', 'EF5')),
  fatalities smallint not null default 0,
  injuries smallint not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists archive_auto_day on public.archive_auto (day desc);
alter table public.archive_auto enable row level security;
create policy "anyone reads the automatic archive" on public.archive_auto
  for select to anon, authenticated using (true);

-- A member's own chases. The payload is a simplified track (at most 1,500 fixes) and the
-- tornadoes kept; damage, hail and warnings are read from NOAA on open.
-- Retention: until the member deletes one or their account. Capped at 120 KB a chase and
-- 30 chases a member, so the whole table stays far inside the free plan.
create table if not exists public.chases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  day date not null,
  tz text not null check (char_length(tz) <= 64),
  miles real not null default 0 check (miles >= 0),
  tornadoes smallint not null default 0 check (tornadoes >= 0),
  strongest text check (strongest in ('EFU', 'EF0', 'EF1', 'EF2', 'EF3', 'EF4', 'EF5')),
  payload jsonb not null check (octet_length(payload::text) <= 120000),
  created_at timestamptz not null default now()
);
create index if not exists chases_user_day on public.chases (user_id, day desc);
alter table public.chases enable row level security;
create policy "own chases" on public.chases
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add own chases" on public.chases
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "rename own chases" on public.chases
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own chases" on public.chases
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.chases_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.chases where user_id = new.user_id) >= 30 then
    raise exception 'chase_limit' using hint = 'A member can keep 30 chases.';
  end if;
  return new;
end $$;
revoke all on function public.chases_cap() from public, anon, authenticated;
create trigger chases_cap before insert on public.chases
  for each row execute function public.chases_cap();

-- Pull new and updated NWS surveys every 6 hours, and walk back through 2024 and 2025 a month
-- per call until the archive reaches 2024-01.
select cron.schedule('archive-auto', '7 */6 * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/archive',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
select cron.schedule('archive-backfill', '23,53 * * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/archive?backfill=1',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
