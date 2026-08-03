import { describe, expect, it } from 'vitest'
import { toCsv } from '../csv'

// This export is how the restaurant takes its customer data off OpenTable, so
// it has to open correctly in Excel first time.

const BOM = '﻿'

describe('toCsv', () => {
  it('starts with a UTF-8 BOM so Excel does not mangle accented names', () => {
    const csv = toCsv(['Name'], [['Şeyma Güneş']])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toContain('Şeyma Güneş')
  })

  it('uses CRLF line endings', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']])
    expect(csv).toBe(`${BOM}A,B\r\n1,2\r\n`)
  })

  it('quotes fields containing commas', () => {
    const csv = toCsv(['Address'], [['Unit 7, Queens Link, Aberdeen']])
    expect(csv).toContain('"Unit 7, Queens Link, Aberdeen"')
  })

  it('doubles embedded quotes', () => {
    const csv = toCsv(['Note'], [['They asked for the "good" table']])
    expect(csv).toContain('"They asked for the ""good"" table"')
  })

  it('quotes fields containing newlines rather than breaking the row', () => {
    const csv = toCsv(['Note'], [['line one\nline two']])
    expect(csv).toContain('"line one\nline two"')
    // header + one record: exactly one CRLF separating them
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(2)
  })

  it('renders null and undefined as empty, not as the words', () => {
    const csv = toCsv(['A', 'B'], [[null, undefined]])
    expect(csv).toBe(`${BOM}A,B\r\n,\r\n`)
  })

  it('neutralises formula injection, including in phone numbers', () => {
    // A leading + makes Excel treat the cell as a formula. Every UK mobile we
    // normalise starts with +44, so this is the common case, not an edge case.
    const csv = toCsv(['Phone'], [['+447700900123']])
    expect(csv).toContain('\t+447700900123')

    for (const dangerous of ['=SUM(A1)', '-2+3', '@import', '+1']) {
      expect(toCsv(['X'], [[dangerous]])).toContain(`\t${dangerous}`)
    }
  })

  it('does not prefix a value that merely contains an equals sign', () => {
    expect(toCsv(['X'], [['a=b']])).toBe(`${BOM}X\r\na=b\r\n`)
  })

  it('handles an empty row set, leaving just the header', () => {
    expect(toCsv(['Email', 'Name'], [])).toBe(`${BOM}Email,Name\r\n`)
  })

  it('produces the customer export shape with opt-in included', () => {
    const csv = toCsv(
      ['Email', 'Name', 'Phone', 'Total bookings', 'Last visit', 'Marketing opt-in', 'Opt-in given at'],
      [['ayla@example.com', 'Ayla Demir', '+447700900123', 3, '2026-07-20', 'Yes', '2026-05-01T12:00:00Z']]
    )
    const lines = csv.replace(BOM, '').trim().split('\r\n')
    expect(lines[0]).toBe(
      'Email,Name,Phone,Total bookings,Last visit,Marketing opt-in,Opt-in given at'
    )
    expect(lines[1]).toContain('Yes')
    expect(lines[1]).toContain('2026-05-01T12:00:00Z')
  })
})
