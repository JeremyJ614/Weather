-- Admin-set menu and theme defaults. Applied 2026-10-13.
insert into public.app_config (key, value) values
  ('menu_defaults', '{"main":"sweep","second":"morph"}'::jsonb),
  ('theme_default', '{"palette":"vip","font":"editorial"}'::jsonb)
on conflict (key) do nothing;

create policy "site defaults are public" on public.app_config
  for select to anon, authenticated using (key in ('menu_defaults', 'theme_default'));
create policy "menu admins edit site defaults" on public.app_config
  for update to authenticated
  using (key in ('menu_defaults', 'theme_default') and (select public.can_admin('menus')))
  with check (key in ('menu_defaults', 'theme_default') and (select public.can_admin('menus')));
