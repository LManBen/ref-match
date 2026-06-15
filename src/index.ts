import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { openDb } from './store/db.js'
import { RefMatchService } from './service.js'
import { buildTools } from './mcp/server.js'
import { fetchOdooCredentials } from './connectors/directus.js'
import { OdooConnector } from './connectors/odoo.js'
import { ShopifyConnector } from './connectors/shopify.js'
import { ReflexConnector } from './connectors/reflex.js'

async function main() {
  const cfg = loadConfig()
  const db = openDb(cfg.dbPath)
  const odooCreds = await fetchOdooCredentials(cfg.directus)
  const svc = new RefMatchService(db, [
    new OdooConnector(odooCreds),
    new ShopifyConnector(cfg.shopify),
    new ReflexConnector(cfg.reflex),
  ])
  const tools = buildTools(svc, db)

  const server = new McpServer({ name: 'ref-match', version: '0.1.0' })
  for (const [name, t] of Object.entries(tools)) {
    server.tool(
      name,
      t.description,
      (t.schema as any).shape ?? {},
      async (args: any) => {
        const out = await t.handler(args)
        return { content: [{ type: 'text' as const, text: JSON.stringify(out, null, 2) }] }
      },
    )
  }
  await server.connect(new StdioServerTransport())
}

main().catch((e) => { console.error(e); process.exit(1) })
