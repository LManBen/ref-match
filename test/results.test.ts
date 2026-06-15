import { describe, it, expect } from 'vitest'
import { openDb } from '../src/store/db.js'
import { saveRun, latestRunId, summary, listByStatus, lookup } from '../src/store/results.js'
import type { ReconResult } from '../src/core/statuses.js'

const mk = (sku: string, status: any): ReconResult => ({
  sku, status,
  perSystem: { odoo: { present: true, cab: '1' }, shopify: { present: true, cab: '1' }, reflex: { present: true, cab: '1' } },
  majorityCab: '1', proposal: status === 'OK' ? null : 'fix', warnings: [],
})

describe('results store', () => {
  it('saves a run and reads summary + lists', () => {
    const db = openDb(':memory:')
    const runId = saveRun(db, { sources: ['odoo', 'shopify', 'reflex'], partial: false },
      [mk('A', 'OK'), mk('B', 'ECART_CAB'), mk('C', 'ECART_CAB')])
    expect(latestRunId(db)).toBe(runId)
    expect(summary(db, runId).counts.ECART_CAB).toBe(2)
    const page = listByStatus(db, runId, 'ECART_CAB', 10, 0)
    expect(page.items.map((r) => r.sku)).toEqual(['B', 'C'])
    expect(lookup(db, runId, 'A')!.status).toBe('OK')
    expect(lookup(db, runId, 'ZZZ')).toBeNull()
  })
})
