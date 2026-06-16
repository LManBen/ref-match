import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { RefMatchService } from '../src/service.js'
import type { Connector, NormalizedItem } from '../src/connectors/types.js'

const conn = (system: any, items: NormalizedItem[], fail = false): Connector => ({
  system, fetchAll: async () => { if (fail) throw new Error('down'); return items },
})
const item = (system: any, sku: string, cab: string | null): NormalizedItem => ({ system, sku, cab, raw: {} })
const deps = (resolved: any, conns: Connector[]) => ({
  directus: { url: 'd', token: 't' },
  reflex: { apiUrl: 'r', user: 'u', password: 'p', concurrency: 4 },
  shopify: { apiVersion: '2024-10' },
  resolve: async () => resolved,
  buildConnectors: () => conns,
}) as any

describe('RefMatchService', () => {
  it('refreshes configured systems then reconciles (full activity)', async () => {
    const db = openDb(':memory:')
    const resolved = { activityId: 213, trigram: 'MOM', depotCode: 'EZ1', name: 'M', odoo: {}, shopify: {}, reflexEnabled: true }
    const svc = new RefMatchService(db, deps(resolved, [conn('odoo', [item('odoo', 'A', '1')]), conn('shopify', [item('shopify', 'A', '1')]), conn('reflex', [item('reflex', 'A', '1')])]))
    const r = await svc.refresh(213)
    expect(r.every((x) => x.ok)).toBe(true)
    const run = await svc.reconcile(213)
    expect(run.partial).toBe(false)
    expect(run.summary.counts.OK).toBe(1)
    expect(svc.latestRunId(213)).toBe(run.runId)
  })

  it('a 2-system activity is NOT partial', async () => {
    const db = openDb(':memory:')
    const resolved = { activityId: 125, trigram: 'TKF', depotCode: 'TK1', name: 'T', odoo: {}, shopify: undefined, reflexEnabled: true }
    const svc = new RefMatchService(db, deps(resolved, [conn('odoo', [item('odoo', 'A', '1')]), conn('reflex', [item('reflex', 'A', '1')])]))
    await svc.refresh(125)
    const run = await svc.reconcile(125)
    expect(run.partial).toBe(false)
    expect(run.summary.counts.OK).toBe(1)
  })

  it('flags partial when a configured connector fails', async () => {
    const db = openDb(':memory:')
    const resolved = { activityId: 213, trigram: 'MOM', depotCode: 'EZ1', name: 'M', odoo: {}, shopify: {}, reflexEnabled: true }
    const svc = new RefMatchService(db, deps(resolved, [conn('odoo', [item('odoo', 'A', '1')]), conn('shopify', [], true), conn('reflex', [item('reflex', 'A', '1')])]))
    const r = await svc.refresh(213)
    expect(r.find((x) => x.system === 'shopify')!.ok).toBe(false)
    const run = await svc.reconcile(213)
    expect(run.partial).toBe(true)
    expect(run.summary.counts.OK).toBe(1)
  })
})
