/**
 * Server-side guard for outgoing email (closes the open relay found in the
 * platform audit). Every send path calls `authorizeEmail` first.
 *
 * Rules
 *  - HQ inboxes (partners@ / jobs@ / info@impulsatalentos.expert) may receive
 *    platform notices from anyone (e.g. the public lead form), rate-limited.
 *  - Any other recipient requires a signed-in caller, and the recipient must
 *    be the caller themself or a person the caller can already see in the
 *    platform under row-level security (an employer's applicant, a teammate…).
 *  - Size limits on subject/body; at most one recipient.
 */
import { createClient } from '@supabase/supabase-js'

export const INTERNAL_RECIPIENTS = new Set([
  'partners@impulsatalentos.expert',
  'jobs@impulsatalentos.expert',
  'info@impulsatalentos.expert',
])

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30
const sendsByKey = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const recent = (sendsByKey.get(key) ?? []).filter(ts => now - ts < WINDOW_MS)
  recent.push(now)
  sendsByKey.set(key, recent)
  return recent.length > MAX_PER_WINDOW
}

function env(name: string): string | undefined {
  // Works under Node/Bun (process.env) and Vite's server build.
  return (typeof process !== 'undefined' ? process.env[name] : undefined) ??
    (import.meta as unknown as { env?: Record<string, string> }).env?.[name]
}

export interface EmailRequest {
  to: string
  subject: string
  html: string
  text?: string
}

export async function authorizeEmail(req: EmailRequest, accessToken?: string | null): Promise<void> {
  const to = String(req.to ?? '').trim().toLowerCase()
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) throw new Error('invalid recipient')
  if (String(req.subject ?? '').length > 200) throw new Error('subject too long')
  if (String(req.html ?? '').length > 50_000 || String(req.text ?? '').length > 50_000) throw new Error('message too long')

  if (INTERNAL_RECIPIENTS.has(to)) {
    if (rateLimited(`internal:${to}`)) throw new Error('rate limited')
    return
  }

  if (!accessToken) throw new Error('sign in required to email this recipient')
  const url = env('VITE_SUPABASE_URL') ?? env('SUPABASE_URL')
  const anon = env('VITE_SUPABASE_ANON_KEY') ?? env('SUPABASE_ANON_KEY')
  if (!url || !anon) throw new Error('email service not configured')

  const db = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await db.auth.getUser(accessToken)
  if (userErr || !userData?.user) throw new Error('invalid session')
  if (rateLimited(`user:${userData.user.id}`)) throw new Error('rate limited')
  if ((userData.user.email ?? '').toLowerCase() === to) return

  // Row-level security decides whether the caller may see this person.
  const { data: visible } = await db.from('profiles').select('id').ilike('email', to).limit(1)
  if (!visible || visible.length === 0) throw new Error('recipient not allowed')
}
