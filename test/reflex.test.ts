import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ReflexConnector } from '../src/connectors/reflex.js'

const items = JSON.parse(readFileSync(new URL('./fixtures/reflex-items.json', import.meta.url), 'utf8'))

describe('ReflexConnector', () => {
  it('authenticates then maps items to NormalizedItem', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => items })
    const c = new ReflexConnector(
      { apiUrl: 'https://rfx', authUrl: 'https://rfx-auth', clientId: 'id', clientSecret: 'sec' },
      { fetchImpl: fn as any },
    )
    const out = await c.fetchAll()
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ system: 'reflex', sku: 'A1', cab: '3400111' })
    expect(out[1]).toMatchObject({ sku: 'R3', cab: null })
  })
})
