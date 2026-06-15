import { describe, it, expect } from 'vitest'
import { normalizeSku, normalizeCab } from '../src/core/normalize.js'

describe('normalizeSku', () => {
  it('trims, uppercases, collapses internal spaces', () => {
    expect(normalizeSku('  ab 12  ')).toBe('AB 12')
    expect(normalizeSku('a  b')).toBe('A B')
  })
  it('returns null for empty/whitespace', () => {
    expect(normalizeSku('   ')).toBeNull()
    expect(normalizeSku(null)).toBeNull()
  })
})

describe('normalizeCab', () => {
  it('trims and strips inner spaces, keeps leading zeros', () => {
    expect(normalizeCab(' 003 400 12 ')).toBe('00340012')
  })
  it('returns null for empty', () => {
    expect(normalizeCab('')).toBeNull()
    expect(normalizeCab(null)).toBeNull()
    expect(normalizeCab(undefined)).toBeNull()
  })
  it('keeps numeric EAN as string', () => {
    expect(normalizeCab(3400120000123)).toBe('3400120000123')
  })
})
