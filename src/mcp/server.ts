import { z } from 'zod'
import type { Db } from '../store/db.js'
import type { RefMatchService } from '../service.js'
import { summary, listByStatus, lookup } from '../store/results.js'
import { snapshotFreshness } from '../store/snapshots.js'
import { SYSTEMS } from '../connectors/types.js'

const StatusEnum = z.enum(['OK', 'ECART_CAB', 'CAB_MANQUANT', 'SKU_ABSENT'])
const SystemEnum = z.enum(SYSTEMS as [string, ...string[]])
const Activity = z.number().int().positive()

function requireRun(svc: RefMatchService, activity: number): number {
  const id = svc.latestRunId(activity)
  if (id == null) throw new Error(`Aucune réconciliation pour l'activité ${activity} — lancez refmatch_run d'abord.`)
  return id
}

export function buildTools(svc: RefMatchService, db: Db) {
  return {
    refmatch_activities: {
      description: 'List candidate activities (id, name, trigram, configured systems).',
      schema: z.object({}),
      handler: async () => ({ activities: await svc.listActivities() }),
    },
    refmatch_refresh: {
      description: 'Fetch live data for an activity into snapshots.',
      schema: z.object({ activity: Activity, systems: z.array(SystemEnum).optional() }),
      handler: async (a: { activity: number; systems?: any }) => ({ sources: await svc.refresh(a.activity, a.systems) }),
    },
    refmatch_reconcile: {
      description: 'Reconcile the latest snapshots of an activity.',
      schema: z.object({ activity: Activity }),
      handler: async (a: { activity: number }) => await svc.reconcile(a.activity),
    },
    refmatch_run: {
      description: 'Refresh then reconcile an activity.',
      schema: z.object({ activity: Activity, systems: z.array(SystemEnum).optional() }),
      handler: async (a: { activity: number; systems?: any }) => {
        const sources = await svc.refresh(a.activity, a.systems)
        const run = await svc.reconcile(a.activity)
        return { sources, ...run }
      },
    },
    refmatch_summary: {
      description: 'Counts per status + snapshot freshness for an activity latest run.',
      schema: z.object({ activity: Activity }),
      handler: async (a: { activity: number }) => ({ ...summary(db, requireRun(svc, a.activity)), freshness: snapshotFreshness(db, String(a.activity)) }),
    },
    refmatch_list: {
      description: 'List reconciliation results filtered by status (paginated).',
      schema: z.object({ activity: Activity, status: StatusEnum, limit: z.number().int().positive().max(500).default(50), offset: z.number().int().min(0).default(0) }),
      handler: async (a: { activity: number; status: any; limit?: number; offset?: number }) =>
        listByStatus(db, requireRun(svc, a.activity), a.status, a.limit ?? 50, a.offset ?? 0),
    },
    refmatch_lookup: {
      description: 'Detail for one SKU in an activity latest run.',
      schema: z.object({ activity: Activity, sku: z.string().min(1) }),
      handler: async (a: { activity: number; sku: string }) => lookup(db, requireRun(svc, a.activity), a.sku),
    },
  }
}
