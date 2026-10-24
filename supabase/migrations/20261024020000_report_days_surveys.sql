-- Weather Patterns counts tornadoes confirmed by NWS damage surveys (NWS Damage Assessment
-- Toolkit) beside SPC's preliminary reports, and keeps each day's strongest rating.
alter table public.report_days
  add column if not exists surveyed integer not null default 0,
  add column if not exists strongest jsonb;
