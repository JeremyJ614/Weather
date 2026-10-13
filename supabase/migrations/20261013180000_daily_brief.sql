-- Daily Brief: subscriptions, push endpoints, delivery report, hourly scheduler. Applied 2026-10-13.

-- Retention: removed with the account.
create table if not exists public.brief_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  label text not null check (char_length(label) <= 80),
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  time_zone text not null check (char_length(time_zone) <= 60),
  send_hour smallint not null default 6 check (send_hour between 0 and 23),
  by_email boolean not null default true,
  by_push boolean not null default false,
  by_text boolean not null default false,
  last_sent date,
  updated_at timestamptz not null default now()
);
alter table public.brief_subscriptions enable row level security;
create policy "own brief" on public.brief_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "add own brief" on public.brief_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "edit own brief" on public.brief_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "stop own brief" on public.brief_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
create policy "sms admins read briefs" on public.brief_subscriptions for select to authenticated using ((select public.can_admin('sms')));

-- Retention: removed when the push service reports them gone (404/410) or with the account.
create table if not exists public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "add own push" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "remove own push" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Retention: 90 days (pruned by the daily cron).
create table if not exists public.brief_deliveries (
  day date not null,
  channel text not null check (channel in ('email', 'push', 'text')),
  sent integer not null default 0,
  failed integer not null default 0,
  primary key (day, channel)
);
alter table public.brief_deliveries enable row level security;
create policy "admins read deliveries" on public.brief_deliveries for select to authenticated using ((select public.is_admin()));

create extension if not exists pg_net;
create extension if not exists pg_cron;
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'db_cron_secret', 'Token the hourly scheduler sends to /api/cron/*')
where not exists (select 1 from vault.secrets where name = 'db_cron_secret');

create or replace function public.cron_token_ok(t text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return t is not null and t = (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret');
end;
$$;

select cron.schedule('daily-brief-hourly', '5 * * * *', $$
  select net.http_get(
    url := 'https://weather.sswx.space/api/cron/brief',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'db_cron_secret')),
    timeout_milliseconds := 60000
  );
$$);

-- Owner runs once in the SQL editor (the agent's SQL tool can't run deletes):
--   select cron.schedule('cron-history-prune', '23 6 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
