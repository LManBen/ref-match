import type { Db } from './db.js'
import type { ReconResult, Status } from '../core/statuses.js'

export interface RunMeta { sources: string[]; partial: boolean }

export function saveRun(db: Db, meta: RunMeta, results: ReconResult[]): number {
  const now = new Date().toISOString()
  let runId = 0
  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO run (started_at, finished_at, sources_json, partial) VALUES (?,?,?,?)')
      .run(now, now, JSON.stringify(meta.sources), meta.partial ? 1 : 0)
    runId = Number(info.lastInsertRowid)
    const ins = db.prepare(
      'INSERT INTO result (run_id, sku, status, per_system_json, majority_cab, proposal, warnings_json) VALUES (?,?,?,?,?,?,?)',
    )
    for (const r of results) {
      ins.run(runId, r.sku, r.status, JSON.stringify(r.perSystem), r.majorityCab, r.proposal, JSON.stringify(r.warnings))
    }
  })
  tx()
  return runId
}

export function latestRunId(db: Db): number | null {
  const row = db.prepare('SELECT id FROM run ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined
  return row ? row.id : null
}

export function summary(db: Db, runId: number) {
  const rows = db
    .prepare('SELECT status, COUNT(*) AS n FROM result WHERE run_id = ? GROUP BY status')
    .all(runId) as Array<{ status: Status; n: number }>
  const counts = { OK: 0, ECART_CAB: 0, CAB_MANQUANT: 0, SKU_ABSENT: 0 } as Record<Status, number>
  for (const r of rows) counts[r.status] = r.n
  const run = db.prepare('SELECT started_at, partial, sources_json FROM run WHERE id = ?').get(runId) as
    { started_at: string; partial: number; sources_json: string }
  return { runId, counts, partial: !!run.partial, sources: JSON.parse(run.sources_json), startedAt: run.started_at }
}

function rowToResult(r: any): ReconResult {
  return {
    sku: r.sku, status: r.status, perSystem: JSON.parse(r.per_system_json),
    majorityCab: r.majority_cab, proposal: r.proposal, warnings: JSON.parse(r.warnings_json),
  }
}

export function listByStatus(db: Db, runId: number, status: Status, limit: number, offset: number) {
  const items = db
    .prepare('SELECT * FROM result WHERE run_id = ? AND status = ? ORDER BY sku LIMIT ? OFFSET ?')
    .all(runId, status, limit, offset)
    .map(rowToResult)
  const total = (db.prepare('SELECT COUNT(*) AS n FROM result WHERE run_id = ? AND status = ?').get(runId, status) as { n: number }).n
  return { items, total, nextOffset: offset + items.length < total ? offset + items.length : null }
}

export function lookup(db: Db, runId: number, sku: string): ReconResult | null {
  const r = db.prepare('SELECT * FROM result WHERE run_id = ? AND sku = ?').get(runId, sku)
  return r ? rowToResult(r) : null
}
