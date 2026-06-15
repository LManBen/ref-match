export interface FetchOpts {
  fetchImpl?: typeof fetch
  retries?: number
  baseDelayMs?: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fetchJson<T = unknown>(
  url: string,
  init: RequestInit,
  opts: FetchOpts = {},
): Promise<T> {
  const f = opts.fetchImpl ?? fetch
  const retries = opts.retries ?? 3
  const base = opts.baseDelayMs ?? 500
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await f(url, init)
    if (res.ok) return (await res.json()) as T
    const retriable = res.status === 429 || res.status >= 500
    const body = await res.text().catch(() => '')
    lastErr = new Error(`HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`)
    if (!retriable || attempt === retries) throw lastErr
    await sleep(base * 2 ** attempt)
  }
  throw lastErr
}
