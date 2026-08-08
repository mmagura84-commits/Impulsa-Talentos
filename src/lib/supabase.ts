import { createClient } from '@supabase/supabase-js'

/**
 * Supabase credentials are required at build time. Never silently fall back to
 * production: an unconfigured preview must not access another environment.
 */
const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey)
const supabaseUrl = configuredUrl || 'https://missing-supabase-config.invalid'
const supabaseAnonKey = configuredAnonKey || 'missing-supabase-anon-key'
if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.error('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/* ── snake_case ↔ camelCase mappers ───────────────────────────
   The DB schema uses snake_case columns (migration 001); the app
   types use camelCase. These helpers convert rows at the boundary
   so every hook keeps working with the existing TypeScript types. */

const toCamel = (s: string) =>
  s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())

const toSnake = (s: string) =>
  s.replace(/[A-Z]/g, (c: string) => `_${c.toLowerCase()}`)

/** Convert a snake_case DB row into a camelCase object (app type). */
export function snakeToCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v
  return out as T
}

/** Convert a camelCase object into a snake_case DB row (for insert/update). */
export function camelToSnake(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue
    out[toSnake(k)] = v
  }
  return out
}

/** Throw a readable error when a Supabase query fails. */
export function throwIfError(error: { message: string } | null, ctx: string): void {
  if (error) {
    throw new Error(`[supabase:${ctx}] ${error.message}`)
  }
}

/* ── Generic row helpers ─────────────────────────────────────
   Thin wrappers so hooks can do mechanical swaps like
   `blink.db.table('X').list(...)` → `listRows<X>('x', {...})`. */

type OrderBy = Record<string, 'asc' | 'desc'>

async function buildQuery(table: string, opts?: {
  where?: Record<string, unknown>
  orderBy?: OrderBy
  limit?: number
  offset?: number
}) {
  let q = supabase.from(table).select('*')
  if (opts?.where) {
    for (const [k, v] of Object.entries(opts.where)) q = q.eq(toSnake(k), v)
  }
  if (opts?.orderBy) {
    for (const [k, dir] of Object.entries(opts.orderBy)) {
      q = q.order(toSnake(k), { ascending: dir !== 'desc' })
    }
  }
  if (opts?.limit !== undefined && opts?.limit > 0) {
    q = q.limit(opts.limit)
  }
  if (opts?.offset !== undefined && opts?.offset > 0) {
    q = q.range(opts.offset, opts.offset + (opts.limit ?? 1000) - 1)
  }
  return q
}

/** SELECT rows → camelCase app objects. */
export async function listRows<T>(
  table: string,
  opts?: { where?: Record<string, unknown>; orderBy?: OrderBy; limit?: number; offset?: number },
): Promise<T[]> {
  const { data, error } = await buildQuery(table, opts)
  throwIfError(error, table)
  return (data ?? []).map(r => snakeToCamel<T>(r as Record<string, unknown>))
}

/** SELECT one row by id, or null. */
export async function getRow<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  throwIfError(error, table)
  return data ? snakeToCamel<T>(data as Record<string, unknown>) : null
}

/** INSERT a camelCase object → returns the created row. */
export async function createRow<T>(
  table: string,
  data: Record<string, unknown>,
): Promise<T> {
  const { data: row, error } = await supabase
    .from(table)
    .insert(camelToSnake(data))
    .select()
    .single()
  throwIfError(error, table)
  return snakeToCamel<T>(row as Record<string, unknown>)
}

/** UPDATE a row by id with a camelCase partial object. */
export async function updateRow(
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .update(camelToSnake(data))
    .eq('id', id)
  throwIfError(error, table)
}

/** DELETE a row by id. */
export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id)
  throwIfError(error, table)
}

/** COUNT rows (optionally filtered by equality conditions). */
export async function countRows(
  table: string,
  where?: Record<string, unknown>,
): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true })
  if (where) for (const [k, v] of Object.entries(where)) q = q.eq(toSnake(k), v)
  const { count, error } = await q
  throwIfError(error, table)
  return count ?? 0
}
