import { describe, it, expect, vi } from 'vitest'
import { fetchJson } from '../src/connectors/http.js'

describe('fetchJson', () => {
  it('retries on 429 then succeeds', async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, headers: new Map(), text: async () => 'rate' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: 1 }) })
    const out = await fetchJson('http://x', {}, { fetchImpl: fn as any, retries: 2, baseDelayMs: 0 })
    expect(out).toEqual({ ok: 1 })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries on 500', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Map(), text: async () => 'boom' })
    await expect(fetchJson('http://x', {}, { fetchImpl: fn as any, retries: 1, baseDelayMs: 0 }))
      .rejects.toThrow(/500/)
  })
})
