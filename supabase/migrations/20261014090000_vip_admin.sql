-- Fix-It #5: the owner's picks from the VIP admin panel (#5, #7, #8, #9, #17, #22, #23, #25,
-- #31, #32, #44, #45). Every table has RLS; every admin write is logged.

-- #7 Change a member's plan: admins can comp a tier (no card, not income).
alter table public.subscriptions add column if not exists comped boolean not null default false;

create or replace function public.admin_set_plan(p_user uuid, p_tier text, p_cycle text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_admin('members') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_tier not in ('free', 'basic', 'chasers', 'advanced', 'vip') or p_cycle not in ('month', 'year') then
    raise exception 'pick a plan' using errcode = '22023';
  end if;
  insert into public.subscriptions as s (user_id, tier, cycle, regular_cents, status, comped, updated_at)
    values (p_user, p_tier, p_cycle, 0, case when p_tier = 'free' then 'free' else 'active' end, p_tier <> 'free', now())
    on conflict (user_id) do update set
      tier = excluded.tier, cycle = excluded.cycle, regular_cents = 0, first_cents = '{}',
      status = excluded.status, comped = excluded.comped, updated_at = now();
  perform public.log_admin('set_plan', public.member_name(p_user),
    jsonb_build_object('member', p_user, 'tier', p_tier, 'comped', p_tier <> 'free'));
end;
$$;
grant execute on function public.admin_set_plan(uuid, text, text) to authenticated;

-- #8 Pages on/off per member. on = given on top of their plan; off = closed to them.
-- Retention: kept while the member exists; removed with the account.
create table if not exists public.member_pages (
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{1,48}$'),
  allowed boolean not null,
  set_at timestamptz not null default now(),
  primary key (user_id, slug)
);
alter table public.member_pages enable row level security;
create policy "members read own pages" on public.member_pages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members admins read pages" on public.member_pages
  for select to authenticated using ((select public.can_admin('members')));
create policy "members admins add pages" on public.member_pages
  for insert to authenticated with check ((select public.can_admin('members')));
create policy "members admins change pages" on public.member_pages
  for update to authenticated using ((select public.can_admin('members')))
  with check ((select public.can_admin('members')));
create policy "members admins clear pages" on public.member_pages
  for delete to authenticated using ((select public.can_admin('members')));

-- Is this page closed to the signed-in member? (The proxy asks on each page request.)
create or replace function public.page_closed(p_slug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.member_pages
                 where user_id = (select auth.uid()) and slug = p_slug and not allowed);
$$;
grant execute on function public.page_closed(text) to authenticated;

-- #9 Referral count ±: admin corrections on top of the real count.
-- Retention: one row per member; removed with the account.
create table if not exists public.referral_adjust (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bonus integer not null default 0 check (bonus between -1000 and 1000),
  updated_at timestamptz not null default now()
);
alter table public.referral_adjust enable row level security;
create policy "members read own referral adjust" on public.referral_adjust
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members admins read referral adjust" on public.referral_adjust
  for select to authenticated using ((select public.can_admin('members')));

create or replace function public.admin_referrals(p_user uuid, p_delta integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare b integer;
begin
  if not public.can_admin('members') then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_delta not in (-1, 1) then raise exception 'one at a time' using errcode = '22023'; end if;
  insert into public.referral_adjust as r (user_id, bonus) values (p_user, p_delta)
    on conflict (user_id) do update set bonus = r.bonus + p_delta, updated_at = now()
    returning bonus into b;
  perform public.log_admin('adjust_referrals', public.member_name(p_user),
    jsonb_build_object('member', p_user, 'delta', p_delta, 'bonus', b));
  return b;
end;
$$;
grant execute on function public.admin_referrals(uuid, integer) to authenticated;

-- #23 Badge library and #25 badges per member.
-- Retention: badges until an admin deletes them; awards until the badge or member is removed.
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 160),
  icon text not null default 'Award' check (icon ~ '^[A-Za-z0-9]{1,32}$'),
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  grp text not null default 'General' check (char_length(grp) between 1 and 30),
  created_at timestamptz not null default now()
);
alter table public.badges enable row level security;
create policy "members read badges" on public.badges
  for select to authenticated using (true);
