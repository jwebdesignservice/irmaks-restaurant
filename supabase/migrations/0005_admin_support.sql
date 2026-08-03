-- Everything the admin panel needs on top of the public booking flow.

-- ---------------------------------------------------------------------------
-- Internal staff notes, kept separate from the guest's own notes so staff can
-- never accidentally overwrite what the guest told us.
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column if not exists internal_notes text;

comment on column public.bookings.internal_notes is
  'Staff-only. Never shown to the guest and never included in any email.';

-- ---------------------------------------------------------------------------
-- Function grants.
--
-- 0002 and 0004 revoked execute from public, which also removed it from
-- authenticated (there was never an explicit grant). Staff need create_booking
-- for manual phone entry, including the capacity override. The public route
-- handler uses the service role.
-- ---------------------------------------------------------------------------
grant execute on function public.create_booking(
  date, time, int, text, text, text, text, text, text, boolean, text, boolean
) to authenticated, service_role;

grant execute on function public.cancel_booking(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Erasure, for UK GDPR requests. Deletes every booking for an email address so
-- the restaurant can honour a request without opening the Supabase dashboard.
-- Returns how many rows went, so the UI can confirm what happened.
-- ---------------------------------------------------------------------------
create or replace function public.delete_customer(p_email text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.bookings where lower(email) = lower(btrim(p_email));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.delete_customer(text) from public, anon;
grant execute on function public.delete_customer(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The customers view is read through the authenticated session, so staff need
-- select on it and on the underlying table (already covered by the bookings
-- policy in 0001).
-- ---------------------------------------------------------------------------
grant select on public.customers to authenticated;
