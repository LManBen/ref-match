import { fetchJson, type FetchOpts } from './http.js'
import type { System } from './types.js'

export interface OdooCredentials { url: string; db: string; login: string; password: string; version: string }
export interface ShopifyCredentials { url: string; token: string }
export interface DirectusClient { url: string; token: string }

export interface ResolvedActivity {
  activityId: number
  trigram: string
  depotCode: string | null
  name: string
  odoo?: OdooCredentials
  shopify?: ShopifyCredentials
  reflexEnabled: boolean
}

export interface ActivitySummary {
  activityId: number
  name: string
  trigram: string
  systems: System[]
}

function headers(d: DirectusClient): Record<string, string> {
  return { Authorization: `Bearer ${d.token}` }
}

async function readOne<T>(d: DirectusClient, collection: string, query: string, opts: FetchOpts): Promise<T | null> {
  const url = `${d.url}/items/${collection}?${query}`
  const body = await fetchJson<{ data: T[] }>(url, { headers: headers(d) }, opts)
  return body.data?.[0] ?? null
}

interface ActivityRow {
  id: number
  name: string
  Trigram: string
  active_in_reflex: boolean
  code_depot_physique_reflex: string | null
}

export async function resolveActivity(d: DirectusClient, activityId: number, opts: FetchOpts = {}): Promise<ResolvedActivity> {
  const actUrl = `${d.url}/items/activity/${activityId}?fields=id,name,Trigram,active_in_reflex,code_depot_physique_reflex`
  const actBody = await fetchJson<{ data: ActivityRow | null }>(actUrl, { headers: headers(d) }, opts)
  const act = actBody.data
  if (!act) throw new Error(`Activité Directus introuvable : ${activityId}`)

  const base = `filter[activity][_eq]=${activityId}&filter[active][_eq]=true&limit=1`
  const odooRow = await readOne<{ url: string; database: string; client_id: string; client_secret: string; version: string }>(
    d, 'configuration_odoo', `${base}&fields=url,database,client_id,client_secret,version`, opts,
  )
  const shopRow = await readOne<{ url: string; token: string }>(
    d, 'configuration_shopify', `${base}&fields=url,token`, opts,
  )
  const reflexRow = await readOne<{ id: number }>(
    d, 'configuration_reflex', `${base}&fields=id`, opts,
  )

  return {
    activityId: act.id,
    trigram: act.Trigram,
    depotCode: act.code_depot_physique_reflex ?? null,
    name: act.name,
    odoo: odooRow
      ? { url: odooRow.url, db: odooRow.database, login: odooRow.client_id, password: odooRow.client_secret, version: odooRow.version }
      : undefined,
    shopify: shopRow ? { url: shopRow.url, token: shopRow.token } : undefined,
    reflexEnabled: !!reflexRow,
  }
}

export async function listActivities(d: DirectusClient, opts: FetchOpts = {}): Promise<ActivitySummary[]> {
  const acts = await fetchJson<{ data: Array<{ id: number; name: string; Trigram: string }> }>(
    `${d.url}/items/activity?filter[active][_eq]=true&fields=id,name,Trigram&limit=-1`,
    { headers: headers(d) }, opts,
  )
  const idsOf = async (col: string): Promise<Set<number>> => {
    const b = await fetchJson<{ data: Array<{ activity: number }> }>(
      `${d.url}/items/${col}?filter[active][_eq]=true&fields=activity&limit=-1`,
      { headers: headers(d) }, opts,
    )
    return new Set((b.data ?? []).map((r) => r.activity))
  }
  const odoo = await idsOf('configuration_odoo')
  const shop = await idsOf('configuration_shopify')
  const reflex = await idsOf('configuration_reflex')

  const out: ActivitySummary[] = []
  for (const a of acts.data ?? []) {
    const systems: System[] = []
    if (odoo.has(a.id)) systems.push('odoo')
    if (shop.has(a.id)) systems.push('shopify')
    if (reflex.has(a.id)) systems.push('reflex')
    if (systems.length) out.push({ activityId: a.id, name: a.name, trigram: a.Trigram, systems })
  }
  return out
}
