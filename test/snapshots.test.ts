import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { replaceSnapshot, readSnapshot } from '../src/store/snapshots.js'
import type { NormalizedItem } from '../src/connectors/types.js'

const items: NormalizedItem[] = [
  { system: 'odoo', sku: 'A', cab: '111', raw: {} },
  { system: 'odoo', sku: 'B', cab: null, raw: {} },
]

describe('snapshots', () => {
  it('replaces and reads back a system snapshot', () => {
    const db = openDb(':memory:')
    replaceSnapshot(db, 'odoo', items)
    const back = readSnapshot(db, 'odoo')
    expect(back).toHaveLength(2)
    expect(back.find((i) => i.sku === 'A')!.cab).toBe('111')
    expect(back.find((i) => i.sku === 'B')!.cab).toBeNull()
  })

  it('replace clears the previous snapshot for that system', () => {
    const db = openDb(':memory:')
    replaceSnapshot(db, 'odoo', items)
    replaceSnapshot(db, 'odoo', [{ system: 'odoo', sku: 'C', cab: '9', raw: {} }])
    const back = readSnapshot(db, 'odoo')
    expect(back.map((i) => i.sku)).toEqual(['C'])
  })
})
