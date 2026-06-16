import type { Db } from './db.js'
import type { NormalizedItem, System } from '../connectors/types.js'

export function replaceSnapshot(db: Db, activity: string, system: System, items: NormalizedItem[]): void {
  const now = new Date().toISOString()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM snapshot WHERE activity = ? AND system = ?').run(activity, system)
    const ins = db.prepare(
      'INSERT INTO snapshot (activity, system, sku, cab, name, raw_json, fetched_at) VALUES (?,?,?,?,?,?,?)',
    )
    for (const it of items) {
      ins.run(activity, system, it.sku, it.cab, it.name ?? null, JSON.stringify(it.raw ?? null), now)
    }
  })
  tx()
}

export function readSnapshot(db: Db, activity: string, system: System): NormalizedItem[] {
  const rows = db
    .prepare('SELECT system, sku, cab, name, raw_json FROM snapshot WHERE activity = ? AND system = ?')
    .all(activity, system) as Array<{ system: System; sku: string; cab: string | null; name: string | null; raw_json: string }>
  return rows.map((r) => ({
    system: r.system,
    sku: r.sku,
    cab: r.cab,
    name: r.name ?? undefined,
    raw: JSON.parse(r.raw_json),
  }))
}

export function snapshotFreshness(db: Db, activity: string): Record<string, string | null> {
  const rows = db
    .prepare('SELECT system, MAX(fetched_at) AS at FROM snapshot WHERE activity = ? GROUP BY system')
    .all(activity) as Array<{ system: string; at: string | null }>
  const out: Record<string, string | null> = {}
  for (const r of rows) out[r.system] = r.at
  return out
}
