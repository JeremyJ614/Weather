-- Fix-It #4 / Phase 64 groundwork: plans, add-ons, promotions and coupons (docs/07-PRICING.md).
-- Card payments (Stripe) are not connected yet: a paid choice is saved as 'awaiting_payment'
-- and nothing is charged or unlocked until checkout exists.

insert into public.app_config (key, value) values ('billing', '{}'::jsonb)
  on conflict (key) do nothing;
create policy "billing is public" on public.app_config
  for select to anon, authenticated using (key = 'billing');
create policy "billing admins edit pricing" on public.app_config
  for update to authenticated
  using (key = 'billing' and (select public.can_admin('billing')))
  with check (key = 'billing' and (select public.can_admin('billing')));

-- Retention: one row per member (their current plan choice); removed with the account.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null check (tier in ('free', 'basic', 'chasers', 'advanced', 'vip', 'custom')),
  cycle text not null check (cycle in ('month', 'year')),
  pages text[] not null default '{}' check (cardinality(pages) <= 80),
  addons text[] not null default '{}' check (cardinality(addons) <= 80),
  regular_cents integer not null check (regular_cents between 0 and 1000000),
  first_cents integer[] not null default '{}',
  promo text check (char_length(promo) <= 40),
  coupon text check (char_length(coupon) <= 40),
  status text not null default 'free' check (status in ('free', 'awaiting_payment', 'active', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "members read own plan" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "billing admins read plans" on public.subscriptions
  for select to authenticated using ((select public.can_admin('billing')));
-- No member insert/update policies: plans are saved only by save_plan() below.

-- Retention: coupon codes are kept until an admin removes them (small).
create table if not exists public.coupons (
  code text primary key check (code ~ '^[A-Z0-9-]{3,24}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  amount integer not null check (amount > 0 and amount <= 100000),
  tiers text[] not null default '{}',
  starts date,
  ends date,
  max_uses integer check (max_uses > 0),
  uses integer not null default 0,
  active boolean not null default true,
  note text check (char_length(note) <= 120),
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or amount <= 100)
);
alter table public.coupons enable row level security;
create policy "billing admins manage coupons" on public.coupons
  for all to authenticated
  using ((select public.can_admin('billing')))
  with check ((select public.can_admin('billing')));

-- How many signups each promotion has claimed (counts only; for "spots left").
create or replace function public.promo_claims()
returns table (promo text, claims bigint)
language sql stable security definer set search_path = '' as $$
  select s.promo, count(*) from public.subscriptions s
  where s.promo is not null group by s.promo;
$$;
grant execute on function public.promo_claims() to anon, authenticated;

-- A coupon's discount if it's valid today for a tier; never lists codes.
create or replace function public.coupon_check(p_code text, p_tier text)
returns table (kind text, amount integer)
language sql stable security definer set search_path = '' as $$
  select c.kind, c.amount from public.coupons c
  where c.code = upper(trim(p_code)) and c.active
    and (c.starts is null or c.starts <= (now() at time zone 'America/New_York')::date)
    and (c.ends is null or c.ends >= (now() at time zone 'America/New_York')::date)
    and (c.max_uses is null or c.uses < c.max_uses)
    and (cardinality(c.tiers) = 0 or p_tier = any(c.tiers));
$$;
grant execute on function public.coupon_check(text, text) to anon, authenticated;

-- Saves a member's plan choice. Server only: the app prices the choice itself and calls this
-- with the service key, so a browser can never set its own price. Counts a coupon use once.
create or replace function public.save_plan(
  p_user uuid, p_tier text, p_cycle text, p_pages text[], p_addons text[],
  p_regular integer, p_first integer[], p_promo text, p_coupon text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := p_user;
  had text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'server only' using errcode = '42501';
  end if;
  select coupon into had from public.subscriptions where user_id = uid;
  insert into public.subscriptions as s (user_id, tier, cycle, pages, addons, regular_cents, first_cents, promo, coupon, status, updated_at)
    values (uid, p_tier, p_cycle, coalesce(p_pages, '{}'), coalesce(p_addons, '{}'), p_regular, coalesce(p_first, '{}'),
            p_promo, nullif(upper(trim(p_coupon)), ''),
            case when p_regular = 0 then 'free' else 'awaiting_payment' end, now())
    on conflict (user_id) do update set
      tier = excluded.tier, cycle = excluded.cycle, pages = excluded.pages, addons = excluded.addons,
      regular_cents = excluded.regular_cents, first_cents = excluded.first_cents,
      promo = coalesce(s.promo, excluded.promo), coupon = excluded.coupon,
      status = case when s.status = 'active' then s.status else excluded.status end,
      updated_at = now();
  if p_coupon is not null and nullif(upper(trim(p_coupon)), '') is distinct from had then
    update public.coupons set uses = uses + 1 where code = upper(trim(p_coupon));
  end if;
end;
$$;
grant execute on function public.save_plan(uuid, text, text, text[], text[], integer, integer[], text, text) to service_role;
