import { z } from 'zod'

const Schema = z.object({
  SHOPIFY_STORE_URL: z.string().url(),
  SHOPIFY_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().min(1),
  RFX_API_SERVER_URL: z.string().url(),
  RFX_AUTH_SERVER_URL: z.string().url(),
  RFX_API_CLIENT_ID: z.string().min(1),
  RFX_API_CLIENT_SECRET: z.string().min(1),
  DIRECTUS_PROD_URL: z.string().url(),
  DIRECTUS_PROD_TOKEN: z.string().min(1),
  REFMATCH_DB_PATH: z.string().optional(),
})

export interface Config {
  shopify: { storeUrl: string; token: string; apiVersion: string }
  reflex: { apiUrl: string; authUrl: string; clientId: string; clientSecret: string }
  directus: { url: string; token: string }
  dbPath: string
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = Schema.safeParse(env)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Configuration invalide — variables manquantes/incorrectes : ${missing}`)
  }
  const e = parsed.data
  return {
    shopify: { storeUrl: e.SHOPIFY_STORE_URL, token: e.SHOPIFY_ACCESS_TOKEN, apiVersion: e.SHOPIFY_API_VERSION },
    reflex: { apiUrl: e.RFX_API_SERVER_URL, authUrl: e.RFX_AUTH_SERVER_URL, clientId: e.RFX_API_CLIENT_ID, clientSecret: e.RFX_API_CLIENT_SECRET },
    directus: { url: e.DIRECTUS_PROD_URL, token: e.DIRECTUS_PROD_TOKEN },
    dbPath: e.REFMATCH_DB_PATH ?? 'ref-match.sqlite',
  }
}
