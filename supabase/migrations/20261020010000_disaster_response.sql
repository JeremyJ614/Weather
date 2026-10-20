-- Disaster Response (Phase 61, Final Fix-It #19). Applied 2026-10-20.
-- Organizations listed on /disaster-response, and the volunteer roster. Organizations and
-- volunteers sign up through disaster_apply(), which also files the sign-up in admin →
-- Contact inbox; nothing shows publicly until an admin approves it there.
-- Retention: approved rows stay until an admin removes them; declined rows are deleted 30
-- days after the decision (storage watchdog); a volunteer's user link clears with the account.

-- Retention: kept while approved or pending; declined rows go 30 days after the decision.
create table if not exists public.disaster_orgs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  name text not null check (char_length(name) between 2 and 100),
  mission text not null check (char_length(mission) between 10 and 600),
  services text[] not null default '{}' check (cardinality(services) <= 16),
  areas text not null check (char_length(areas) between 2 and 200),
  website text check (website ~ '^https?://' and char_length(website) <= 300),
  donate_url text check (donate_url ~ '^https?://' and char_length(donate_url) <= 300),
  volunteer_url text check (volunteer_url ~ '^https?://' and char_length(volunteer_url) <= 300),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 200),
  logo_url text check (logo_url ~ '^https://' and char_length(logo_url) <= 300),
  socials jsonb not null default '{}' check (jsonb_typeof(socials) = 'object'),
  sort int not null default 100,
  message_id uuid references public.contact_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists disaster_orgs_status on public.disaster_orgs (status, sort, name);
alter table public.disaster_orgs enable row level security;
create policy "anyone reads approved organizations" on public.disaster_orgs
  for select to anon, authenticated using (status = 'approved');
create policy "disaster admins read organizations" on public.disaster_orgs
  for select to authenticated
  using ((select public.can_admin('disaster')) or (select public.can_admin('inbox')));
create policy "disaster admins add organizations" on public.disaster_orgs
  for insert to authenticated with check ((select public.can_admin('disaster')));
create policy "disaster admins review organizations" on public.disaster_orgs
  for update to authenticated
  using ((select public.can_admin('disaster')) or (select public.can_admin('inbox')))
  with check ((select public.can_admin('disaster')) or (select public.can_admin('inbox')));
create policy "disaster admins remove organizations" on public.disaster_orgs
  for delete to authenticated using ((select public.can_admin('disaster')));

-- Retention: kept while approved or pending; declined rows go 30 days after the decision.
create table if not exists public.disaster_volunteers (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 30),
  base text not null check (char_length(base) between 2 and 120),
  travel text not null check (char_length(travel) <= 40),
  availability text not null check (char_length(availability) <= 60),
  skills text[] not null default '{}' check (cardinality(skills) <= 20),
  org_id uuid references public.disaster_orgs (id) on delete set null,
  note text check (char_length(note) <= 1000),
  message_id uuid references public.contact_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists disaster_volunteers_status on public.disaster_volunteers (status, created_at desc);
alter table public.disaster_volunteers enable row level security;
-- Volunteers are never public: only admins who review sign-ups see the roster.
create policy "disaster admins read volunteers" on public.disaster_volunteers
  for select to authenticated
  using ((select public.can_admin('disaster')) or (select public.can_admin('inbox')));
create policy "disaster admins review volunteers" on public.disaster_volunteers
  for update to authenticated
  using ((select public.can_admin('disaster')) or (select public.can_admin('inbox')))
  with check ((select public.can_admin('disaster')) or (select public.can_admin('inbox')));
create policy "disaster admins remove volunteers" on public.disaster_volunteers
  for delete to authenticated using ((select public.can_admin('disaster')));

