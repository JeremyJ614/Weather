-- Roles: SSWX Member, SSWX Administration, SSWX Founder; subscription tier. Applied 2026-10-13.

insert into public.app_config (key, value) values ('founder_email', '"jaywx@yahoo.com"'::jsonb)
on conflict (key) do nothing;

-- Subscription tier; the paid tiers are added with Stripe in phase 64.
alter table public.profiles add column if not exists tier text not null default 'free' check (tier in ('free'));

-- Retention: one row per role held; removed with the account.
create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('member', 'admin', 'founder')),
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(r text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = r);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles
                 where user_id = (select auth.uid()) and role in ('admin', 'founder'));
$$;

create policy "read own roles, admins read all" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "founder grants roles" on public.user_roles
  for insert to authenticated with check ((select public.has_role('founder')) and role <> 'founder');
create policy "founder removes roles" on public.user_roles
  for delete to authenticated using ((select public.has_role('founder')) and role <> 'founder');

create policy "admins read profiles" on public.profiles
  for select to authenticated using ((select public.is_admin()));

-- The owner's account becomes SSWX Founder when its profile is created.
create or replace function public.grant_founder()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from auth.users u
    where u.id = new.id
      and lower(u.email) = (select lower(c.value #>> '{}') from public.app_config c where c.key = 'founder_email')
  ) then
    insert into public.user_roles (user_id, role) values (new.id, 'founder') on conflict do nothing;
  end if;
  return new;
end;
$$;
create or replace trigger grant_founder after insert on public.profiles
  for each row execute function public.grant_founder();

-- profiles_guard now also protects tier.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       new.id is distinct from old.id
    or new.birthday is distinct from old.birthday
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.pin_set is distinct from old.pin_set
    or new.tier is distinct from old.tier
    or new.created_at is distinct from old.created_at) then
    raise exception 'these fields can only be changed by StormSync' using errcode = '42501';
  end if;
  return new;
end;
$$;
