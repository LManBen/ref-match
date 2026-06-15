import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { RefMatchService } from '../src/service.js'
import type { Connector, NormalizedItem } from '../src/connectors/types.js'

const fake = (system: any, items: NormalizedItem[], fail = false): Connector => ({
  system,
  fetchAll: async () => { if (fail) throw new Error('down'); return items },
})

describe('RefMatchService', () => {
  it('refreshes all sources then reconciles', async () => {
    const db = openDb(':memory:')
    const svc = new RefMatchService(db, [
      fake('odoo', [{ system: 'odoo', sku: 'A', cab: '1', raw: {} }]),
      fake('shopify', [{ system: 'shopify', sku: 'A', cab: '1', raw: {} }]),
      fake('reflex', [{ system: 'reflex', sku: 'A', cab: '1', raw: {} }]),
    ])
    const r = await svc.refresh()
    expect(r.find((x) => x.system === 'odoo')!.ok).toBe(true)
    const run = await svc.reconcile()
    expect(run.partial).toBe(false)
    expect(run.summary.counts.OK).toBe(1)
  })

  it('isolates a failing connector and marks the run partial', async () => {
    const db = openDb(':memory:')
    const svc = new RefMatchService(db, [
      fake('odoo', [{ system: 'odoo', sku: 'A', cab: '1', raw: {} }]),
      fake('shopify', [], true),
      fake('reflex', [{ system: 'reflex', sku: 'A', cab: '1', raw: {} }]),
    ])
    const r = await svc.refresh()
    expect(r.find((x) => x.system === 'shopify')!.ok).toBe(false)
    const run = await svc.reconcile()
    expect(run.partial).toBe(true)
    expect(run.summary.counts.OK).toBe(1)
  })
})
