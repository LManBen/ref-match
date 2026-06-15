import { z } from 'zod'
import type { Db } from '../store/db.js'
import type { RefMatchService } from '../service.js'
import { summary, listByStatus, lookup } from '../store/results.js'
import { snapshotFreshness } from '../store/snapshots.js'
import { SYSTEMS } from '../connectors/types.js'

const StatusEnum = z.enum(['OK', 'ECART_CAB', 'CAB_MANQUANT', 'SKU_ABSENT'])

function requireRun(svc: RefMatchService): number {
  const id = svc.latestRunId()
  if (id == null) throw new Error('Aucune réconciliation disponible — lancez refmatch_run d\'abord.')
  return id
}

export function buildTools(svc: RefMatchService, db: Db) {
  return {
    refmatch_refresh: {
      description: 'Fetch live data from the systems into snapshots.',
      schema: z.object({ systems: z.array(z.enum(SYSTEMS as [string, ...string[]])).optional() }),
      handler: async (a: { systems?: any }) => ({ sources: await svc.refresh(a.systems) }),
    },
    refmatch_reconcile: {
      description: 'Reconcile the latest snapshots into a result run.',
      schema: z.object({}),
      handler: async () => await svc.reconcile(),
    },
    refmatch_run: {
      description: 'Refresh all systems then reconcile.',
      schema: z.object({ systems: z.array(z.enum(SYSTEMS as [string, ...string[]])).optional() }),
      handler: async (a: { systems?: any }) => {
        const sources = await svc.refresh(a.systems)
        const run = await svc.reconcile()
        return { sources, ...run }
      },
    },
    refmatch_summary: {
      description: 'Counts per status + snapshot freshness for the latest run.',
      schema: z.object({}),
      handler: async () => ({ ...summary(db, requireRun(svc)), freshness: snapshotFreshness(db) }),
    },
    refmatch_list: {
      description: 'List reconciliation results filtered by status (paginated).',
      schema: z.object({ status: StatusEnum, limit: z.number().int().positive().max(500).default(50), offset: z.number().int().min(0).default(0) }),
      handler: async (a: { status: any; limit?: number; offset?: number }) =>
        listByStatus(db, requireRun(svc), a.status, a.limit ?? 50, a.offset ?? 0),
    },
    refmatch_lookup: {
      description: 'Detail for one SKU across systems, with the proposal.',
      schema: z.object({ sku: z.string().min(1) }),
      handler: async (a: { sku: string }) => lookup(db, requireRun(svc), a.sku),
    },
  }
}
