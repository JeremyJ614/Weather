-- Forecast Discussion (AI simplified, cached per issuance) and the AI usage meter. Applied 2026-10-13.

-- Retention: 7 days (pruned by the daily cron).
create table if not exists public.afd_simplified (
  product_id text primary key check (char_length(product_id) <= 80),
  office text not null check (office ~ '^[A-Z]{3}$'),
  issued timestamptz not null,
  simplified text not null check (char_length(simplified) <= 8000),
  created_at timestamptz not null default now()
);
alter table public.afd_simplified enable row level security;
create policy "simplified discussions are public" on public.afd_simplified for select to anon, authenticated using (true);

-- Retention: 90 days (pruned by the daily cron).
create table if not exists public.ai_usage (
  day date not null,
  feature text not null check (char_length(feature) <= 40),
  calls integer not null default 0,
  failures integer not null default 0,
  primary key (day, feature)
);
alter table public.ai_usage enable row level security;
create policy "admins read ai usage" on public.ai_usage for select to authenticated using ((select public.is_admin()));

create or replace function public.count_ai_call(p_feature text, p_ok boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.ai_usage (day, feature, calls, failures)
  values ((now() at time zone 'utc')::date, left(p_feature, 40), 1, case when p_ok then 0 else 1 end)
  on conflict (day, feature) do update
    set calls = public.ai_usage.calls + 1,
        failures = public.ai_usage.failures + case when p_ok then 0 else 1 end;
end;
$$;
