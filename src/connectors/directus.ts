import { fetchJson, type FetchOpts } from './http.js'

export interface OdooCredentials { url: string; db: string; username: string; apiKey: string }

// TODO at impl: replace 'odoo_credentials' + field names with the real Directus collection.
const COLLECTION = 'odoo_credentials'

export async function fetchOdooCredentials(
  directus: { url: string; token: string },
  opts: FetchOpts = {},
): Promise<OdooCredentials> {
  const url = `${directus.url}/items/${COLLECTION}?limit=1`
  const body = await fetchJson<{ data: Array<Record<string, string>> }>(
    url,
    { headers: { Authorization: `Bearer ${directus.token}` } },
    opts,
  )
  const row = body.data?.[0]
  if (!row) throw new Error(`Aucune ligne Odoo dans la collection Directus '${COLLECTION}'`)
  return { url: row.url!, db: row.db!, username: row.username!, apiKey: row.api_key! }
}
