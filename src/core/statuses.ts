import type { System } from '../connectors/types.js'

export type Status = 'OK' | 'ECART_CAB' | 'CAB_MANQUANT' | 'SKU_ABSENT'

/** Per-system view of one SKU. cab null = present but no barcode. */
export interface PerSystem {
  present: boolean
  cab: string | null
}

export interface ReconResult {
  sku: string
  status: Status
  perSystem: Record<System, PerSystem>
  majorityCab: string | null          // most frequent non-null cab, null if none
  proposal: string | null             // human-readable suggestion, null if OK
  warnings: string[]                  // e.g. 'DUPLICATE_SKU:odoo'
}
