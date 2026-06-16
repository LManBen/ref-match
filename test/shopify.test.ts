import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ShopifyConnector } from '../src/connectors/shopify.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/shopify-variants.json', import.meta.url), 'utf8'))

describe('ShopifyConnector', () => {
  it('maps variant edges to NormalizedItem, empty barcode -> null', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => fixture })
    const c = new ShopifyConnector(
      { storeUrl: 'https://x.myshopify.com', token: 't', apiVersion: '2024-10' },
      { fetchImpl: fn as any },
    )
    const items = await c.fetchAll()
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ system: 'shopify', sku: 'A1', cab: '3400111' })
    expect(items[1]).toMatchObject({ sku: 'S2', cab: null })
  })

  it('prefixes https:// when the store URL has no scheme (Directus format)', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => fixture })
    const c = new ShopifyConnector(
      { storeUrl: 'modernmetier.myshopify.com', token: 't', apiVersion: '2024-10' },
      { fetchImpl: fn as any },
    )
    await c.fetchAll()
    expect(fn.mock.calls[0]![0]).toBe('https://modernmetier.myshopify.com/admin/api/2024-10/graphql.json')
  })
})
