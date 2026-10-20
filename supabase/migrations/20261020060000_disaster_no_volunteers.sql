-- Disaster Response without volunteers (Fix-It List #17 #3, 2026-10-20). The owner removed
-- the volunteer sign-up and roster; organizations keep their own "Volunteer with them" links.
-- disaster_apply() now takes organization sign-ups only. The roster table held no rows.

create or replace function public.disaster_apply(
  p_kind text, p_name text, p_email text, p_subject text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mid uuid;
begin
  if p_kind <> 'org' then
    raise exception 'unknown sign-up' using errcode = '22023';
  end if;
  if (select count(*) from public.contact_messages
      where created_at > now() - interval '1 hour'
        and (email = lower(trim(p_email)) or (uid is not null and user_id = uid))) >= 5 then
    raise exception 'too many messages' using errcode = '54000';
  end if;
  insert into public.contact_messages (form, user_id, name, email, subject, body)
    values ('disaster-org', uid, trim(p_name), lower(trim(p_email)),
            coalesce(trim(p_subject), ''), trim(p_body))
    returning id into mid;
  insert into public.disaster_orgs (name, mission, services, areas, website, donate_url,
      volunteer_url, phone, email, logo_url, socials, message_id)
    values (p_data->>'name', p_data->>'mission',
      coalesce(array(select jsonb_array_elements_text(p_data->'services')), '{}'),
      p_data->>'areas', nullif(p_data->>'website', ''), nullif(p_data->>'donate_url', ''),
      nullif(p_data->>'volunteer_url', ''), nullif(p_data->>'phone', ''),
      nullif(p_data->>'email', ''), nullif(p_data->>'logo_url', ''),
      coalesce(p_data->'socials', '{}'::jsonb), mid);
end;
$$;

drop table if exists public.disaster_volunteers;
