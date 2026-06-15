import { describe, it, expect, vi } from 'vitest'
import { fetchOdooCredentials } from '../src/connectors/directus.js'

describe('fetchOdooCredentials', () => {
  it('maps a Directus item to OdooCredentials', async () => {
    const fn = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ data: [{ url: 'https://odoo', db: 'mydb', username: 'u', api_key: 'k' }] }),
    })
    const creds = await fetchOdooCredentials(
      { url: 'https://directus', token: 't' },
      { fetchImpl: fn as any },
    )
    expect(creds).toEqual({ url: 'https://odoo', db: 'mydb', username: 'u', apiKey: 'k' })
  })
})
