import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { replaceSnapshot, readSnapshot } from '../src/store/snapshots.js'
import type { NormalizedItem } from '../src/connectors/types.js'

const items: NormalizedItem[] = [
  { system: 'odoo', sku: 'A', cab: '111', raw: {} },
  { system: 'odoo', sku: 'B', cab: null, raw: {} },
]

describe('snapshots', () => {
  it('replaces and reads back a system snapshot scoped by activity', () => {
    const db = openDb(':memory:')
    replaceSnapshot(db, '213', 'odoo', items)
    const back = readSnapshot(db, '213', 'odoo')
    expect(back).toHaveLength(2)
    expect(back.find((i) => i.sku === 'A')!.cab).toBe('111')
    expect(back.find((i) => i.sku === 'B')!.cab).toBeNull()
  })

  it('isolates snapshots between activities', () => {
    const db = openDb(':memory:')
    replaceSnapshot(db, '213', 'odoo', items)
    replaceSnapshot(db, '125', 'odoo', [{ system: 'odoo', sku: 'C', cab: '9', raw: {} }])
    expect(readSnapshot(db, '213', 'odoo').map((i) => i.sku).sort()).toEqual(['A', 'B'])
    expect(readSnapshot(db, '125', 'odoo').map((i) => i.sku)).toEqual(['C'])
  })

  it('replace clears the previous snapshot for that activity+system', () => {
    const db = openDb(':memory:')
    replaceSnapshot(db, '213', 'odoo', items)
    replaceSnapshot(db, '213', 'odoo', [{ system: 'odoo', sku: 'C', cab: '9', raw: {} }])
    expect(readSnapshot(db, '213', 'odoo').map((i) => i.sku)).toEqual(['C'])
  })
})