create policy "badge admins add badges" on public.badges
  for insert to authenticated with check ((select public.can_admin('badges')));
create policy "badge admins edit badges" on public.badges
  for update to authenticated using ((select public.can_admin('badges')))
  with check ((select public.can_admin('badges')));
create policy "badge admins remove badges" on public.badges
  for delete to authenticated using ((select public.can_admin('badges')));

-- Retention: removed with the badge or the member.
create table if not exists public.member_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);
alter table public.member_badges enable row level security;
create policy "members read own badges" on public.member_badges
  for select to authenticated using (user_id = (select auth.uid()));
create policy "badge admins read awards" on public.member_badges
  for select to authenticated using ((select public.can_admin('badges')) or (select public.can_admin('members')));
create policy "badge admins award" on public.member_badges
  for insert to authenticated with check ((select public.can_admin('badges')) or (select public.can_admin('members')));
create policy "badge admins unaward" on public.member_badges
  for delete to authenticated using ((select public.can_admin('badges')) or (select public.can_admin('members')));

-- #31 Notifications: an in-app toast to everyone (user_id null) or one member.
-- Retention: 90 days, pruned daily by the storage watchdog; reads go with them.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  level text not null check (level in ('info', 'warning', 'alert')),
  title text not null check (char_length(title) between 1 and 80),
  body text not null default '' check (char_length(body) <= 400),
  sent_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notifications_created on public.notifications (created_at desc);
alter table public.notifications enable row level security;
create policy "members read their notifications" on public.notifications
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "notify admins read notifications" on public.notifications
  for select to authenticated using ((select public.can_admin('notify')));
create policy "notify admins send" on public.notifications
  for insert to authenticated with check ((select public.can_admin('notify')) and sent_by = (select auth.uid()));
create policy "notify admins remove" on public.notifications
  for delete to authenticated using ((select public.can_admin('notify')));

-- Retention: removed with the notification (90 days) or the member.
create table if not exists public.notification_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid not null references public.notifications (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_id)
);
alter table public.notification_reads enable row level security;
create policy "members read own reads" on public.notification_reads
  for select to authenticated using (user_id = (select auth.uid()));
create policy "members mark own reads" on public.notification_reads
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "notify admins read reads" on public.notification_reads
  for select to authenticated using ((select public.can_admin('notify')));

-- Unread notifications for the signed-in member (only ones sent after they joined).
create or replace function public.my_notifications()
returns table (id uuid, level text, title text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.level, n.title, n.body, n.created_at
  from public.notifications n
  join public.profiles p on p.id = (select auth.uid())
  where (n.user_id is null or n.user_id = p.id)
    and n.created_at >= p.created_at
    and n.created_at > now() - interval '30 days'
    and not exists (select 1 from public.notification_reads r
                    where r.notification_id = n.id and r.user_id = p.id)
  order by n.created_at desc
  limit 5;
$$;
grant execute on function public.my_notifications() to authenticated;

-- #32 Contact inbox: every form that sends the team a message lands here.
-- Retention: 1 year, pruned daily by the storage watchdog.
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  form text not null check (form ~ '^[a-z0-9-]{1,32}$'),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 200),
  subject text not null default '' check (char_length(subject) <= 120),
  body text not null check (char_length(body) between 1 and 4000),
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists contact_messages_created on public.contact_messages (created_at desc);
alter table public.contact_messages enable row level security;
create policy "inbox admins read messages" on public.contact_messages
  for select to authenticated using ((select public.can_admin('inbox')));
create policy "inbox admins mark messages" on public.contact_messages
  for update to authenticated using ((select public.can_admin('inbox')))
  with check ((select public.can_admin('inbox')));
create policy "inbox admins remove messages" on public.contact_messages
  for delete to authenticated using ((select public.can_admin('inbox')));
