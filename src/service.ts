import type { Db } from './store/db.js'
import { replaceSnapshot, readSnapshot, snapshotFreshness } from './store/snapshots.js'
import { saveRun, summary as readSummary, latestRunId } from './store/results.js'
import { reconcile } from './core/reconcile.js'
import { SYSTEMS, type Connector, type NormalizedItem, type System } from './connectors/types.js'
import {
  resolveActivity, listActivities,
  type DirectusClient, type ResolvedActivity, type ActivitySummary,
} from './connectors/directus.js'
import { OdooConnector } from './connectors/odoo.js'
import { ShopifyConnector } from './connectors/shopify.js'
import { ReflexConnector } from './connectors/reflex.js'
import type { FetchOpts } from './connectors/http.js'

export interface ServiceDeps {
  directus: DirectusClient
  reflex: { apiUrl: string; user: string; password: string; concurrency: number }
  shopify: { apiVersion: string }
  fetchOpts?: FetchOpts
  // test injection points:
  resolve?: (d: DirectusClient, id: number, opts?: FetchOpts) => Promise<ResolvedActivity>
  buildConnectors?: (r: ResolvedActivity) => Connector[]
  listActivitiesImpl?: (d: DirectusClient, opts?: FetchOpts) => Promise<ActivitySummary[]>
}

export interface RefreshResult { system: System; ok: boolean; count: number; error?: string }

export class RefMatchService {
  constructor(private db: Db, private deps: ServiceDeps) {}

  private buildConnectors(r: ResolvedActivity): Connector[] {
    if (this.deps.buildConnectors) return this.deps.buildConnectors(r)
    const conns: Connector[] = []
    if (r.odoo) conns.push(new OdooConnector(r.odoo, this.deps.fetchOpts))
    if (r.shopify) {
      conns.push(new ShopifyConnector(
        { storeUrl: r.shopify.url, token: r.shopify.token, apiVersion: this.deps.shopify.apiVersion },
        this.deps.fetchOpts,
      ))
    }
    if (r.reflexEnabled) {
      conns.push(new ReflexConnector(this.deps.reflex, r.trigram, this.deps.fetchOpts, this.deps.reflex.concurrency))
    }
    return conns
  }

  private configuredSystems(r: ResolvedActivity): System[] {
    const set: System[] = []
    if (r.odoo) set.push('odoo')
    if (r.shopify) set.push('shopify')
    if (r.reflexEnabled) set.push('reflex')
    return set
  }

  async refresh(activityId: number, only?: System[]): Promise<RefreshResult[]> {
    const resolve = this.deps.resolve ?? resolveActivity
    const r = await resolve(this.deps.directus, activityId, this.deps.fetchOpts)
    const activity = String(activityId)
    const connectors = this.buildConnectors(r).filter((c) => !only || only.includes(c.system))
    const results: RefreshResult[] = []
    for (const c of connectors) {
      try {
        const items = await c.fetchAll()
        replaceSnapshot(this.db, activity, c.system, items)
        results.push({ system: c.system, ok: true, count: items.length })
      } catch (e) {
        results.push({ system: c.system, ok: false, count: 0, error: (e as Error).message })
      }
    }
    return results
  }

  async reconcile(activityId: number) {
    const resolve = this.deps.resolve ?? resolveActivity
    const r = await resolve(this.deps.directus, activityId, this.deps.fetchOpts)
    const activity = String(activityId)
    const configured = this.configuredSystems(r)
    const fresh = snapshotFreshness(this.db, activity)
    const liveSystems = SYSTEMS.filter((s) => fresh[s])
    const partial = configured.some((s) => !fresh[s])
    const items: NormalizedItem[] = liveSystems.flatMap((s) => readSnapshot(this.db, activity, s))
    const results = reconcile(items, liveSystems)
    const runId = saveRun(this.db, { activity, sources: liveSystems, partial }, results)
    return { runId, activity, partial, configured, summary: readSummary(this.db, runId) }
  }

  latestRunId(activityId: number): number | null {
    return latestRunId(this.db, String(activityId))
  }

  async listActivities(): Promise<ActivitySummary[]> {
    const impl = this.deps.listActivitiesImpl ?? listActivities
    return impl(this.deps.directus, this.deps.fetchOpts)
  }
}
