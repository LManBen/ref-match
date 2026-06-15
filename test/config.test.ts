import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config.js'

const base = {
  SHOPIFY_STORE_URL: 'https://x.myshopify.com',
  SHOPIFY_ACCESS_TOKEN: 't',
  SHOPIFY_API_VERSION: '2024-10',
  RFX_API_SERVER_URL: 'https://rfx',
  RFX_AUTH_SERVER_URL: 'https://rfx-auth',
  RFX_API_CLIENT_ID: 'id',
  RFX_API_CLIENT_SECRET: 'secret',
  DIRECTUS_PROD_URL: 'https://directus',
  DIRECTUS_PROD_TOKEN: 'dt',
}

describe('loadConfig', () => {
  it('parses a valid env', () => {
    const cfg = loadConfig(base)
    expect(cfg.shopify.storeUrl).toBe('https://x.myshopify.com')
    expect(cfg.dbPath).toMatch(/\.sqlite$/)
  })
  it('throws a clear error when a required var is missing', () => {
    const { SHOPIFY_ACCESS_TOKEN, ...partial } = base
    expect(() => loadConfig(partial)).toThrow(/SHOPIFY_ACCESS_TOKEN/)
  })
})
