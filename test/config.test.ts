import { describe, it, expect } from 'vitest'
import { loadConfig } from '../src/config.js'

const base = {
  DIRECTUS_PROD_URL: 'https://directus',
  DIRECTUS_PROD_TOKEN: 'dt',
  RFX_API_SERVER_URL: 'https://rfx',
  REFLEX_USER: 'u',
  REFLEX_PASSWORD: 'p',
}

describe('loadConfig', () => {
  it('parses a valid env with defaults', () => {
    const cfg = loadConfig(base)
    expect(cfg.directus.url).toBe('https://directus')
    expect(cfg.reflex.user).toBe('u')
    expect(cfg.reflex.concurrency).toBe(8)
    expect(cfg.shopify.apiVersion).toBe('2024-10')
    expect(cfg.dbPath).toMatch(/\.sqlite$/)
  })
  it('throws a clear error when a required var is missing', () => {
    const { REFLEX_USER, ...partial } = base
    expect(() => loadConfig(partial)).toThrow(/REFLEX_USER/)
  })
  it('coerces concurrency from string', () => {
    expect(loadConfig({ ...base, REFMATCH_REFLEX_CONCURRENCY: '4' }).reflex.concurrency).toBe(4)
  })
})
