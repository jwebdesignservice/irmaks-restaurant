-- create_booking — the source of truth for capacity.
--
-- The client-side availability check is a UX convenience only. Two guests
-- taking the last two covers at 19:30 simultaneously must not both succeed, so
-- the capacity check and the insert happen atomically inside one transaction,
-- serialised on the slot by an advisory lock.
--
-- Raises, and the API maps each to a status code:
--   IRMAK_NO_SERVICE  -> 409  restaurant is not serving at that time
--   IRMAK_BLACKOUT    -> 409  date/time is blacked out
--   IRMAK_FULL        -> 409  slot would exceed the cover cap
--   IRMAK_DUPLICATE   -> 409  same guest already holds that slot

create or replace function public.create_booking(
  p_booking_date     date,
  p_booking_time     time,
  p_party_size       int,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_notes            text default null,
  p_marketing_opt_in boolean default false,
  p_source           text default 'web',
  p_override_capacity boolean default false  -- staff-only: manager overriding the cap
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dow           int;
  v_cap           int;
  v_booked_covers int;
  v_booking       public.bookings;
begin
  -- Serialise every booking attempt for this exact slot. Two concurrent
  -- transactions for 2026-08-02 19:30 queue here; the second sees the first's
  -- committed row when it re-counts below.
  perform pg_advisory_xact_lock(
    hashtext(p_booking_date::text || ' ' || p_booking_time::text)
  );

  v_dow := extract(dow from p_booking_date)::int;  -- 0 = Sunday

  -- Highest cap among the active service periods covering this slot. Lunch and
  -- dinner may overlap at the boundary; the more generous cap wins.
  select max(sp.max_covers_per_slot)
    into v_cap
  from public.service_periods sp
  where sp.active
    and sp.day_of_week = v_dow
    and p_booking_time between sp.start_time and sp.end_time
    -- the slot must land exactly on the interval grid
    and mod(
          extract(epoch from (p_booking_time - sp.start_time))::int,
          sp.slot_interval_minutes * 60
        ) = 0;

  if v_cap is null and not p_override_capacity then
    raise exception 'IRMAK_NO_SERVICE' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.blackout_dates b
    where b.date = p_booking_date
      and (
        b.start_time is null  -- whole day
        or p_booking_time between b.start_time and b.end_time
      )
  ) and not p_override_capacity then
    raise exception 'IRMAK_BLACKOUT' using errcode = 'P0001';
  end if;

  -- Re-count inside the lock. This is the check that actually matters.
  select coalesce(sum(b.party_size), 0)
    into v_booked_covers
  from public.bookings b
  where b.booking_date = p_booking_date
    and b.booking_time = p_booking_time
    and b.status <> 'cancelled';

  if not p_override_capacity
     and v_booked_covers + p_party_size > coalesce(v_cap, 0) then
    raise exception 'IRMAK_FULL' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (
      booking_date, booking_time, party_size,
      first_name, last_name, email, phone, notes,
      marketing_opt_in, opt_in_at, source
    ) values (
      p_booking_date, p_booking_time, p_party_size,
      p_first_name, p_last_name, lower(p_email), p_phone, nullif(btrim(p_notes), ''),
      p_marketing_opt_in,
      case when p_marketing_opt_in then now() else null end,
      p_source
    )
    returning * into v_booking;
  exception
    when unique_violation then
      -- Double-tapped confirm, or a genuine repeat of the same slot.
      raise exception 'IRMAK_DUPLICATE' using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

revoke all on function public.create_booking(
  date, time, int, text, text, text, text, text, boolean, text, boolean
) from public, anon;

-- ---------------------------------------------------------------------------
-- cancel_booking — self-service cancellation from the emailed link.
-- Token is the only credential, so this is deliberately narrow: it flips
-- status and nothing else, and it is idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_token uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
     set status = 'cancelled'
   where cancellation_token = p_token
     and status <> 'cancelled'
  returning * into v_booking;

  if v_booking.id is null then
    -- Already cancelled, or no such token. Return the row if it exists so the
    -- UI can show "already cancelled" rather than a dead end.
    select * into v_booking from public.bookings where cancellation_token = p_token;
  end if;

  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid) from public, anon;
