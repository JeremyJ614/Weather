-- Phase 63: Notifications center. Each member's alert choices, and a log of what was sent,
-- so an alert goes out once and the center can list recent ones. Applied 2026-10-17.

-- Retention: one row per member; removed with the account.
create table if not exists public.notify_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  topics text[] not null default '{}' check (
    topics <@ array['warnings', 'watches', 'spc', 'news', 'engines', 'game', 'trivia', 'polls', 'tropical', 'aurora']::text[]
  ),
  label text check (char_length(label) <= 80),
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  quiet_from smallint check (quiet_from between 0 and 23),
  quiet_to smallint check (quiet_to between 0 and 23),
  time_zone text check (char_length(time_zone) <= 64),
  updated_at timestamptz not null default now()
);
alter table public.notify_prefs enable row level security;
create policy "own alerts" on public.notify_prefs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "add own alerts" on public.notify_prefs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "edit own alerts" on public.notify_prefs
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notify admins read alerts" on public.notify_prefs
  for select to authenticated using ((select public.can_admin('notify')));

-- Retention: 30 days, pruned daily by the storage watchdog. Written only by the server.
create table if not exists public.notify_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic text not null,
  key text not null check (char_length(key) <= 120),
  title text not null check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 300),
  url text not null default '/' check (url ~ '^/'),
  pushed boolean not null default false,
  sent_at timestamptz not null default now(),
  primary key (user_id, topic, key)
);
alter table public.notify_sent enable row level security;
create index if not exists notify_sent_recent on public.notify_sent (user_id, sent_at desc);
create policy "own sent alerts" on public.notify_sent
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notify admins read sent" on public.notify_sent
  for select to authenticated using ((select public.can_admin('notify')));

select cron.schedule('notify-10min', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/notify',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);
