// CSV generation for the customer export.
//
// This export is the whole point of the project from the client's side — it is
// how they move off OpenTable owning their customer data. It has to open
// correctly in Excel first time, so: CRLF line endings, a UTF-8 BOM so accented
// names are not mangled, and proper quoting.

/**
 * Escapes one field.
 *
 * The leading apostrophe guard matters: a phone number like +447700900123 is
 * interpreted by Excel as a formula, and a field beginning =, +, - or @ is a
 * CSV injection vector. Prefixing a tab keeps the value readable while stopping
 * Excel evaluating it.
 */
function escapeField(value: unknown): string {
  if (value === null || value === undefined) return ''
  let str = String(value)

  if (/^[=+\-@\t\r]/.test(str)) str = `\t${str}`

  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeField).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','))
  }
  // BOM so Excel reads it as UTF-8 rather than the local codepage.
  return `﻿${lines.join('\r\n')}\r\n`
}
