-- The Supabase project move (owner, 2026-11-26; docs/12-SUPABASE-MOVE.md).
--
-- Passwords (PINs are passwords) can't be exported, so members arrive in the new project
-- without one; their first sign-in is checked by the old project (src/lib/auth/carry.ts). This
-- says whether an email still has no password here, so only those sign-ins ask the old
-- project, and a PIN changed after the move is never replaced by the old one. Server only.
create or replace function public.password_unset(e text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(e) and coalesce(u.encrypted_password, '') = ''
  );
$$;
revoke all on function public.password_unset(text) from public, anon, authenticated;
grant execute on function public.password_unset(text) to service_role;

-- Severe Analogs was retired (decision 2026-11-15); its job only answered 410.
do $$ begin
  if exists (select 1 from cron.job where jobname = 'engine-analogs') then
    perform cron.unschedule('engine-analogs');
  end if;
end $$;
