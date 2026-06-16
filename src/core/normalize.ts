import type { NormalizedItem, System } from '../connectors/types.js'

export function normalizeSku(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const v = String(raw).trim().replace(/\s+/g, ' ').toUpperCase()
  return v.length ? v : null
}

export function normalizeCab(raw: string | number | null | undefined): string | null {
  if (raw == null) return null
  const v = String(raw).trim().replace(/\s+/g, '')
  return v.length ? v : null
}

/** Build a NormalizedItem; returns null when the SKU is unusable. */
export function toNormalizedItem(
  system: System,
  rawSku: string | null | undefined,
  rawCab: string | number | null | undefined,
  raw: unknown,
  name?: string,
): NormalizedItem | null {
  const sku = normalizeSku(rawSku)
  if (!sku) return null
  return { system, sku, cab: normalizeCab(rawCab), name, raw }
}
