import { fetchJson, type FetchOpts } from './http.js'
import { toNormalizedItem } from '../core/normalize.js'
import type { Connector, NormalizedItem } from './types.js'
import type { OdooCredentials } from './directus.js'

interface OdooRow { default_code: string | false; barcode: string | false; name?: string }

export class OdooConnector implements Connector {
  readonly system = 'odoo' as const
  constructor(
    private creds: OdooCredentials,
    private opts: FetchOpts = {},
    private pageSize = 1000,
  ) {}

  async fetchAll(): Promise<NormalizedItem[]> {
    const uid = await this.authenticate()
    const items: NormalizedItem[] = []
    let offset = 0
    for (;;) {
      const rows = await this.searchRead(uid, offset, this.pageSize)
      for (const r of rows) {
        const it = toNormalizedItem(
          'odoo',
          r.default_code === false ? null : r.default_code,
          r.barcode === false ? null : r.barcode,
          r,
          r.name,
        )
        if (it) items.push(it)
      }
      if (rows.length < this.pageSize) break
      offset += this.pageSize
    }
    return items
  }

  private async call(service: string, method: string, args: unknown[]): Promise<unknown> {
    const payload = { jsonrpc: '2.0', method: 'call', params: { service, method, args } }
    const body = await fetchJson<{ result?: unknown; error?: unknown }>(
      `${this.creds.url}/jsonrpc`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      this.opts,
    )
    if (body.error) throw new Error(`Odoo JSON-RPC error: ${JSON.stringify(body.error).slice(0, 200)}`)
    return body.result
  }

  private async authenticate(): Promise<number> {
    const uid = await this.call('common', 'authenticate', [this.creds.db, this.creds.login, this.creds.password, {}])
    if (typeof uid !== 'number' || uid <= 0) {
      throw new Error(`Authentification Odoo échouée pour ${this.creds.login}@${this.creds.db}`)
    }
    return uid
  }

  private async searchRead(uid: number, offset: number, limit: number): Promise<OdooRow[]> {
    const result = await this.call('object', 'execute_kw', [
      this.creds.db, uid, this.creds.password,
      'product.product', 'search_read', [[]],
      { fields: ['default_code', 'barcode', 'name'], offset, limit },
    ])
    return (result as OdooRow[]) ?? []
  }
}
