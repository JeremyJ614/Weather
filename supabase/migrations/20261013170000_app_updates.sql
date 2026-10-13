-- App Updates tab: release notes and new members (initials only). Applied 2026-10-13.

-- Release notes. Retention: written by hand (a few a month); kept as the app's history.
create table if not exists public.app_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null check (char_length(version) between 1 and 20),
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 4000),
  published_at timestamptz not null default now()
);
alter table public.app_releases enable row level security;
create policy "releases are public" on public.app_releases
  for select to anon, authenticated using (published_at <= now());
create policy "news admins read releases" on public.app_releases
  for select to authenticated using ((select public.can_admin('news')));
create policy "news admins add releases" on public.app_releases
  for insert to authenticated with check ((select public.can_admin('news')));
create policy "news admins edit releases" on public.app_releases
  for update to authenticated using ((select public.can_admin('news'))) with check ((select public.can_admin('news')));
create policy "news admins remove releases" on public.app_releases
  for delete to authenticated using ((select public.can_admin('news')));

create or replace function public.recent_members(max_rows integer default 24)
returns table (initials text, joined timestamptz)
language sql stable security definer set search_path = '' as $$
  select upper(left(p.first_name, 1)) || '.' || upper(left(p.last_name, 1)) || '.', p.created_at
  from public.profiles p
  where p.created_at > now() - interval '30 days' and p.pin_set  -- completed signups only
  order by p.created_at desc
  limit least(greatest(max_rows, 1), 50);
$$;