-- No insert policy: messages arrive only through contact_send() (rate limited).

create or replace function public.contact_send(
  p_form text, p_name text, p_email text, p_subject text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if (select count(*) from public.contact_messages
      where created_at > now() - interval '1 hour'
        and (email = lower(trim(p_email)) or (uid is not null and user_id = uid))) >= 5 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  insert into public.contact_messages (form, user_id, name, email, subject, body)
    values (p_form, uid, trim(p_name), lower(trim(p_email)), coalesce(trim(p_subject), ''), trim(p_body));
end;
$$;
grant execute on function public.contact_send(text, text, text, text, text) to anon, authenticated;

-- #45 Page usage: one row per page, member and day (signed-in members only).
-- Retention: 180 days, pruned daily by the storage watchdog.
create table if not exists public.page_views (
  day date not null default (now() at time zone 'America/New_York')::date,
  slug text not null check (slug ~ '^[a-z0-9-]{0,48}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  views integer not null default 1,
  primary key (day, slug, user_id)
);
alter table public.page_views enable row level security;
create policy "usage admins read views" on public.page_views
  for select to authenticated using ((select public.can_admin('usage')));
-- No insert policy: views are counted only by track_view().

create or replace function public.track_view(p_slug text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_slug !~ '^[a-z0-9-]{0,48}$' then return; end if;
  insert into public.page_views as v (slug, user_id) values (p_slug, uid)
    on conflict (day, slug, user_id) do update set views = least(v.views + 1, 10000);
end;
$$;
grant execute on function public.track_view(text) to authenticated;

-- #44 System health: table sizes, database size and how fresh each cache is.
create or replace function public.admin_health()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare out jsonb;
begin
  if not public.can_admin('health') then raise exception 'not allowed' using errcode = '42501'; end if;
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'tables', (select jsonb_agg(jsonb_build_object('name', c.relname, 'rows', greatest(c.reltuples, 0)::bigint,
                                                   'bytes', pg_total_relation_size(c.oid)) order by pg_total_relation_size(c.oid) desc)
               from pg_class c join pg_namespace n on n.oid = c.relnamespace
               where n.nspname = 'public' and c.relkind = 'r'),
    'caches', jsonb_build_object(
      'sswxcon', (select max(at) from public.sswxcon_snapshots),
      'weather_news', (select max(fetched_at) from public.weather_news_items),
      'afd_simplified', (select max(created_at) from public.afd_simplified),
      'storage_snapshot', (select max(taken_at) from public.storage_snapshots),
      'daily_brief', (select max(day)::timestamptz from public.brief_deliveries)),
    'errors_24h', (select count(*) from public.client_errors where last_seen > now() - interval '1 day'),
    'members', (select count(*) from public.profiles),
    'cron', (select coalesce(jsonb_agg(jsonb_build_object('job', j.jobname, 'schedule', j.schedule,
                     'last', (select max(d.end_time) from cron.job_run_details d where d.jobid = j.jobid),
                     'ok', (select d.status = 'succeeded' from cron.job_run_details d where d.jobid = j.jobid
                            order by d.end_time desc nulls last limit 1))), '[]'::jsonb)
             from cron.job j)
  ) into out;
  return out;
end;
$$;
grant execute on function public.admin_health() to authenticated;

-- #22 Invoice email template (owner-edited). Readable by billing admins only.
insert into public.app_config (key, value) values ('invoice_template', '{}'::jsonb)
  on conflict (key) do nothing;
create policy "billing admins read invoice template" on public.app_config
  for select to authenticated using (key = 'invoice_template' and (select public.can_admin('billing')));
create policy "billing admins edit invoice template" on public.app_config
  for update to authenticated
  using (key = 'invoice_template' and (select public.can_admin('billing')))
  with check (key = 'invoice_template' and (select public.can_admin('billing')));

-- Retention pruning runs in the daily storage watchdog (src/app/api/cron/storage-watchdog).
