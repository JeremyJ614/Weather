-- Admin part 1: error inbox, kill switches and banner, member role management, ops counts. Applied 2026-10-13.

-- Client error inbox, grouped by fingerprint. Retention: groups unseen for 30 days are pruned by the daily cron.
create table if not exists public.client_errors (
  fingerprint text primary key check (char_length(fingerprint) <= 64),
  message text not null check (char_length(message) <= 300),
  page text not null check (char_length(page) <= 120),
  device text check (char_length(device) <= 40),
  stack text check (char_length(stack) <= 2000),
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
alter table public.client_errors enable row level security;
create policy "error admins read" on public.client_errors
  for select to authenticated using ((select public.can_admin('errors')));

create or replace function public.report_error(p_fp text, p_message text, p_page text, p_device text, p_stack text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.client_errors (fingerprint, message, page, device, stack)
  values (left(p_fp, 64), left(p_message, 300), left(p_page, 120), left(p_device, 40), left(p_stack, 2000))
  on conflict (fingerprint) do update
    set count = least(public.client_errors.count + 1, 1000000), last_seen = now();
end;
$$;

insert into public.app_config (key, value) values
  ('disabled_modules', '[]'::jsonb),
  ('banner', '{"text":"","until":null}'::jsonb)
on conflict (key) do nothing;
create policy "public ops settings" on public.app_config
  for select to anon, authenticated using (key in ('disabled_modules', 'banner'));
create policy "ops admins edit settings" on public.app_config
  for update to authenticated
  using (key in ('disabled_modules', 'banner') and (select public.can_admin('ops')))
  with check (key in ('disabled_modules', 'banner') and (select public.can_admin('ops')));

create policy "members admins grant member" on public.user_roles
  for insert to authenticated with check (role = 'member' and (select public.can_admin('members')));
create policy "members admins remove member" on public.user_roles
  for delete to authenticated using (role = 'member' and (select public.can_admin('members')));

create or replace function public.ops_counts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'new_week', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'sswx_members', (select count(*) from public.user_roles where role = 'member'),
    'errors_day', (select coalesce(sum(count), 0) from public.client_errors where last_seen > now() - interval '1 day'),
    'error_groups_day', (select count(*) from public.client_errors where last_seen > now() - interval '1 day'),
    'map_loads', (select coalesce(mapbox_loads, 0) from public.map_load_months where month = date_trunc('month', now() at time zone 'utc')::date),
    'map_provider', public.map_provider(),
    'news_live', (select count(*) from public.news_posts where status = 'published' and publish_at <= now())
  );
end;
$$;

create or replace function public.referral_counts()
returns table (referrer uuid, referrals bigint) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_admin('members') then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select p.referred_by, count(*) from public.profiles p where p.referred_by is not null group by 1;
end;
$$;
