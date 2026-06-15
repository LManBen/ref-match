import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { RefMatchService } from '../src/service.js'
import { buildTools } from '../src/mcp/server.js'
import type { Connector } from '../src/connectors/types.js'

const fake = (system: any, cab: string): Connector => ({
  system, fetchAll: async () => [{ system, sku: 'A', cab, raw: {} }],
})

describe('mcp tools', () => {
  it('run -> summary -> list -> lookup', async () => {
    const db = openDb(':memory:')
    const svc = new RefMatchService(db, [fake('odoo', '1'), fake('shopify', '2'), fake('reflex', '1')])
    const tools = buildTools(svc, db)

    await tools.refmatch_run.handler({})
    const summary = await tools.refmatch_summary.handler({})
    expect(summary.counts.ECART_CAB).toBe(1)

    const list = await tools.refmatch_list.handler({ status: 'ECART_CAB', limit: 10 })
    expect(list.items[0].sku).toBe('A')

    const lk = await tools.refmatch_lookup.handler({ sku: 'A' })
    expect(lk!.majorityCab).toBe('1')
  })
})
