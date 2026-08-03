import { describe, expect, it } from 'vitest'
import { computeAvailability, nearestAlternatives } from '../availability'
import type { BlackoutDate, ServicePeriod, Settings } from '../types'

const settings: Settings = {
  max_party_size_online: 8,
  min_lead_time_minutes: 120,
  max_advance_days: 90,
  venue_email: 'info@irmak-restaurant.com',
  venue_name: 'Irmak',
  venue_address: 'Unit 7, Queens Link Leisure Park, 18 Esplanade, Aberdeen AB24 5NS',
  venue_phone: '01224 023161',
}

// 2026-08-02 is a Sunday.
const SUNDAY = '2026-08-02'

function period(over: Partial<ServicePeriod> = {}): ServicePeriod {
  return {
    id: 'p1',
    day_of_week: 0,
    name: 'All day',
    start_time: '12:00:00',
    end_time: '21:00:00',
    slot_interval_minutes: 15,
    max_covers_per_slot: 12,
    active: true,
    ...over,
  }
}

/** A fixed "now" well before the date under test, so lead time never interferes. */
const NOW = new Date('2026-07-20T10:00:00Z')

function run(over: Partial<Parameters<typeof computeAvailability>[0]> = {}) {
  return computeAvailability({
    date: SUNDAY,
    partySize: 2,
    servicePeriods: [period()],
    blackouts: [],
    bookedCovers: {},
    settings,
    now: NOW,
    ...over,
  })
}

describe('slot generation', () => {
  it('generates slots from start to end at the interval, inclusive', () => {
    const { slots } = run()
    expect(slots[0]).toBe('12:00')
    expect(slots.at(-1)).toBe('21:00') // end_time is the last bookable slot
    expect(slots).toHaveLength(37) // 12:00–21:00 at 15 min
  })

  it('returns nothing when the restaurant does not serve that weekday', () => {
    const result = run({ servicePeriods: [period({ day_of_week: 3 })] })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('closed')
  })

  it('ignores inactive service periods', () => {
    const result = run({ servicePeriods: [period({ active: false })] })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('closed')
  })

  it('merges overlapping periods and keeps the more generous cap', () => {
    const lunch = period({ id: 'lunch', start_time: '12:00:00', end_time: '15:00:00', max_covers_per_slot: 8 })
    const dinner = period({ id: 'dinner', start_time: '15:00:00', end_time: '21:00:00', max_covers_per_slot: 20 })
    // 15:00 is in both. A party of 12 fits only under the dinner cap.
    const result = run({ servicePeriods: [lunch, dinner], partySize: 12, settings: { ...settings, max_party_size_online: 20 } })
    expect(result.slots).toContain('15:00')
    expect(result.slots).not.toContain('14:45')
  })
})

describe('capacity — the cover cap is per slot', () => {
  it('keeps a slot while the party still fits exactly', () => {
    // 10 booked of 12, party of 2 -> exactly at the cap, still allowed.
    const { slots } = run({ partySize: 2, bookedCovers: { '19:30': 10 } })
    expect(slots).toContain('19:30')
  })

  it('removes a slot when the party would exceed the cap by one', () => {
    // 10 booked of 12, party of 3 -> 13 > 12.
    const { slots } = run({ partySize: 3, bookedCovers: { '19:30': 10 } })
    expect(slots).not.toContain('19:30')
  })

  it('removes a slot that is exactly full', () => {
    const { slots } = run({ partySize: 1, bookedCovers: { '19:30': 12 } })
    expect(slots).not.toContain('19:30')
  })

  it('caps each slot independently, not the period as a whole', () => {
    // 19:30 full, 19:45 empty. Only 19:30 disappears.
    const { slots } = run({ partySize: 4, bookedCovers: { '19:30': 12 } })
    expect(slots).not.toContain('19:30')
    expect(slots).toContain('19:45')
    expect(slots).toContain('19:15')
  })

  it('reports fully_booked when capacity is what emptied the day', () => {
    const full = Object.fromEntries(run().slots.map((s) => [s, 12]))
    const result = run({ partySize: 2, bookedCovers: full })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('fully_booked')
  })
})

