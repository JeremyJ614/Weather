-- Phase 64: card payments (Stripe Checkout) and page locks by plan. Applied 2026-10-17.

-- Stripe's ids for a member's plan, written only by the server (webhook).
alter table public.subscriptions
  add column if not exists stripe_customer text check (char_length(stripe_customer) <= 64),
  add column if not exists stripe_subscription text check (char_length(stripe_subscription) <= 64);
create index if not exists subscriptions_stripe on public.subscriptions (stripe_subscription);

-- The owner's switch for locking pages by plan (Admin → Pricing). Off until payments work.
insert into public.app_config (key, value)
values ('plan_locks', '{"on": false}'::jsonb)
on conflict (key) do nothing;
create policy "plan locks are public" on public.app_config
  for select to anon, authenticated using (key = 'plan_locks');
create policy "billing admins edit plan locks" on public.app_config
  for update to authenticated
  using (key = 'plan_locks' and (select public.can_admin('billing')))
  with check (key = 'plan_locks' and (select public.can_admin('billing')));

-- Everything the proxy needs to open a page, in one call: an admin's per-member closure,
-- whether plan locks are on (never for admins), and the member's plan and the pricing.
create or replace function public.page_gate(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with locks as (
    select coalesce((select (value ->> 'on')::boolean from public.app_config where key = 'plan_locks'), false)
      and not (select public.is_admin()) as enabled
  )
  select jsonb_build_object(
    'closed', exists (
      select 1 from public.member_pages
      where user_id = (select auth.uid()) and slug = p_slug and not allowed
    ),
    'locks', (select enabled from locks),
    'plan', case when (select enabled from locks) then (
      select jsonb_build_object('tier', tier, 'status', status, 'comped', comped, 'pages', pages, 'addons', addons)
      from public.subscriptions where user_id = (select auth.uid())
    ) end,
    'billing', case when (select enabled from locks) then (
      select value from public.app_config where key = 'billing'
    ) end
  );
$$;
grant execute on function public.page_gate(text) to authenticated;
