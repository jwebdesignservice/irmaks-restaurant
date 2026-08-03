-- Seed: real opening hours and default settings.
--
-- Opening hours are Monday–Sunday 12:00–22:00 (from the site footer). end_time
-- is the LAST BOOKABLE SLOT, not closing time, so it is 21:00 — an hour before
-- the doors shut.
--
-- >>> max_covers_per_slot IS A PLACEHOLDER PENDING THE CLIENT CONVERSATION. <<<
-- These values are superseded by migration 0004, which raises both the cap and
-- max_party_size_online to 50 so parties of up to 50 can book online. That was
-- a deliberate client decision. Be aware of what it means in practice: one
-- booking can consume an entire slot's capacity without any staff approval, and
-- 50 covers can land at a single 15-minute slot. The interval and the cap have
-- to be agreed together — a cap of 50 at 15 minutes and a cap of 50 at 30
-- minutes are very different kitchens. Confirm both before handover.

insert into public.service_periods
  (day_of_week, name, start_time, end_time, slot_interval_minutes, max_covers_per_slot, active)
values
  (0, 'All day', '12:00', '21:00', 15, 12, true),  -- Sunday
  (1, 'All day', '12:00', '21:00', 15, 12, true),  -- Monday
  (2, 'All day', '12:00', '21:00', 15, 12, true),  -- Tuesday
  (3, 'All day', '12:00', '21:00', 15, 12, true),  -- Wednesday
  (4, 'All day', '12:00', '21:00', 15, 12, true),  -- Thursday
  (5, 'All day', '12:00', '21:00', 15, 12, true),  -- Friday
  (6, 'All day', '12:00', '21:00', 15, 12, true)   -- Saturday
on conflict do nothing;

insert into public.settings
  (id, max_party_size_online, min_lead_time_minutes, max_advance_days,
   venue_email, venue_name, venue_address, venue_phone)
values
  (true, 8, 120, 90,
   'info@irmak-restaurant.com',
   'Irmak',
   'Unit 7, Queens Link Leisure Park, 18 Esplanade, Aberdeen AB24 5NS',
   '01224 023161')
on conflict (id) do nothing;
