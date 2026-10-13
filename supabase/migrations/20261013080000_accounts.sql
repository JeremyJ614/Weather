-- Accounts: profiles, referral codes, PIN lockout. Applied 2026-10-13.

-- Retention: one row per account; removed with the account.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  last_name text not null check (char_length(last_name) between 1 and 40),
  nickname text check (char_length(nickname) <= 30),
  use_nickname boolean not null default false,
  phone text check (phone ~ '^\+?[0-9]{10,15}$'),
  city text not null check (char_length(city) between 1 and 60),
  state text not null check (state ~ '^[A-Z]{2}$'),
  birthday date not null,
  found_us text check (char_length(found_us) <= 200),
  referral_code integer not null unique,
  referred_by uuid references public.profiles (id),
  pin_set boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- No insert or delete policy: the server creates profiles with the service-role key.

-- Members may edit their descriptive fields only; codes, referrer, birthday and flags are server-set.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       new.id is distinct from old.id
    or new.birthday is distinct from old.birthday
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.pin_set is distinct from old.pin_set
    or new.created_at is distinct from old.created_at) then
    raise exception 'these fields can only be changed by StormSync' using errcode = '42501';
  end if;
  return new;
end;
$$;
create or replace trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- Public name: first name and last initial, or the nickname when chosen.
create or replace function public.display_name(p public.profiles)
returns text language sql stable set search_path = '' as $$
  select case when p.use_nickname and p.nickname is not null then p.nickname
              else p.first_name || ' ' || left(p.last_name, 1) || '.' end;
$$;

-- Unused 6-digit referral code.
create or replace function public.new_referral_code()
returns integer language plpgsql volatile set search_path = '' as $$
declare c integer;
begin
  loop
    c := 100000 + floor(random() * 900000)::int;
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;
  return c;
end;
$$;

-- Sign-in PIN lockout, keyed by a keyed hash of the email so no address is stored here.
-- Retention: cleared on a successful sign-in; rows idle 30 days are pruned by the daily cron.
create table if not exists public.pin_attempts (
  email_hash text primary key,
  failures integer not null default 0,
  locks integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.pin_attempts enable row level security;
