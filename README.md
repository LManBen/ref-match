# ref-match

MCP server reconciling the Odoo / Shopify / Reflex product referentials by **SKU**, verifying the
**CAB** (barcode/EAN). Read-only: it reports OK / discrepancies and proposes the majority value;
it never writes back. Kits are out of scope for V1 (see issue #1).

## Statuses
`OK` · `ECART_CAB` · `CAB_MANQUANT` · `SKU_ABSENT`

**Multi-tenant by `activity`** (Directus activity id). Each tool takes an `activity`. Odoo & Shopify
creds are read per-activity from Directus; Reflex is a single WMS (env creds) scoped by the activity
`Trigram`. A SKU is reconciled across the systems configured for that activity; if a configured
connector fails, it is excluded and the run is flagged **partial** (no false `SKU_ABSENT`). See
`docs/superpowers/specs/2026-06-16-ref-match-live-wiring.md`.

## MCP tools
- `refmatch_activities` — list candidate activities (id, name, trigram, configured systems).
- `refmatch_refresh { activity, systems? }` — fetch live data into snapshots (per-source result).
- `refmatch_reconcile { activity }` — reconcile the latest snapshots into a result run.
- `refmatch_run { activity, systems? }` — refresh then reconcile (shortcut).
- `refmatch_summary { activity }` — counts per status + snapshot freshness for the latest run.
- `refmatch_list { activity, status, limit?, offset? }` — paginated list of results for a status.
- `refmatch_lookup { activity, sku }` — detail for one SKU across systems, with the proposal.

## Setup
```bash
npm install
npm run build
node dist/index.js   # stdio MCP server
```

## Environment
Required: `DIRECTUS_PROD_URL`, `DIRECTUS_PROD_TOKEN`, `RFX_API_SERVER_URL`, `REFLEX_USER`,
`REFLEX_PASSWORD`. Optional: `SHOPIFY_API_VERSION` (default `2024-10`),
`REFMATCH_DB_PATH` (default `ref-match.sqlite`), `REFMATCH_REFLEX_CONCURRENCY` (default `8`).

Odoo & Shopify credentials are NOT in env — they are read per-activity from Directus
(`configuration_odoo` / `configuration_shopify`). Reflex authenticates via JWTServlet
(`REFLEX_USER` / `REFLEX_PASSWORD`); the OAuth `RFX_AUTH_*` / `RFX_API_CLIENT_*` vars are unused.

## Register in aisupacrew / Claude Code
```json
{ "mcpServers": { "ref-match": { "command": "node", "args": ["/workspace/repos/ref-match/dist/index.js"] } } }
```

## Tests
```bash
npm test          # vitest run
npm run typecheck
```

## Architecture
`connectors (live fetch) → SQLite snapshots → pure reconciliation engine → SQLite results → MCP tools`

See `docs/superpowers/specs/2026-06-15-ref-match-design.md` (spec) and
`docs/superpowers/plans/2026-06-15-ref-match.md` (implementation plan).

## Confirm-at-implementation (live wiring)
The connector request shapes are pinned by mocked tests; the live endpoints still need to be
confirmed against the real systems before production use:
- **Directus**: the collection + field names holding the Odoo credentials (`src/connectors/directus.ts`).
- **Odoo**: the JSON-RPC `execute_kw` auth/uid flow and that `product.product` fields
  `default_code` / `barcode` are correct (`src/connectors/odoo.ts`).
- **Shopify**: the Admin GraphQL `productVariants` query shape (`src/connectors/shopify.ts`).
- **Reflex**: the master "item" endpoint, field names, OAuth token endpoint and pagination
  (`src/connectors/reflex.ts`) — confirm via the `reflex-api-expert` skill.
