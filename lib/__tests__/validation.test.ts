import { describe, expect, it } from 'vitest'
import { normalisePhone, isValidEmail, isValidPhone, validateBooking } from '../validation'
import { OCCASIONS } from '../occasions'

describe('normalisePhone', () => {
  // Normalising on write is what makes admin phone search work: without it,
  // searching "07700900123" misses the same number stored as "+44 7700 900123".
  it.each([
    ['07700900123', '+447700900123'],
    ['07700 900123', '+447700900123'],
    ['07700 900 123', '+447700900123'],
    ['(07700) 900-123', '+447700900123'],
    ['+447700900123', '+447700900123'],
    ['+44 7700 900123', '+447700900123'],
    ['00447700900123', '+447700900123'],
    ['447700900123', '+447700900123'],
    ['01224023161', '+441224023161'],
    ['01224 023161', '+441224023161'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalisePhone(input)).toBe(expected)
  })

  it('collapses every UK format of one number to the same string', () => {
    const forms = ['07700900123', '+44 7700 900123', '0044 7700 900123', '(07700) 900 123']
    const normalised = new Set(forms.map(normalisePhone))
    expect(normalised.size).toBe(1)
  })

  it('keeps a non-UK international number as-is', () => {
    expect(normalisePhone('+353 86 1234567')).toBe('+353861234567')
  })

  it('returns something dialable rather than mangling what it cannot parse', () => {
    expect(normalisePhone('call the office')).toBe('calltheoffice')
  })
})

describe('isValidPhone', () => {
  it.each(['07700900123', '+44 7700 900123', '01224 023161'])('accepts %s', (v) => {
    expect(isValidPhone(v)).toBe(true)
  })

  it.each(['', '123', '07700'])('rejects %s', (v) => {
    expect(isValidPhone(v)).toBe(false)
  })
})

describe('isValidEmail', () => {
  it.each(['a@b.co', 'ayla.demir@example.com', 'first+tag@sub.domain.co.uk'])(
    'accepts %s',
    (v) => expect(isValidEmail(v)).toBe(true)
  )

  it.each(['', 'not-an-email', 'a@b', 'a@@b.com', 'a b@c.com', 'a@b.'])('rejects %s', (v) => {
    expect(isValidEmail(v)).toBe(false)
  })
})

describe('validateBooking', () => {
  const valid = {
    booking_date: '2026-08-02',
    booking_time: '19:30',
    party_size: 4,
    first_name: '  Ayla ',
    last_name: 'Demir',
    email: 'Ayla.Demir@Example.COM',
    phone: '07700 900123',
    notes: '  Nut allergy  ',
    marketing_opt_in: true,
  }

  it('accepts a good payload and normalises it', () => {
    const result = validateBooking(valid, 8)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.first_name).toBe('Ayla')
    expect(result.value.email).toBe('ayla.demir@example.com') // stored lowercased
    expect(result.value.phone).toBe('+447700900123')
    expect(result.value.notes).toBe('Nut allergy')
  })

  it('turns blank notes into null rather than an empty string', () => {
    const result = validateBooking({ ...valid, notes: '   ' }, 8)
    expect(result.ok && result.value.notes).toBeNull()
  })

  it('defaults marketing opt-in to false for anything but an explicit true', () => {
    for (const value of [undefined, null, 'true', 1, 'on']) {
      const result = validateBooking({ ...valid, marketing_opt_in: value }, 8)
      expect(result.ok && result.value.marketing_opt_in).toBe(false)
    }
  })

  it('rejects a party above the limit it is given', () => {
    const result = validateBooking({ ...valid, party_size: 9 }, 8)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.field).toBe('party_size')
  })

  it('allows a larger party when staff pass a higher limit', () => {
    // Manual entry bypasses max_party_size_online.
    expect(validateBooking({ ...valid, party_size: 30 }, 100).ok).toBe(true)
  })

  it.each([
    ['party_size', { party_size: 0 }],
    ['party_size', { party_size: 2.5 }],
    ['first_name', { first_name: '' }],
    ['last_name', { last_name: '   ' }],
    ['email', { email: 'nope' }],
    ['phone', { phone: '12' }],
    ['booking_date', { booking_date: '02-08-2026' }],
    ['booking_date', { booking_date: '2026-02-30' }],
    ['booking_time', { booking_time: '25:00' }],
    ['booking_time', { booking_time: '7pm' }],
  ])('rejects a bad %s', (field, override) => {
    const result = validateBooking({ ...valid, ...override }, 8)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.field).toBe(field)
  })

  it('rejects a non-object body', () => {
    expect(validateBooking(null, 8).ok).toBe(false)
    expect(validateBooking('nope', 8).ok).toBe(false)
  })

  describe('occasion', () => {
    it('accepts each occasion the UI can produce', () => {
      for (const { value } of OCCASIONS) {
        const result = validateBooking({ ...valid, occasion: value }, 8)
        expect(result.ok && result.value.occasion).toBe(value)
      }
    })

    it('treats absent, empty and whitespace as no occasion', () => {
      for (const value of [undefined, null, '', '   ']) {
        const result = validateBooking({ ...valid, occasion: value }, 8)
        expect(result.ok && result.value.occasion).toBeNull()
      }
    })

    it('rejects a value outside the list rather than dropping it', () => {
      // The database has a matching check constraint, so silently discarding
      // an unknown value would hide a real mismatch.
      const result = validateBooking({ ...valid, occasion: 'graduation' }, 8)
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.field).toBe('occasion')
    })
  })

  describe('party sizes up to 50', () => {
    it('accepts a party of 50 when that is the limit', () => {
      const result = validateBooking({ ...valid, party_size: 50 }, 50)
      expect(result.ok && result.value.party_size).toBe(50)
    })

    it('still rejects 51', () => {
      expect(validateBooking({ ...valid, party_size: 51 }, 50).ok).toBe(false)
    })
  })
})
