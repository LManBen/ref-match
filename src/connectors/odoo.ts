import { fetchJson, type FetchOpts } from './http.js'
import { toNormalizedItem } from '../core/normalize.js'
import type { Connector, NormalizedItem } from './types.js'
import type { OdooCredentials } from './directus.js'

interface OdooRow { default_code: string | false; barcode: string | false; name?: string }

export class OdooConnector implements Connector {
  readonly system = 'odoo' as const
  constructor(private creds: OdooCredentials, private opts: FetchOpts = {}) {}

  async fetchAll(): Promise<NormalizedItem[]> {
    const rows = await this.searchRead()
    const items: NormalizedItem[] = []
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
    return items
  }

  // JSON-RPC call to Odoo's object/execute_kw -> product.product search_read.
  private async searchRead(): Promise<OdooRow[]> {
    const payload = {
      jsonrpc: '2.0', method: 'call',
      params: {
        service: 'object', method: 'execute_kw',
        args: [this.creds.db, /* uid resolved server-side via api key */ this.creds.username, this.creds.apiKey,
          'product.product', 'search_read', [[]],
          { fields: ['default_code', 'barcode', 'name'] }],
      },
    }
    const body = await fetchJson<{ result: OdooRow[] }>(
      `${this.creds.url}/jsonrpc`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      this.opts,
    )
    return body.result ?? []
  }
}
