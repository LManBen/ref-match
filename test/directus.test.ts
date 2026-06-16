import { describe, it, expect, vi } from 'vitest'
import { resolveActivity, listActivities } from '../src/connectors/directus.js'

// route mock responses by URL substring
function router(map: Array<[RegExp, unknown]>) {
  return vi.fn(async (url: string) => {
    for (const [re, payload] of map) if (re.test(url)) return { ok: true, status: 200, json: async () => payload }
    throw new Error('unexpected url ' + url)
  })
}

const D = { url: 'https://directus', token: 't' }

describe('resolveActivity', () => {
  it('resolves an activity with odoo+shopify+reflex configured', async () => {
    const fn = router([
      [/items\/activity\/213/, { data: { id: 213, name: 'Moder Métier', Trigram: 'MOM', active_in_reflex: true, code_depot_physique_reflex: 'EZ1' } }],
      [/configuration_odoo/, { data: [{ url: 'https://mom.odoo', database: 'app', client_id: 'login@x', client_secret: 'pw', version: '18' }] }],
      [/configuration_shopify/, { data: [{ url: 'modernmetier.myshopify.com', token: 'shptok' }] }],
      [/configuration_reflex/, { data: [{ id: 46 }] }],
    ])
    const r = await resolveActivity(D, 213, { fetchImpl: fn as any })
    expect(r.trigram).toBe('MOM')
    expect(r.depotCode).toBe('EZ1')
    expect(r.odoo).toEqual({ url: 'https://mom.odoo', db: 'app', login: 'login@x', password: 'pw', version: '18' })
    expect(r.shopify).toEqual({ url: 'modernmetier.myshopify.com', token: 'shptok' })
    expect(r.reflexEnabled).toBe(true)
  })

  it('omits systems that are not configured', async () => {
    const fn = router([
      [/items\/activity\/125/, { data: { id: 125, name: 'Track-Lift', Trigram: 'TKF', active_in_reflex: true, code_depot_physique_reflex: 'TK1' } }],
      [/configuration_odoo/, { data: [{ url: 'https://tk.odoo', database: 'app', client_id: 'l', client_secret: 'p', version: '18' }] }],
      [/configuration_shopify/, { data: [] }],
      [/configuration_reflex/, { data: [{ id: 42 }] }],
    ])
    const r = await resolveActivity(D, 125, { fetchImpl: fn as any })
    expect(r.odoo).toBeDefined()
    expect(r.shopify).toBeUndefined()
    expect(r.reflexEnabled).toBe(true)
  })

  it('throws when the activity does not exist', async () => {
    const fn = router([[/items\/activity\/999/, { data: null }]])
    await expect(resolveActivity(D, 999, { fetchImpl: fn as any })).rejects.toThrow(/introuvable/)
  })
})

describe('listActivities', () => {
  it('returns active activities annotated with their configured systems', async () => {
    const fn = router([
      [/items\/activity\?/, { data: [{ id: 213, name: 'Moder Métier', Trigram: 'MOM' }, { id: 125, name: 'Track-Lift', Trigram: 'TKF' }, { id: 999, name: 'None', Trigram: 'NON' }] }],
      [/configuration_odoo/, { data: [{ activity: 213 }, { activity: 125 }] }],
      [/configuration_shopify/, { data: [{ activity: 213 }] }],
      [/configuration_reflex/, { data: [{ activity: 213 }, { activity: 125 }] }],
    ])
    const r = await listActivities(D, { fetchImpl: fn as any })
    expect(r.find((a) => a.activityId === 213)!.systems.sort()).toEqual(['odoo', 'reflex', 'shopify'])
    expect(r.find((a) => a.activityId === 125)!.systems.sort()).toEqual(['odoo', 'reflex'])
    expect(r.find((a) => a.activityId === 999)).toBeUndefined()
  })
})
