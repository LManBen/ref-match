# ref-match

MCP server reconciling the Odoo / Shopify / Reflex product referentials by **SKU**, verifying the
**CAB** (barcode/EAN). Read-only: it reports OK / discrepancies and proposes the majority value;
it never writes back. Kits are out of scope for V1 (see issue #1).

## Statuses
`OK` · `ECART_CAB` · `CAB_MANQUANT` · `SKU_ABSENT`

A SKU is reconciled across the systems that have a fresh snapshot. When a connector fails, its
system is excluded and the run is flagged **partial** (no false `SKU_ABSENT`).

## MCP tools
- `refmatch_refresh { systems? }` — fetch live data into snapshots (per-source success/failure).
- `refmatch_reconcile` — reconcile the latest snapshots into a result run.
- `refmatch_run { systems? }` — refresh then reconcile (shortcut).
- `refmatch_summary` — counts per status + snapshot freshness for the latest run.
- `refmatch_list { status, limit?, offset? }` — paginated list of results for a status.
- `refmatch_lookup { sku }` — detail for one SKU across systems, with the proposal.

## Setup
```bash
npm install
npm run build
node dist/index.js   # stdio MCP server
```

## Environment
Required: `SHOPIFY_STORE_URL`, `SHOPIFY_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`,
`RFX_API_SERVER_URL`, `RFX_AUTH_SERVER_URL`, `RFX_API_CLIENT_ID`, `RFX_API_CLIENT_SECRET`,
`DIRECTUS_PROD_URL`, `DIRECTUS_PROD_TOKEN`. Optional: `REFMATCH_DB_PATH` (default `ref-match.sqlite`).

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
