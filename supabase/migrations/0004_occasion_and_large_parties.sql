-- Special occasion on a booking, and raising the online party limit to 50.
--
-- Note on the party limit: the original design capped online parties at 8 and
-- sent larger groups to the phone, which is why the system needs no table
-- logic. Raising max_party_size_online to 50 and the slot cap to 50 means one
-- booking can take an entire slot's capacity with no staff approval step. This
-- was a deliberate client decision, recorded here so it is not mistaken for an
-- oversight later.

-- ---------------------------------------------------------------------------
-- occasion
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists occasion text;

do $$ begin
  alter table public.bookings
    add constraint bookings_occasion_allowed
    check (
      occasion is null
      or occasion in ('birthday', 'anniversary', 'engagement', 'celebration', 'business', 'other')
    );
exception
  when duplicate_object then null;
end $$;

comment on column public.bookings.occasion is
  'Null means no special occasion. Shown to staff on the booking detail so the kitchen and front of house can prepare.';

-- ---------------------------------------------------------------------------
-- Settings: online party limit and per-slot cover cap both to 50
-- ---------------------------------------------------------------------------
update public.settings set max_party_size_online = 50 where id;

update public.service_periods set max_covers_per_slot = 50 where active;

-- ---------------------------------------------------------------------------
-- create_booking gains p_occasion. The signature changes, so the old function
-- has to go first.
-- ---------------------------------------------------------------------------
drop function if exists public.create_booking(
  date, time, int, text, text, text, text, text, boolean, text, boolean
);

create or replace function public.create_booking(
  p_booking_date     date,
  p_booking_time     time,
  p_party_size       int,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_notes            text default null,
  p_occasion         text default null,
  p_marketing_opt_in boolean default false,
  p_source           text default 'web',
  p_override_capacity boolean default false
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
  perform pg_advisory_xact_lock(
    hashtext(p_booking_date::text || ' ' || p_booking_time::text)
  );

  v_dow := extract(dow from p_booking_date)::int;

  select max(sp.max_covers_per_slot)
    into v_cap
  from public.service_periods sp
  where sp.active
    and sp.day_of_week = v_dow
    and p_booking_time between sp.start_time and sp.end_time
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
        b.start_time is null
        or p_booking_time between b.start_time and b.end_time
      )
  ) and not p_override_capacity then
    raise exception 'IRMAK_BLACKOUT' using errcode = 'P0001';
  end if;

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
      first_name, last_name, email, phone, notes, occasion,
      marketing_opt_in, opt_in_at, source
    ) values (
      p_booking_date, p_booking_time, p_party_size,
      p_first_name, p_last_name, lower(p_email), p_phone,
      nullif(btrim(p_notes), ''), nullif(btrim(p_occasion), ''),
      p_marketing_opt_in,
      case when p_marketing_opt_in then now() else null end,
      p_source
    )
    returning * into v_booking;
  exception
    when unique_violation then
      raise exception 'IRMAK_DUPLICATE' using errcode = 'P0001';
  end;

  return v_booking;
end;
$$;

revoke all on function public.create_booking(
  date, time, int, text, text, text, text, text, text, boolean, text, boolean
) from public, anon;
