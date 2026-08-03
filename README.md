# irmaks-restaurant

Irmak's website and self-hosted booking system, replacing OpenTable.

Staff-facing instructions live in [docs/staff-guide.md](docs/staff-guide.md).

## Layout

The site was a Webflow export and still is — those files are untouched in
`public/` and keep their original URLs. Next.js sits around them and owns the
booking system only.

```
public/                 the Webflow export, served as static files
  index.html            "/" is rewritten to this in next.config.js
  menu.html  jobs.html  reservations.html
app/
  book/                 public booking page
  booking/[token]/      guest self-service cancellation
  admin/                staff panel (day view, booking detail, manual entry,
                        customers, settings)
  api/                  availability, bookings, cancellation
lib/                    availability logic, validation, email, data access
supabase/migrations/    schema, RPCs, seed — apply in numeric order
middleware.ts           refreshes the staff session, guards /admin
```

## Running it

```bash
npm install
npm run dev
```

```bash
npm test
```

With no environment variables the booking page runs against an in-memory demo
store and `/admin` is sealed. Copy `.env.example` to `.env.local` for a real
project.

> Do not run `npm run build` while `npm run dev` is running — the build
> overwrites the `.next` directory the dev server is serving from and every
> asset 404s until you restart it.

## Setting up a real environment

1. Create a Supabase project.
2. Apply `supabase/migrations/*.sql` **in numeric order**. 0004 raises the online
   party limit and cover cap to 50; 0005 adds internal notes, function grants and
   the erasure RPC.
3. Put the project URL, anon key and service role key in the environment.
4. **Create staff accounts by hand** in Supabase → Authentication → Users. There
   is no signup page, by design. Three to five accounts is the expectation.
5. Add a Resend API key and a verified sending domain, then set
   `BOOKING_FROM_EMAIL`.
6. Add Cloudflare Turnstile keys.
7. Set `NEXT_PUBLIC_SITE_URL` so cancellation links in emails are absolute.

## Key decisions

**Times are stored in restaurant local time.** `booking_date` is a `date` and
`booking_time` a `time`, both `Europe/London`, deliberately not `timestamptz`.
Vercel runs in UTC, so every "is this slot too soon" comparison goes through
`lib/time.ts` rather than `new Date()`. Tests cover both BST and GMT.

**Capacity is a cap on covers per slot.** No table allocation, no floor plan, no
turn times — the restaurant sorts tables when guests arrive.

**The RPC is the source of truth for capacity**, not the availability call.
`create_booking` re-checks inside a `pg_advisory_xact_lock`, so two guests taking
the last covers at 19:30 cannot both succeed. The client-side check is a UX
convenience only.

**Two Supabase clients, on purpose.** The public booking and cancellation routes
use the service role key server-side, validating every payload themselves. The
admin uses the staff member's session, so RLS applies to every admin read and
write — the service role key never touches the admin surface.

**No anon policies.** RLS is on for every table with policies scoped to
`authenticated`.

**Email never blocks a booking.** Sends are wrapped so a Resend outage cannot
turn a saved booking into an error for the guest.

## Before handover

- [ ] **Agree the cover cap and slot interval with the restaurant, together.**
      Migration 0004 sets both the cap and the online party limit to 50 at the
      client's request. That means one booking can consume an entire slot with no
      staff approval, and 50 covers can land on a single 15-minute slot. Adjust
      on the Settings screen once you have had that conversation.
- [ ] Resend domain authentication (SPF, DKIM, DMARC), then **test delivery to
      Gmail, Outlook and iCloud** before handover.
- [ ] Create the staff accounts and hand out passwords.
- [ ] Walk the manager through [docs/staff-guide.md](docs/staff-guide.md).
- [ ] Add the booking page URL as the reservations link on the Google Business
      Profile. Google decides whether the button renders, so this is
      best-efforts.
- [ ] **Outstanding: `npm audit` reports two high-severity Next.js advisories**
      that need a Next 15 major upgrade to clear. Neither applies as built — one
      is the Image Optimizer, which is unused, and the other needs a
      configuration we do not have. Worth scheduling, not worth blocking on. The
      remaining advisories are dev-only (vitest, vite, esbuild).

## Not built, deliberately

Out of scope per the brief and not scaffolded for: table assignment and floor
plans, payments and deposits, SMS or WhatsApp, CRM sync, multi-location,
waitlists, loyalty, POS integration, and customer logins.

The 24-hour reminder email is the one optional item left on the table. It is the
highest-value thing remaining for no-show reduction, and would be a Supabase
scheduled function.
