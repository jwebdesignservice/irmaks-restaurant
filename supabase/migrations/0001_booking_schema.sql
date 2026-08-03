-- Irmak booking system — Phase 1 foundation.
--
-- Capacity is a cap on total covers per time slot. There is no table
-- allocation, no floor plan and no turn times: the restaurant sorts tables
-- when guests arrive. Nothing in this schema should imply otherwise.
--
-- booking_date and booking_time are stored in restaurant local time
-- (Europe/London) as date and time, deliberately NOT timestamptz. Staff read
-- these off a phone in the restaurant; local time is the only representation
-- that matters, and storing UTC creates the class of bug where a booking made
-- in July displays an hour out in November.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- service_periods
-- ---------------------------------------------------------------------------
create table if not exists public.service_periods (
  id                    uuid primary key default gen_random_uuid(),
  day_of_week           int  not null check (day_of_week between 0 and 6), -- 0 = Sunday
  name                  text not null,                                     -- staff-facing only
  start_time            time not null,
  end_time              time not null,                                     -- last bookable slot, not closing time
  slot_interval_minutes int  not null default 15 check (slot_interval_minutes > 0),
  max_covers_per_slot   int  not null check (max_covers_per_slot >= 0),
  active                boolean not null default true,
  constraint service_periods_time_order check (end_time >= start_time)
);

create index if not exists service_periods_day_idx
  on public.service_periods (day_of_week) where active;

-- ---------------------------------------------------------------------------
-- blackout_dates
-- ---------------------------------------------------------------------------
create table if not exists public.blackout_dates (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  start_time time,  -- null start and end means the whole day
  end_time   time,
  reason     text not null,
  constraint blackout_partial_needs_both
    check ((start_time is null) = (end_time is null)),
  constraint blackout_time_order
    check (start_time is null or end_time >= start_time)
);

create index if not exists blackout_dates_date_idx on public.blackout_dates (date);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.booking_status as enum ('confirmed', 'arrived', 'no_show', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),  -- audit only
  booking_date       date not null,                       -- restaurant local date
  booking_time       time not null,                       -- restaurant local time
  party_size         int  not null check (party_size > 0),
  first_name         text not null,
  last_name          text not null,
  email              text not null,                       -- stored lowercased
  phone              text not null,                       -- normalised to E.164 where possible
  notes              text,
  status             public.booking_status not null default 'confirmed',
  marketing_opt_in   boolean not null default false,
  opt_in_at          timestamptz,
  cancellation_token uuid not null default gen_random_uuid(),
  source             text not null default 'web',
  constraint bookings_email_lowercase check (email = lower(email)),
  -- Consent must carry a timestamp: under UK GDPR the restaurant has to be
  -- able to evidence when it was given.
  constraint bookings_opt_in_has_timestamp
    check (marketing_opt_in = false or opt_in_at is not null)
);

create index if not exists bookings_date_time_idx
  on public.bookings (booking_date, booking_time) where status <> 'cancelled';
create index if not exists bookings_date_idx on public.bookings (booking_date);
create index if not exists bookings_email_idx on public.bookings (lower(email));
create index if not exists bookings_phone_idx on public.bookings (phone);
create unique index if not exists bookings_cancellation_token_idx
  on public.bookings (cancellation_token);

-- Guests double-tap confirm on mobile. Same email, same slot, same party size
-- can only exist once among live bookings.
create unique index if not exists bookings_dedupe_idx
  on public.bookings (lower(email), booking_date, booking_time, party_size)
  where status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- settings — single row, so the client can change behaviour without a redeploy
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id                    boolean primary key default true check (id),
  max_party_size_online int  not null default 8  check (max_party_size_online > 0),
  min_lead_time_minutes int  not null default 120 check (min_lead_time_minutes >= 0),
  max_advance_days      int  not null default 90  check (max_advance_days > 0),
  venue_email           text not null,
  venue_name            text not null,
  venue_address         text not null,
  venue_phone           text not null
);

-- ---------------------------------------------------------------------------
-- customers — a view, not a synced table. Zero sync surface.
-- ---------------------------------------------------------------------------
create or replace view public.customers as
select
  lower(email)                                              as email,
  max(first_name || ' ' || last_name)                       as name,
  max(phone)                                                as phone,
  count(*) filter (where status <> 'cancelled')             as total_bookings,
  max(booking_date) filter (where status = 'arrived')       as last_visit,
  bool_or(marketing_opt_in)                                 as marketing_opt_in,
  max(opt_in_at) filter (where marketing_opt_in)            as opt_in_at
from public.bookings
group by lower(email);

-- ---------------------------------------------------------------------------
-- Row level security. No anon policies anywhere: all public writes go through
-- server-side route handlers using the service role key, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.service_periods enable row level security;
alter table public.blackout_dates  enable row level security;
alter table public.bookings        enable row level security;
alter table public.settings        enable row level security;

drop policy if exists service_periods_staff on public.service_periods;
create policy service_periods_staff on public.service_periods
  for all to authenticated using (true) with check (true);

drop policy if exists blackout_dates_staff on public.blackout_dates;
create policy blackout_dates_staff on public.blackout_dates
  for all to authenticated using (true) with check (true);

drop policy if exists bookings_staff on public.bookings;
create policy bookings_staff on public.bookings
  for all to authenticated using (true) with check (true);

drop policy if exists settings_staff on public.settings;
create policy settings_staff on public.settings
  for all to authenticated using (true) with check (true);

-- The view runs with the privileges of the querying role, so staff-only access
-- to bookings carries through to customers.
alter view public.customers set (security_invoker = true);

revoke all on public.customers from anon;
