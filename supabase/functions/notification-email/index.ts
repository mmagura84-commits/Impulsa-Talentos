// notification-email — Supabase Edge Function (Deno)
//
// Emails a person whenever the database creates an in-app notification for
// them (migration 041 section 17 creates them for every hand-off: new
// applicant, status change, interview, offer, message, company verified,
// payment decided, HQ queue items).
//
// Why here and not in the app: the production site is static hosting, so the
// app's server-side email code never runs there. A Database Webhook calls
// this function on every INSERT into public.notifications instead.
//
// It can only email the owner of the notification (looked up by user_id with
// the service role) — callers cannot choose a recipient.
//
// ── Setup (see README.md next to this file) ────────────────────────────
//   supabase functions deploy notification-email --project-ref <ref>   (JWT verification ON)
//   supabase secrets set RESEND_API_KEY=... --project-ref <ref>
//   optional: SITE_URL (default https://impulsatalentos.expert)
//             EMAIL_FROM (default "Impulsa Talentos <partners@impulsatalentos.expert>")
//   Dashboard → Database → Webhooks → public.notifications INSERT →
//     this function, "Add auth header with service key"
//   (optional alternative: set WEBHOOK_SECRET and send it as x-webhook-secret)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { buildEmail, isApplicationUpdate, pickLang, type NotificationRow } from './templates.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://impulsatalentos.expert'
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Impulsa Talentos <partners@impulsatalentos.expert>'

interface WebhookPayload {
  type?: string
  table?: string
  schema?: string
  record?: NotificationRow
}

interface ProfileRow {
  email: string | null
  role: string | null
  preferred_language: string | null
  notification_prefs: Record<string, unknown> | null
  profile_status: string | null
  deletion_requested_at?: string | null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** Constant-time compare so the secret can't be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

/**
 * Who may call this: the Database Webhook. Two accepted proofs:
 *  - `x-webhook-secret` equal to WEBHOOK_SECRET (when that secret is set), or
 *  - the service-role bearer the dashboard webhook adds ("Add auth header with
 *    service key"). The function is deployed WITH JWT verification, so the
 *    gateway has already checked the signature; here we only require the
 *    service_role claim, which no browser ever holds.
 */
function isAuthorized(req: Request): boolean {
  if (WEBHOOK_SECRET) return safeEqual(req.headers.get('x-webhook-secret') ?? '', WEBHOOK_SECRET)
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const part = token.split('.')[1]
  if (!part) return false
  try {
    const claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return claims?.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!isAuthorized(req)) return json({ error: 'unauthorized' }, 401)
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'function is not configured (RESEND_API_KEY / service role)' }, 500)
  }

  let payload: WebhookPayload
  try {
    payload = (await req.json()) as WebhookPayload
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }
  const n = payload.record
  if (payload.table !== 'notifications' || payload.type !== 'INSERT' || !n?.user_id || !n.type) {
    return json({ skipped: 'not a notification insert' })
  }

  // Look up the recipient with the service role (bypasses RLS, server-side only).
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(n.user_id)}` +
      '&select=email,role,preferred_language,notification_prefs,profile_status,deletion_requested_at&limit=1',
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  )
  if (!profileRes.ok) return json({ error: `profile lookup failed (${profileRes.status})` }, 502)
  const [profile] = (await profileRes.json()) as ProfileRow[]
  if (!profile?.email) return json({ skipped: 'no email on profile' })
  if (profile.profile_status === 'anonymized' || profile.email.endsWith('@deleted.invalid')) {
    return json({ skipped: 'anonymized profile' })
  }
  // Respect the "application updates" switch on the profile page.
  if (isApplicationUpdate(n.type) && profile.notification_prefs?.applicationUpdates === false) {
    return json({ skipped: 'opted out of application updates' })
  }

  const email = buildEmail(n, pickLang(profile.preferred_language), profile.role ?? 'candidate', SITE_URL)
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // Webhook retries must not send the same email twice.
      'Idempotency-Key': `notification-${n.id}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [profile.email],
      subject: email.subject,
      html: email.html,
      text: email.text,
      tags: [{ name: 'notification_type', value: n.type.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 256) }],
    }),
  })
  if (!send.ok) {
    // Never echo the recipient address back into logs.
    return json({ error: `email provider refused (${send.status})` }, 502)
  }
  return json({ sent: true })
})
