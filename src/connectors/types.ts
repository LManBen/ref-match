export type System = 'odoo' | 'shopify' | 'reflex'

export const SYSTEMS: System[] = ['odoo', 'shopify', 'reflex']

/** One product line from one system, after normalization. */
export interface NormalizedItem {
  system: System
  sku: string                 // normalized, non-empty
  cab: string | null          // normalized barcode, null if absent
  name?: string
  raw: unknown                // original record, for traceability
}

export interface Connector {
  readonly system: System
  fetchAll(): Promise<NormalizedItem[]>
}
