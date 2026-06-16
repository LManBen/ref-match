import { describe, it, expect, vi } from 'vitest'
import { OdooConnector } from '../src/connectors/odoo.js'

const creds = { url: 'https://odoo', db: 'app', login: 'l', password: 'p', version: '18' }

describe('OdooConnector', () => {
  it('authenticates then search_reads, mapping rows and dropping no-SKU', async () => {
    const fn = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body)
      if (body.params.method === 'authenticate') return { ok: true, status: 200, json: async () => ({ result: 7 }) }
      return { ok: true, status: 200, json: async () => ({ result: [
        { default_code: 'A1', barcode: '3400111', name: 'A' },
        { default_code: ' b2 ', barcode: false, name: 'B' },
        { default_code: false, barcode: '999', name: 'no sku' },
      ] }) }
    })
    const c = new OdooConnector(creds, { fetchImpl: fn as any })
    const items = await c.fetchAll()
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ system: 'odoo', sku: 'A1', cab: '3400111' })
    expect(items[1]).toMatchObject({ sku: 'B2', cab: null })
    const execCall = fn.mock.calls.find((c: any) => JSON.parse(c[1].body).params.method === 'execute_kw')
    const args = JSON.parse(execCall![1].body).params.args
    expect(args[0]).toBe('app')  // db
    expect(args[1]).toBe(7)      // uid
  })

  it('paginates by offset until a short page', async () => {
    const pages = [
      [{ default_code: 'P1', barcode: '1' }, { default_code: 'P2', barcode: '2' }],
      [{ default_code: 'P3', barcode: '3' }],
    ]
    let p = 0
    const fn = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body)
      if (body.params.method === 'authenticate') return { ok: true, status: 200, json: async () => ({ result: 1 }) }
      const page = pages[p++] ?? []
      return { ok: true, status: 200, json: async () => ({ result: page }) }
    })
    const c = new OdooConnector(creds, { fetchImpl: fn as any }, 2)
    const items = await c.fetchAll()
    expect(items.map((i) => i.sku)).toEqual(['P1', 'P2', 'P3'])
  })

  it('throws on JSON-RPC error', async () => {
    const fn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ error: { message: 'bad' } }) }))
    const c = new OdooConnector(creds, { fetchImpl: fn as any })
    await expect(c.fetchAll()).rejects.toThrow(/Odoo/)
  })
})
