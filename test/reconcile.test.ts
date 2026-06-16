import { describe, it, expect } from 'vitest'
import { reconcile } from '../src/core/reconcile.js'
import type { NormalizedItem } from '../src/connectors/types.js'

const item = (system: any, sku: string, cab: string | null): NormalizedItem =>
  ({ system, sku, cab, raw: {} })

describe('reconcile', () => {
  it('marks OK when present in all 3 with identical non-null cab', () => {
    const r = reconcile([
      item('odoo', 'A', '111'), item('shopify', 'A', '111'), item('reflex', 'A', '111'),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]!.status).toBe('OK')
    expect(r[0]!.proposal).toBeNull()
  })

  it('marks ECART_CAB when cabs differ, proposes the majority value', () => {
    const r = reconcile([
      item('odoo', 'A', '111'), item('shopify', 'A', '222'), item('reflex', 'A', '111'),
    ])
    expect(r[0]!.status).toBe('ECART_CAB')
    expect(r[0]!.majorityCab).toBe('111')
    expect(r[0]!.proposal).toContain('111')
  })

  it('marks CAB_MANQUANT when present everywhere but one cab is null', () => {
    const r = reconcile([
      item('odoo', 'A', '111'), item('shopify', 'A', null), item('reflex', 'A', '111'),
    ])
    expect(r[0]!.status).toBe('CAB_MANQUANT')
  })

  it('marks SKU_ABSENT when missing from at least one system', () => {
    const r = reconcile([item('odoo', 'A', '111'), item('shopify', 'A', '111')])
    expect(r[0]!.status).toBe('SKU_ABSENT')
    expect(r[0]!.perSystem.reflex.present).toBe(false)
  })

  it('SKU_ABSENT takes precedence over a cab discrepancy', () => {
    const r = reconcile([item('odoo', 'A', '111'), item('shopify', 'A', '222')])
    expect(r[0]!.status).toBe('SKU_ABSENT')
  })

  it('flags DUPLICATE_SKU when a system has the SKU twice', () => {
    const r = reconcile([
      item('odoo', 'A', '111'), item('odoo', 'A', '999'),
      item('shopify', 'A', '111'), item('reflex', 'A', '111'),
    ])
    expect(r[0]!.warnings).toContain('DUPLICATE_SKU:odoo')
  })

  it('is deterministic: results sorted by sku', () => {
    const r = reconcile([item('odoo', 'B', '1'), item('odoo', 'A', '1')])
    expect(r.map((x) => x.sku)).toEqual(['A', 'B'])
  })

  it('marks CAB_MANQUANT with null majorityCab when present in all 3 but all cabs are null', () => {
    const r = reconcile([
      item('odoo', 'A', null), item('shopify', 'A', null), item('reflex', 'A', null),
    ])
    expect(r).toHaveLength(1)
    expect(r[0]!.status).toBe('CAB_MANQUANT')
    expect(r[0]!.majorityCab).toBeNull()
  })

  it('prefers ECART_CAB over CAB_MANQUANT when non-null cabs conflict and one is null', () => {
    const r = reconcile([
      { system: 'odoo', sku: 'A', cab: '111', raw: {} },
      { system: 'shopify', sku: 'A', cab: null, raw: {} },
      { system: 'reflex', sku: 'A', cab: '222', raw: {} },
    ])
    expect(r[0]!.status).toBe('ECART_CAB')
  })

  it('respects a restricted expected-systems list', () => {
    const r = reconcile([
      { system: 'odoo', sku: 'A', cab: '1', raw: {} },
      { system: 'reflex', sku: 'A', cab: '1', raw: {} },
    ], ['odoo', 'reflex'])
    expect(r[0]!.status).toBe('OK')
  })
})