describe('party size above the online limit', () => {
  it('returns no slots and the call-us message with the phone number', () => {
    const result = run({ partySize: 9 })
    expect(result.slots).toEqual([])
    expect(result.callUs).toEqual({
      reason: 'party_too_large',
      maxOnline: 8,
      phone: '01224 023161',
    })
  })

  it('still allows a party exactly on the limit', () => {
    const result = run({ partySize: 8 })
    expect(result.callUs).toBeUndefined()
    expect(result.slots.length).toBeGreaterThan(0)
  })
})

describe('blackout dates', () => {
  const blackout = (over: Partial<BlackoutDate>): BlackoutDate => ({
    id: 'b1',
    date: SUNDAY,
    start_time: null,
    end_time: null,
    reason: 'Private hire',
    ...over,
  })

  it('a null time range blacks out the whole day', () => {
    const result = run({ blackouts: [blackout({})] })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('blackout')
  })

  it('a partial blackout removes only the slots inside it', () => {
    const result = run({
      blackouts: [blackout({ start_time: '18:00:00', end_time: '20:00:00' })],
    })
    expect(result.slots).not.toContain('18:00')
    expect(result.slots).not.toContain('19:00')
    expect(result.slots).not.toContain('20:00') // inclusive at both ends
    expect(result.slots).toContain('17:45')
    expect(result.slots).toContain('20:15')
  })

  it('ignores blackouts belonging to a different date', () => {
    const result = run({ blackouts: [blackout({ date: '2026-08-03' })] })
    expect(result.slots).toHaveLength(37)
  })
})

describe('booking window', () => {
  it('rejects dates in the past', () => {
    const result = run({ date: '2026-07-19' })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('past')
  })

  it('rejects dates beyond max_advance_days', () => {
    const result = run({ date: '2026-12-25', servicePeriods: [period({ day_of_week: 5 })] })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('closed')
  })
})

describe('lead time is compared in Europe/London, not UTC', () => {
  // 2026-08-02 14:30 UTC is 15:30 BST in Aberdeen. With a 120-minute lead
  // time the first bookable slot is 17:30, NOT 16:30. Comparing against the
  // UTC clock on a Vercel server would wrongly offer 16:30 — a slot an hour
  // closer than the restaurant allows.
  const duringBST = new Date('2026-08-02T14:30:00Z')

  it('uses the local clock during BST', () => {
    const { slots } = run({ now: duringBST })
    expect(slots).not.toContain('16:30')
    expect(slots).not.toContain('17:15')
    expect(slots[0]).toBe('17:30')
  })

  it('uses the local clock during GMT, when local equals UTC', () => {
    // 2026-11-01 is a Sunday, GMT is in effect: 14:30 UTC is 14:30 local.
    const duringGMT = new Date('2026-11-01T14:30:00Z')
    const { slots } = run({ date: '2026-11-01', now: duringGMT })
    expect(slots[0]).toBe('16:30')
  })

  it('reports too_soon when only lead time emptied the day', () => {
    const lateInService = new Date('2026-08-02T20:30:00Z') // 21:30 BST
    const result = run({ now: lateInService })
    expect(result.slots).toEqual([])
    expect(result.emptyReason).toBe('too_soon')
  })
})

describe('nearestAlternatives', () => {
  it('returns the closest slots either side of the one that filled', () => {
    const slots = ['18:00', '19:00', '19:15', '19:45', '20:30']
    expect(nearestAlternatives(slots, '19:30')).toEqual(['19:15', '19:45', '19:00'])
  })

  it('copes with an empty slot list', () => {
    expect(nearestAlternatives([], '19:30')).toEqual([])
  })
})
