-- Admin panel: per-section permissions, append-only audit log. Applied 2026-10-13.

-- Retention: one row per (admin, section); removed with the account or when access is taken away.
create table if not exists public.admin_permissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  section text not null check (section ~ '^[a-z][a-z0-9-]{1,40}$'),
  primary key (user_id, section)
);
alter table public.admin_permissions enable row level security;

create or replace function public.can_admin(s text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_role('founder')
      or (public.has_role('admin') and exists (
            select 1 from public.admin_permissions where user_id = (select auth.uid()) and section = s));
$$;

create policy "admins read permissions" on public.admin_permissions
  for select to authenticated using ((select public.is_admin()));
create policy "founder grants sections" on public.admin_permissions
  for insert to authenticated with check ((select public.has_role('founder')));
create policy "founder removes sections" on public.admin_permissions
  for delete to authenticated using ((select public.has_role('founder')));

-- Written only through log_admin(); rows can never be edited, even with the service-role key.
-- Retention: 1 year (pruned by the daily cron).
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid not null references auth.users (id),
  action text not null check (char_length(action) <= 60),
  target text check (char_length(target) <= 200),
  detail jsonb,
  at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create index if not exists audit_log_at on public.audit_log (at desc);

create policy "admins read audit log" on public.audit_log
  for select to authenticated using ((select public.is_admin()));

create or replace function public.log_admin(p_action text, p_target text, p_detail jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor, action, target, detail)
  values ((select auth.uid()), p_action, p_target, p_detail);
end;
$$;

create or replace function public.audit_log_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'the audit log cannot be edited' using errcode = '42501';
end;
$$;
create or replace trigger audit_log_immutable before update on public.audit_log
  for each row execute function public.audit_log_immutable();

create policy "admins read storage readings" on public.storage_snapshots
  for select to authenticated using ((select public.can_admin('storage')));
