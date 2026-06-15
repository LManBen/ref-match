import type { Db } from './store/db.js'
import { replaceSnapshot, readSnapshot, snapshotFreshness } from './store/snapshots.js'
import { saveRun, summary as readSummary, latestRunId } from './store/results.js'
import { reconcile } from './core/reconcile.js'
import { SYSTEMS, type Connector, type NormalizedItem, type System } from './connectors/types.js'

export interface RefreshResult { system: System; ok: boolean; count: number; error?: string }

export class RefMatchService {
  constructor(private db: Db, private connectors: Connector[]) {}

  async refresh(only?: System[]): Promise<RefreshResult[]> {
    const targets = this.connectors.filter((c) => !only || only.includes(c.system))
    const results: RefreshResult[] = []
    for (const c of targets) {
      try {
        const items = await c.fetchAll()
        replaceSnapshot(this.db, c.system, items)
        results.push({ system: c.system, ok: true, count: items.length })
      } catch (e) {
        results.push({ system: c.system, ok: false, count: 0, error: (e as Error).message })
      }
    }
    return results
  }

  async reconcile() {
    const fresh = snapshotFreshness(this.db)
    const liveSystems = SYSTEMS.filter((s) => fresh[s])
    const partial = liveSystems.length < SYSTEMS.length
    const items: NormalizedItem[] = liveSystems.flatMap((s) => readSnapshot(this.db, s))
    const results = reconcile(items, liveSystems)
    const runId = saveRun(this.db, { sources: liveSystems, partial }, results)
    return { runId, partial, summary: readSummary(this.db, runId) }
  }

  latestRunId() { return latestRunId(this.db) }
}
