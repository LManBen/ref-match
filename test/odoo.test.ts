import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { OdooConnector } from '../src/connectors/odoo.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/odoo-products.json', import.meta.url), 'utf8'))

describe('OdooConnector', () => {
  it('maps product.product rows to NormalizedItem and drops rows without SKU', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => fixture })
    const c = new OdooConnector(
      { url: 'https://odoo', db: 'd', username: 'u', apiKey: 'k' },
      { fetchImpl: fn as any },
    )
    const items = await c.fetchAll()
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ system: 'odoo', sku: 'A1', cab: '3400111' })
    expect(items[1]).toMatchObject({ sku: 'B2', cab: null })
  })
})
