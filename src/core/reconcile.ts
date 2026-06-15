import { SYSTEMS, type NormalizedItem, type System } from '../connectors/types.js'
import type { PerSystem, ReconResult, Status } from './statuses.js'

function majority(cabs: (string | null)[]): string | null {
  const counts = new Map<string, number>()
  for (const c of cabs) if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best: string | null = null
  let bestN = 0
  for (const [c, n] of counts) if (n > bestN) { best = c; bestN = n }
  return best
}

export function reconcile(items: NormalizedItem[]): ReconResult[] {
  // group by sku -> system -> items[]
  const bySku = new Map<string, Map<System, NormalizedItem[]>>()
  for (const it of items) {
    let m = bySku.get(it.sku)
    if (!m) { m = new Map(); bySku.set(it.sku, m) }
    const arr = m.get(it.system) ?? []
    arr.push(it)
    m.set(it.system, arr)
  }

  const results: ReconResult[] = []
  for (const [sku, m] of bySku) {
    const warnings: string[] = []
    const perSystem = {} as Record<System, PerSystem>
    for (const sys of SYSTEMS) {
      const arr = m.get(sys) ?? []
      if (arr.length > 1) warnings.push(`DUPLICATE_SKU:${sys}`)
      // On duplicate SKU within a system we keep the first row's cab (first-wins) and surface DUPLICATE_SKU as a warning to investigate.
      perSystem[sys] = arr.length
        ? { present: true, cab: arr[0]!.cab }
        : { present: false, cab: null }
    }

    const presentSystems = SYSTEMS.filter((s) => perSystem[s].present)
    const cabs = presentSystems.map((s) => perSystem[s].cab)
    const majorityCab = majority(cabs)

    let status: Status
    if (presentSystems.length < SYSTEMS.length) {
      status = 'SKU_ABSENT'
    } else if (cabs.some((c) => c === null)) {
      status = 'CAB_MANQUANT'
    } else if (new Set(cabs).size > 1) {
      status = 'ECART_CAB'
    } else {
      status = 'OK'
    }

    const proposal =
      status === 'OK'
        ? null
        : buildProposal(status, perSystem, majorityCab)

    results.push({ sku, status, perSystem, majorityCab, proposal, warnings })
  }

  results.sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0))
  return results
}

function buildProposal(
  status: Status,
  perSystem: Record<System, PerSystem>,
  majorityCab: string | null,
): string {
  if (status === 'SKU_ABSENT') {
    const missing = SYSTEMS.filter((s) => !perSystem[s].present)
    return `SKU absent de : ${missing.join(', ')} — vérifier la création de l'article.`
  }
  if (status === 'CAB_MANQUANT') {
    const missing = SYSTEMS.filter((s) => perSystem[s].present && perSystem[s].cab === null)
    const ref = majorityCab ? ` (valeur connue : ${majorityCab})` : ''
    return `CAB manquant dans : ${missing.join(', ')}${ref}.`
  }
  // ECART_CAB
  const off = SYSTEMS.filter((s) => perSystem[s].present && perSystem[s].cab !== majorityCab)
  return `Aligner ${off.join(', ')} sur la valeur majoritaire ${majorityCab} (à valider).`
}
