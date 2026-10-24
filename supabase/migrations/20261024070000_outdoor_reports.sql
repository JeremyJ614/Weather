-- Final List #7 outdoor engines: what members saw (a rainbow, tonight's sunset rated 1–5, a
-- catch, deer seen), with an optional photo, to check the engines and tune their weights.
-- Retention: one year, pruned daily by the storage watchdog together with the photos.
create table if not exists public.outdoor_reports (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('rainbow', 'sunset', 'fish', 'deer')),
  at timestamptz not null default now(),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  -- Sunset: stars (1–5). Fish: how many caught. Deer: how many seen. Rainbow: none.
  rating smallint check (rating between 0 and 99),
  -- Fish: the species. Deer: "bucks", "does" or "both".
  detail text not null default '' check (char_length(detail) <= 40),
  photo text check (char_length(photo) <= 200),
  -- The engine's inputs at that place and time and its score, filled in by the server.
  inputs jsonb check (octet_length(inputs::text) <= 2000),
  score real,
  created_at timestamptz not null default now()
);
create index if not exists outdoor_reports_kind_at on public.outdoor_reports (kind, at desc);
create index if not exists outdoor_reports_user on public.outdoor_reports (user_id, created_at desc);
alter table public.outdoor_reports enable row level security;
create policy "add own outdoor reports" on public.outdoor_reports
  for insert to authenticated
  with check (user_id = (select auth.uid()) and inputs is null and score is null);
create policy "own outdoor reports" on public.outdoor_reports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "remove own outdoor reports" on public.outdoor_reports
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "extras admins read outdoor reports" on public.outdoor_reports
  for select to authenticated using ((select public.can_admin('extras')));

-- Photos: private, each member's own folder, about 1.5 MB at most (shrunk in the browser first).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outdoor', 'outdoor', false, 1572864, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 1572864,
  allowed_mime_types = array['image/jpeg', 'image/webp'];
create policy "members upload own outdoor photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'outdoor' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members see own outdoor photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'outdoor' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members remove own outdoor photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'outdoor' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "extras admins see outdoor photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'outdoor' and (select public.can_admin('extras')));

-- The engines' tuned weights (written by the server from members' reports; read by it too).
insert into public.app_config (key, value)
values ('engine_weights', '{}'::jsonb)
on conflict (key) do nothing;

-- Deer Activity: the state's hunting seasons, edited in admin → Extras (check the regulations).
insert into public.app_config (key, value)
values ('deer_seasons', '{"state": "Ohio", "seasons": [
  {"name": "Archery", "start": "2026-09-26", "end": "2027-02-07"},
  {"name": "Youth gun", "start": "2026-11-21", "end": "2026-11-22"},
  {"name": "Gun", "start": "2026-11-30", "end": "2026-12-06"},
  {"name": "Bonus gun", "start": "2026-12-19", "end": "2026-12-20"},
  {"name": "Muzzleloader", "start": "2027-01-02", "end": "2027-01-05"}
], "rut": {"pre": "10-25", "peak": "11-05", "post": "11-21", "end": "12-10"}}'::jsonb)
on conflict (key) do nothing;
create policy "deer seasons are public" on public.app_config
  for select to anon, authenticated using (key = 'deer_seasons');
create policy "extras admins edit deer seasons" on public.app_config
  for update to authenticated
  using (key = 'deer_seasons' and (select public.can_admin('extras')))
  with check (key = 'deer_seasons' and (select public.can_admin('extras')));