-- A sign-up: the inbox message and the pending row, together. Rate limited with the
-- contact forms (five messages an hour per email or account).
create or replace function public.disaster_apply(
  p_kind text, p_name text, p_email text, p_subject text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mid uuid;
begin
  if p_kind not in ('org', 'volunteer') then
    raise exception 'unknown sign-up' using errcode = '22023';
  end if;
  if (select count(*) from public.contact_messages
      where created_at > now() - interval '1 hour'
        and (email = lower(trim(p_email)) or (uid is not null and user_id = uid))) >= 5 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  insert into public.contact_messages (form, user_id, name, email, subject, body)
    values ('disaster-' || p_kind, uid, trim(p_name), lower(trim(p_email)),
            coalesce(trim(p_subject), ''), trim(p_body))
    returning id into mid;
  if p_kind = 'org' then
    insert into public.disaster_orgs (name, mission, services, areas, website, donate_url,
        volunteer_url, phone, email, logo_url, socials, message_id)
      values (p_data->>'name', p_data->>'mission',
        coalesce(array(select jsonb_array_elements_text(p_data->'services')), '{}'),
        p_data->>'areas', nullif(p_data->>'website', ''), nullif(p_data->>'donate_url', ''),
        nullif(p_data->>'volunteer_url', ''), nullif(p_data->>'phone', ''),
        nullif(p_data->>'email', ''), nullif(p_data->>'logo_url', ''),
        coalesce(p_data->'socials', '{}'::jsonb), mid);
  else
    insert into public.disaster_volunteers (user_id, name, email, phone, base, travel,
        availability, skills, org_id, note, message_id)
      values (uid, trim(p_name), lower(trim(p_email)), nullif(p_data->>'phone', ''),
        p_data->>'base', p_data->>'travel', p_data->>'availability',
        coalesce(array(select jsonb_array_elements_text(p_data->'skills')), '{}'),
        (select o.id from public.disaster_orgs o
          where o.id::text = p_data->>'org_id' and o.status = 'approved'),
        nullif(p_data->>'note', ''), mid);
  end if;
end;
$$;
revoke execute on function public.disaster_apply(text, text, text, text, text, jsonb) from public;
grant execute on function public.disaster_apply(text, text, text, text, text, jsonb) to anon, authenticated;

-- Declined sign-ups are deleted 30 days after the decision by the daily storage watchdog
-- (src/app/api/cron/storage-watchdog), with the other retention rules.

-- The five starting organizations (the owner asked for five to be chosen): national groups
-- that work U.S. tornado, flood and hurricane disasters. Links checked 2026-10-20.
insert into public.disaster_orgs (status, sort, name, mission, services, areas, website, donate_url, volunteer_url, phone, reviewed_at) values
  ('approved', 1, 'American Red Cross',
   'Shelter, meals, emergency supplies and emotional support in the hours and days after a disaster, plus help finding loved ones and money for urgent needs. Volunteers make up most of its disaster workforce.',
   array['Shelter', 'Food & water', 'Supplies', 'Mental & spiritual care', 'Financial help', 'Reconnecting families'],
   'All 50 states and U.S. territories', 'https://www.redcross.org',
   'https://www.redcross.org/donate/donation.html',
   'https://www.redcross.org/volunteer/become-a-volunteer.html', '1-800-733-2767', now()),
  ('approved', 2, 'The Salvation Army Emergency Disaster Services',
   'Mobile kitchens that serve meals and drinks to survivors and first responders, emotional and spiritual care, cleanup supplies, and help with long-term recovery, through local Salvation Army units.',
   array['Food & water', 'Supplies', 'Mental & spiritual care', 'Rebuilding'],
   'Nationwide, through local Salvation Army units', 'https://salarmyeds.org',
   'https://give.helpsalvationarmy.org/give/166081/',
   'https://salarmyeds.org/index.php/volunteer-with-us-copy/', '1-800-725-2769', now()),
  ('approved', 3, 'Team Rubicon',
   'Veteran-led volunteer teams that clear debris, run chainsaws, muck out flooded homes, assess damage and help rebuild. Veterans and civilians can join as volunteers.',
   array['Debris removal', 'Chainsaw work', 'Muck-out', 'Damage assessment', 'Rebuilding'],
   'Across the United States', 'https://teamrubiconusa.org', null,
   'https://teamrubiconusa.org/how-to-get-involved/volunteer-with-us/', null, now()),
  ('approved', 4, 'Samaritan''s Purse U.S. Disaster Relief',
   'Christian relief organization whose volunteer teams help homeowners after tornadoes, floods and hurricanes: tarping roofs, cutting and clearing fallen trees, mucking out and saving belongings, at no cost to the homeowner.',
   array['Debris removal', 'Chainsaw work', 'Roof tarping', 'Muck-out', 'Mental & spiritual care'],
   'Across the United States and Canada', 'https://www.samaritanspurse.org/our-ministry/nam/',
   'https://www.samaritanspurse.org/our-ministry/donate-online/',
   'https://www.samaritanspurse.org/our-ministry/nam/#volunteer-now', null, now()),
  ('approved', 5, 'World Central Kitchen',
   'Chef-led teams that cook and deliver fresh meals in the first hours after a disaster, working with local restaurants, food trucks and volunteers.',
   array['Food & water'],
   'Worldwide, including across the United States', 'https://wck.org',
   'https://wck.org/donate/', 'https://wck.org/volunteer/', null, now());
