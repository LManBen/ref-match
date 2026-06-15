import { fetchJson, type FetchOpts } from './http.js'
import { toNormalizedItem } from '../core/normalize.js'
import type { Connector, NormalizedItem } from './types.js'

interface VariantNode { sku: string | null; barcode: string | null; displayName?: string }
interface Page { data: { productVariants: { edges: Array<{ node: VariantNode }>; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } }

const QUERY = `query($cursor: String) {
  productVariants(first: 250, after: $cursor) {
    edges { node { sku barcode displayName } }
    pageInfo { hasNextPage endCursor }
  }
}`

export class ShopifyConnector implements Connector {
  readonly system = 'shopify' as const
  constructor(
    private cfg: { storeUrl: string; token: string; apiVersion: string },
    private opts: FetchOpts = {},
  ) {}

  async fetchAll(): Promise<NormalizedItem[]> {
    const url = `${this.cfg.storeUrl}/admin/api/${this.cfg.apiVersion}/graphql.json`
    const items: NormalizedItem[] = []
    let cursor: string | null = null
    do {
      const page: Page = await fetchJson<Page>(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': this.cfg.token },
          body: JSON.stringify({ query: QUERY, variables: { cursor } }),
        },
        this.opts,
      )
      const conn = page.data.productVariants
      for (const e of conn.edges) {
        const it = toNormalizedItem('shopify', e.node.sku, e.node.barcode, e.node, e.node.displayName)
        if (it) items.push(it)
      }
      cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null
    } while (cursor)
    return items
  }
}
