import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { RefMatchService } from '../src/service.js'
import { buildTools } from '../src/mcp/server.js'
import type { Connector } from '../src/connectors/types.js'

const conn = (system: any, cab: string): Connector => ({ system, fetchAll: async () => [{ system, sku: 'A', cab, raw: {} }] })
const resolved = { activityId: 213, trigram: 'MOM', depotCode: 'EZ1', name: 'M', odoo: {}, shopify: {}, reflexEnabled: true }
const deps = (conns: Connector[]) => ({
  directus: { url: 'd', token: 't' },
  reflex: { apiUrl: 'r', user: 'u', password: 'p', concurrency: 4 },
  shopify: { apiVersion: '2024-10' },
  resolve: async () => resolved,
  buildConnectors: () => conns,
  listActivitiesImpl: async () => [{ activityId: 213, name: 'M', trigram: 'MOM', systems: ['odoo', 'shopify', 'reflex'] }],
}) as any

describe('mcp tools', () => {
  it('run -> summary -> list -> lookup -> activities', async () => {
    const db = openDb(':memory:')
    const svc = new RefMatchService(db, deps([conn('odoo', '1'), conn('shopify', '2'), conn('reflex', '1')]))
    const tools = buildTools(svc, db)

    await tools.refmatch_run.handler({ activity: 213 })
    const s = await tools.refmatch_summary.handler({ activity: 213 })
    expect(s.counts.ECART_CAB).toBe(1)
    expect(s.freshness.odoo).toBeTruthy()

    const list = await tools.refmatch_list.handler({ activity: 213, status: 'ECART_CAB', limit: 10 })
    expect(list.items[0].sku).toBe('A')

    const lk = await tools.refmatch_lookup.handler({ activity: 213, sku: 'A' })
    expect(lk!.majorityCab).toBe('1')

    const acts = await tools.refmatch_activities.handler({})
    expect(acts.activities[0].trigram).toBe('MOM')
  })
})
