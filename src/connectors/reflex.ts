import { fetchJson, type FetchOpts } from './http.js'
import { toNormalizedItem } from '../core/normalize.js'
import type { Connector, NormalizedItem } from './types.js'

const UVC_LV_CODE = '10'
const EAN_TYPES = new Set(['EAN12', 'EAN13', 'EAN14'])

export interface ReflexConfig { apiUrl: string; user: string; password: string }

interface ListResp { status?: string; data?: { items_list?: Array<{ item_code?: string }> }; next_key?: string | null }
interface LvId { logistical_variant_ID_type_code?: string; logistical_variant_ID_code?: string }
interface Lv { logistical_variant_code?: string; id_list?: LvId[] }
interface ReadResp { item_list?: Array<{ item_code?: string; logistical_variant_list?: Lv[] }> }

export class ReflexConnector implements Connector {
  readonly system = 'reflex' as const
  private token: string | null = null

  constructor(
    private cfg: ReflexConfig,
    private activityCode: string,
    private opts: FetchOpts = {},
    private concurrency = 8,
  ) {}

  async fetchAll(): Promise<NormalizedItem[]> {
    await this.authenticate()
    const skus = await this.listSkus()
    const items: NormalizedItem[] = []
    let idx = 0
    const worker = async (): Promise<void> => {
      while (idx < skus.length) {
        const sku = skus[idx++]!
        // A single READ_ITM failure (e.g. transient error on one item) must not abort
        // the whole catalog fetch — degrade that SKU to a missing CAB instead.
        let cab: string | null = null
        try {
          cab = await this.readBarcode(sku)
        } catch {
          cab = null
        }
        const it = toNormalizedItem('reflex', sku, cab, { item_code: sku })
        if (it) items.push(it)
      }
    }
    const n = Math.max(1, Math.min(this.concurrency, skus.length || 1))
    await Promise.all(Array.from({ length: n }, () => worker()))
    return items
  }

  private async authenticate(): Promise<void> {
    const f = this.opts.fetchImpl ?? fetch
    const url = `${this.cfg.apiUrl}/reflexWS/JWTServlet?login=${encodeURIComponent(this.cfg.user)}&password=${encodeURIComponent(this.cfg.password)}`
    const res = await f(url, { headers: { Accept: 'text/plain' } })
    if (!res.ok) throw new Error(`Reflex JWTServlet auth failed: HTTP ${res.status}`)
    this.token = (await res.text()).trim()
    if (!this.token) throw new Error('Reflex JWTServlet returned an empty token')
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `JWT ${this.token}`, Accept: 'application/json' }
  }

  private async listSkus(): Promise<string[]> {
    const skus: string[] = []
    let nextKey: string | null = null
    for (;;) {
      const q = new URLSearchParams({ activity_code: this.activityCode })
      if (nextKey) q.set('next_key', nextKey)
      const body = await fetchJson<ListResp>(
        `${this.cfg.apiUrl}/reflexWS/rest/public/v1/items?${q.toString()}`,
        { headers: this.authHeaders() }, this.opts,
      )
      for (const it of body.data?.items_list ?? []) if (it.item_code) skus.push(it.item_code)
      nextKey = body.next_key && body.next_key.length ? body.next_key : null
      if (!nextKey) break
    }
    return skus
  }

  private async readBarcode(sku: string): Promise<string | null> {
    const body = await fetchJson<ReadResp>(
      `${this.cfg.apiUrl}/reflexWS/rest/public/v1/activities/${encodeURIComponent(this.activityCode)}/items/${encodeURIComponent(sku)}`,
      { headers: this.authHeaders() }, this.opts,
    )
    const item = body.item_list?.[0]
    const uvc = item?.logistical_variant_list?.find((lv) => lv.logistical_variant_code === UVC_LV_CODE)
    const ids = uvc?.id_list ?? []
    if (!ids.length) return null
    const ean = ids.find((x) => x.logistical_variant_ID_type_code && EAN_TYPES.has(x.logistical_variant_ID_type_code) && x.logistical_variant_ID_code)
    const fallback = [...ids].reverse().find((x) => x.logistical_variant_ID_code)
    return (ean ?? fallback)?.logistical_variant_ID_code ?? null
  }
}
