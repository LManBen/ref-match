import { z } from 'zod'

const Schema = z.object({
  DIRECTUS_PROD_URL: z.string().url(),
  DIRECTUS_PROD_TOKEN: z.string().min(1),
  RFX_API_SERVER_URL: z.string().url(),
  REFLEX_USER: z.string().min(1),
  REFLEX_PASSWORD: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().optional().default('2024-10'),
  REFMATCH_DB_PATH: z.string().optional(),
  REFMATCH_REFLEX_CONCURRENCY: z.coerce.number().int().positive().default(8),
})

export interface Config {
  directus: { url: string; token: string }
  reflex: { apiUrl: string; user: string; password: string; concurrency: number }
  shopify: { apiVersion: string }
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
    directus: { url: e.DIRECTUS_PROD_URL, token: e.DIRECTUS_PROD_TOKEN },
    reflex: {
      apiUrl: e.RFX_API_SERVER_URL,
      user: e.REFLEX_USER,
      password: e.REFLEX_PASSWORD,
      concurrency: e.REFMATCH_REFLEX_CONCURRENCY,
    },
    shopify: { apiVersion: e.SHOPIFY_API_VERSION },
    dbPath: e.REFMATCH_DB_PATH ?? 'ref-match.sqlite',
  }
}
