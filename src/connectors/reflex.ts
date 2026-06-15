import { fetchJson, type FetchOpts } from './http.js'
import { toNormalizedItem } from '../core/normalize.js'
import type { Connector, NormalizedItem } from './types.js'

interface ReflexItem { code: string | null; barcode: string | null; label?: string }

export class ReflexConnector implements Connector {
  readonly system = 'reflex' as const
  constructor(
    private cfg: { apiUrl: string; authUrl: string; clientId: string; clientSecret: string },
    private opts: FetchOpts = {},
  ) {}

  async fetchAll(): Promise<NormalizedItem[]> {
    const token = await this.authenticate()
    // NOTE: confirm exact path + pagination via reflex-api-expert.
    const body = await fetchJson<{ items: ReflexItem[]; total: number }>(
      `${this.cfg.apiUrl}/reflexWS/rest/item`,
      { headers: { Authorization: `Bearer ${token}` } },
      this.opts,
    )
    const out: NormalizedItem[] = []
    for (const r of body.items ?? []) {
      const it = toNormalizedItem('reflex', r.code, r.barcode, r, r.label)
      if (it) out.push(it)
    }
    return out
  }

  private async authenticate(): Promise<string> {
    const res = await fetchJson<{ access_token: string }>(
      `${this.cfg.authUrl}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
        }).toString(),
      },
      this.opts,
    )
    return res.access_token
  }
}
