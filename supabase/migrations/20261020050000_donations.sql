-- Donations (Fix-It List #16 #5). Applied 2026-10-20.
-- One row per gift, written only by the Stripe webhook (service role) when a donation
-- Checkout completes or a monthly gift renews. Donors choose whether their name and note go
-- on the public supporters wall; amounts are public only as the page's total.
-- Retention: kept seven years (accounting), then deleted by the daily storage watchdog.
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  amount_cents int not null check (amount_cents between 100 and 1000000),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  monthly boolean not null default false,
  name text check (char_length(name) <= 60),
  message text check (char_length(message) <= 200),
  on_wall boolean not null default false,
  email text check (char_length(email) <= 200),
  user_id uuid references auth.users (id) on delete set null,
  stripe_ref text not null unique check (char_length(stripe_ref) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists donations_created on public.donations (created_at desc);
alter table public.donations enable row level security;
-- No public read of the table itself: the wall and the total come from the functions below.
create policy "revenue admins read donations" on public.donations
  for select to authenticated using ((select public.can_admin('revenue')));

-- The supporters wall: only gifts whose donors asked to be shown, without emails.
create or replace function public.donation_wall(p_limit int default 24)
returns table (name text, message text, amount_cents int, monthly boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select d.name, d.message, d.amount_cents, d.monthly, d.created_at
  from public.donations d
  where d.on_wall
  order by d.created_at desc
  limit least(greatest(p_limit, 1), 60);
$$;

-- Everything given, as a total and a count of gifts and of donors (by email).
create or replace function public.donation_totals()
returns table (total_cents bigint, gifts bigint, donors bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount_cents), 0)::bigint, count(*)::bigint,
         count(distinct coalesce(email, id::text))::bigint
  from public.donations;
$$;
grant execute on function public.donation_wall(int) to anon, authenticated;
grant execute on function public.donation_totals() to anon, authenticated;
