import { describe, it, expect, vi } from 'vitest'
import { ReflexConnector } from '../src/connectors/reflex.js'

function reflexMock() {
  return vi.fn(async (url: string) => {
    if (url.includes('/JWTServlet')) return { ok: true, status: 200, text: async () => 'tok\n' }
    if (url.includes('/public/v1/items')) {
      if (!url.includes('next_key=')) {
        return { ok: true, status: 200, json: async () => ({ status: 'SUCCESS', data: { items_list: [{ item_code: 'A1' }] }, next_key: 'K2' }) }
      }
      return { ok: true, status: 200, json: async () => ({ status: 'SUCCESS', data: { items_list: [{ item_code: 'B2' }] }, next_key: '' }) }
    }
    if (url.includes('/items/A1')) {
      return { ok: true, status: 200, json: async () => ({ item_list: [{ item_code: 'A1', logistical_variant_list: [
        { logistical_variant_code: '20', id_list: [{ logistical_variant_ID_type_code: 'EAN13', logistical_variant_ID_code: 'ZZZ' }] },
        { logistical_variant_code: '10', id_list: [
          { logistical_variant_ID_type_code: 'OTHER', logistical_variant_ID_code: 'X' },
          { logistical_variant_ID_type_code: 'EAN13', logistical_variant_ID_code: '3400111' },
        ] },
      ] }] }) }
    }
    if (url.includes('/items/B2')) {
      return { ok: true, status: 200, json: async () => ({ item_list: [{ item_code: 'B2', logistical_variant_list: [] }] }) }
    }
    throw new Error('unexpected ' + url)
  })
}

describe('ReflexConnector', () => {
  it('auths via JWTServlet, paginates by next_key, reads UVC EAN barcode per SKU', async () => {
    const fn = reflexMock()
    const c = new ReflexConnector({ apiUrl: 'https://rfx', user: 'u', password: 'p' }, 'MOM', { fetchImpl: fn as any }, 4)
    const items = await c.fetchAll()
    const bySku = Object.fromEntries(items.map((i) => [i.sku, i.cab]))
    expect(bySku).toEqual({ A1: '3400111', B2: null })
    const apiCall = fn.mock.calls.find((c: any) => String(c[0]).includes('/public/v1/items'))
    expect((apiCall![1] as any).headers.Authorization).toBe('JWT tok')
  })

  it('throws when JWTServlet returns an empty token', async () => {
    const fn = vi.fn(async (url: string) => {
      if (url.includes('/JWTServlet')) return { ok: true, status: 200, text: async () => '   ' }
      return { ok: true, status: 200, json: async () => ({}) }
    })
    const c = new ReflexConnector({ apiUrl: 'https://rfx', user: 'u', password: 'p' }, 'MOM', { fetchImpl: fn as any })
    await expect(c.fetchAll()).rejects.toThrow(/empty token/)
  })

  it('degrades a single failing READ_ITM to a null CAB without aborting the catalog', async () => {
    const fn = vi.fn(async (url: string) => {
      if (url.includes('/JWTServlet')) return { ok: true, status: 200, text: async () => 'tok' }
      if (url.includes('/public/v1/items')) {
        if (!url.includes('next_key=')) return { ok: true, status: 200, json: async () => ({ data: { items_list: [{ item_code: 'A1' }] }, next_key: 'K2' }) }
        return { ok: true, status: 200, json: async () => ({ data: { items_list: [{ item_code: 'B2' }] }, next_key: '' }) }
      }
      if (url.includes('/items/A1')) return { ok: false, status: 500, headers: new Map(), text: async () => 'boom' }
      if (url.includes('/items/B2')) return { ok: true, status: 200, json: async () => ({ item_list: [{ item_code: 'B2', logistical_variant_list: [{ logistical_variant_code: '10', id_list: [{ logistical_variant_ID_type_code: 'EAN13', logistical_variant_ID_code: '999' }] }] }] }) }
      throw new Error('unexpected ' + url)
    })
    // retries:0 so the 500 fails fast (no backoff wait) and is caught per-SKU
    const c = new ReflexConnector({ apiUrl: 'https://rfx', user: 'u', password: 'p' }, 'MOM', { fetchImpl: fn as any, retries: 0, baseDelayMs: 0 }, 1)
    const items = await c.fetchAll()
    const bySku = Object.fromEntries(items.map((i) => [i.sku, i.cab]))
    expect(bySku).toEqual({ A1: null, B2: '999' })
  })
})
