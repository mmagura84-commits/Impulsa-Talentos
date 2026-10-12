/**
 * Read-only reads of public tables straight over Supabase's REST API with the
 * anon key (the same access a signed-out visitor has through supabase-js).
 *
 * Why: the home page only needs a few public columns, and fetching them this
 * way keeps the ~200 KB supabase-js client out of its start-up. Works during
 * prerendering (Node's fetch) and in the browser.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

/** `query` is a PostgREST query string, e.g. "select=id,name&order=created_at.desc". */
export async function publicSelect<T>(table: string, query: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`[public:${table}] HTTP ${res.status}`)
  const rows = (await res.json()) as Record<string, unknown>[]
  return rows.map((row) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v
    return out as T
  })
}
