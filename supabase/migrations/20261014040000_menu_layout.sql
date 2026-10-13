-- Fix-It #4: the owner's menu arrangement (sections, order, page names and icons, hidden pages).
-- Everyone reads it (the menus are public); admins with the Menus permission edit it.
insert into public.app_config (key, value) values ('menu_layout', '{}'::jsonb)
  on conflict (key) do nothing;
create policy "menu layout is public" on public.app_config
  for select to anon, authenticated using (key = 'menu_layout');
create policy "menu admins edit layout" on public.app_config
  for update to authenticated
  using (key = 'menu_layout' and (select public.can_admin('menus')))
  with check (key = 'menu_layout' and (select public.can_admin('menus')));

-- The defaults rows were never seeded, so saving Menu & theme defaults updated nothing.
insert into public.app_config (key, value) values
  ('menu_defaults', '{"main":"sweep","second":"morph"}'::jsonb),
  ('theme_default', '{"palette":"vip","font":"vip"}'::jsonb)
  on conflict (key) do nothing;
