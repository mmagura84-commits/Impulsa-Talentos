// send-email — Supabase Edge Function (Deno)
//
// Durable transactional-email dispatcher for Impulsa Talentos (owner item 3).
// Drains public.email_outbox (migration 030) and sends each row through Resend.
//
// ── Modes ────────────────────────────────────────────────────────────────────
//   POST /functions/v1/send-email
//     Authorization: Bearer <EMAIL_FN_SECRET>
//     { "drain": true }            → batch-drain pending outbox rows (via pg_cron)
//     { "event": { ... } }         → direct send (MVP pg_net path, no cron)
//
// ── Secrets (Supabase → Edge Functions → Secrets) ───────────────────────────
//   RESEND_API_KEY   (required)  — https://api.resend.com/emails
//   EMAIL_ENABLED    (required)  — "true"/"false" kill-switch; default false
//   ADMIN_EMAIL      (owner)     — admin_new_user / admin_new_job recipient
//   SENDER_EMAIL     (owner)     — from-address; default notifications@impulsatalentos.expert
//   EMAIL_FN_SECRET  (team)      — invocation auth (see Authorization above)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//                   (standard)   — for reading context + notify_user() fallback
//
// ── Behavior ────────────────────────────────────────────────────────────────
//   • EN/ES templates (pt falls back to es). HTML+plain text.
//   • Retry ≤3 with backoff (30s/2m/10m) tracked by attempts/last_error/status.
//   • Per-recipient 24h cap (refuse >5 sends in 24h; mark excess skipped).
//   • On final failure: insert an in-app notification via notify_user().
//   • Fire-and-forget per batch; each row is guarded, never throws the batch.
//
// ── Deploy (requires Supabase CLI + project access token — OWNER/PAT) ──────
//   supabase login && supabase link --project-ref cmdqlybsgkegolqydmbh
//   supabase functions deploy send-email
//   # set secrets in dashboard → Edge Functions → secrets
//   # schedule drain: SELECT cron.schedule('email-drain','* * * * *',
//   #   $$ select net.http_post(url, headers=>jsonb_build_object(...)) $$);
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ENABLED = (Deno.env.get('EMAIL_ENABLED') ?? 'false') === 'true'
const ADMIN_EMAIL = Deno.env.get('ADMIN_EMAIL') ?? ''
const SENDER_EMAIL =
  Deno.env.get('SENDER_EMAIL') ?? 'Impulsa Talentos <notifications@impulsatalentos.expert>'
const FN_SECRET = Deno.env.get('EMAIL_FN_SECRET') ?? ''

const RESEND_API = 'https://api.resend.com/emails'
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [30_000, 120_000, 600_000]
const DAILY_CAP = 5

// ── Templates ───────────────────────────────────────────────────────────────
// Locale: 'en' | 'es' (pt → es fallback; Colombia-first per business plan).
function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

interface TemplateMsg { subject: string; preview: string; html: string; text: string }

function wrap(title: string, preview: string, innerHtml: string, locale: string): TemplateMsg {
  const sig = locale === 'es'
    ? 'Atentamente,<br/>El equipo de Impulsa Talentos'
    : 'Best regards,<br/>The Impulsa Talentos team'
  return {
    subject: title,
    preview,
    html: `<!doctype html><html><body style="margin:0;font-family:system-ui,Arial,sans-serif;background:#f4f5f7;padding:24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;text-align:left">
      <tr><td style="background:#1d4ed8;padding:20px 28px;"><span style="color:#fff;font-weight:700;font-size:18px;">Impulsa Talentos</span></td></tr>
      <tr><td style="padding:28px;">${innerHtml}<p style="margin-top:24px;color:#6b7280;font-size:13px;">${sig}</p></td></tr>
      </table></td></tr></table></body></html>`,
    text: innerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }
}

function renderCandidateConfirm(p: Record<string, unknown>, locale: string): TemplateMsg {
  const job = String(p.jobTitle ?? '')
  return wrap(
    locale === 'es'
      ? `Recibimos tu postulación — Impulsa Talentos`
      : `We received your application — Impulsa Talentos`,
    '',
    locale === 'es'
      ? `<h2 style="margin:0 0 12px;">¡Postulación recibida!</h2><p>Gracias por postularte a <strong>${esc(job)}</strong>. Tu solicitud ya está en la cola del empleador. Generalmente responden en 3–5 días hábiles.</p>`
      : `<h2 style="margin:0 0 12px;">Application received!</h2><p>Thanks for applying to <strong>${esc(job)}</strong>. Your application is now in the employer's queue. They typically respond within 3–5 business days.</p>`,
    locale,
  )
}

function renderEmployerAlert(p: Record<string, unknown>, locale: string): TemplateMsg {
  const title = String(p.jobTitle ?? 'the job')
  const name = String(p.candidateName ?? 'a candidate')
  return wrap(
    locale === 'es' ? `Nuevo candidato para ${title}` : `New candidate for ${title}`,
    '',
    locale === 'es'
      ? `<h2 style="margin:0 0 12px;">Nuevo candidato</h2><p><strong>${esc(name)}</strong> se postuló a <strong>${esc(title)}</strong>. Revisa el pipeline en tu panel de Impulsa Talentos.</p>`
      : `<h2 style="margin:0 0 12px;">New candidate</h2><p><strong>${esc(name)}</strong> applied to <strong>${esc(title)}</strong>. Review the pipeline in your Impulsa Talentos dashboard.</p>`,
    locale,
  )
}

function renderAdminNewUser(p: Record<string, unknown>, locale: string): TemplateMsg {
  const role = String(p.role ?? 'user')
  return wrap(
    `New user on Impulsa Talentos`,
    '',
    `<p>A new <strong>${esc(role)}</strong> registered on Impulsa Talentos. (Profile id: ${esc(p.profileId)})</p>`,
    locale,
  )
}

function renderAdminNewJob(p: Record<string, unknown>, locale: string): TemplateMsg {
  const title = String(p.title ?? 'a job')
  const company = String(p.companyName ?? '')
  return wrap(
    `New job published — ${title}${company ? ` at ${company}` : ''}`,
    '',
    `<p>A new job has been published on Impulsa Talentos: <strong>${esc(title)}</strong>${company ? ` at ${esc(company)}` : ''}.</p>`,
    locale,
  )
}

function render(p: Record<string, unknown>, locale: string): TemplateMsg {
  switch (p.kind) {
    case 'candidate_confirm': return renderCandidateConfirm(p, locale)
    case 'employer_alert': return renderEmployerAlert(p, locale)
    case 'admin_new_user': return renderAdminNewUser(p, locale)
    case 'admin_new_job': return renderAdminNewJob(p, locale)
    default:
      throw new Error(`Unknown email kind: ${String(p.kind)}`)
  }
}

// ── Supabase helpers (service role) ─────────────────────────────────────────
async function supabaseJson(path: string, init: RequestInit = {}, method = 'GET'): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    method,
    headers: {
      'apikey': SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    },
  })
  const text = await res.text()
  let body: unknown = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { ok: res.ok, status: res.status, body } as never
}

// Resolve context fields from payload ids at send time (fresh data, short-lived
// resume URLs are never stored in the queue).
async function enrich(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...p }
  if (p.kind === 'candidate_confirm' || p.kind === 'employer_alert') {
    if (p.jobId) {
      const j = (await supabaseJson(`/rest/v1/jobs?select=id,title&id=eq.${p.jobId}`)) as any
      if (j?.body?.[0]?.title) out.jobTitle = j.body[0].title
    }
    if (p.kind === 'employer_alert' && p.candidateId) {
      const c = (await supabaseJson(`/rest/v1/profiles?select=full_name&id=eq.${p.candidateId}`)) as any
      if (c?.body?.[0]?.full_name) out.candidateName = c.body[0].full_name
    }
  }
  return out
}

// In-app fallback: notify_user(recipientUserId, type, title, body).
async function inAppFallback(p: Record<string, unknown>, errorMsg: string): Promise<void> {
  try {
    if (!p.userId) return
    const { error } = (await supabaseJson('/rest/v1/rpc/notify_user', {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: String(p.userId), p_type: 'email_failed', p_title: 'Email notification failed',
        p_body: `Could not send email: ${errorMsg}`,
      }),
    }, 'POST')) as any
    if (error) console.warn('notify_user fallback failed', error)
  } catch (e) {
    console.warn('in-app fallback failed', e)
  }
}

async function sendOne(email: {
  to: string, subject: string, html: string, text: string,
  payload: Record<string, unknown>,
}, source: { kind: string; recipient: string; recipientRole?: string }): Promise<void> {
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: SENDER_EMAIL, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`)
  }
}

async function drain(): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!RESEND_KEY) {
    console.error('[send-email] RESEND_API_KEY missing — cannot drain')
    return { sent: 0, failed: 0, skipped: 0 }
  }
  if (!ENABLED) {
    console.log('[send-email] EMAIL_ENABLED=false — draining skipped (rows stay pending)')
    return { sent: 0, failed: 0, skipped: 0 }
  }
  // For admin events (recipient null), recipient is ADMIN_EMAIL (owner-provided).
  const pending = (await supabaseJson(
    `/rest/v1/email_outbox?select=id,event_type,recipient,payload,locale,status,attempts,created_at&status=eq.pending&order=created_at.asc&limit=20`,
  )) as any
  const rows = pending?.body ?? []
  if (!Array.isArray(rows) || rows.length === 0) return { sent: 0, failed: 0, skipped: 0 }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  let sent = 0, failed = 0, skipped = 0
  for (const row of rows) {
    const recipient = row.recipient || ADMIN_EMAIL
    if (!recipient) { skipped++; continue }

    // Per-recipient 24h cap (excluding this row).
    const countRes = (await supabaseJson(
      `/rest/v1/email_outbox?select=id&recipient=eq.${recipient}&status=eq.sent&created_at=gte.${since}`,
    )) as any
    const sentCount = Array.isArray(countRes?.body) ? countRes.body.length : 0
    if (sentCount >= DAILY_CAP) {
      await supabaseJson(`/rest/v1/email_outbox?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'skipped', last_error: `exceeded ${DAILY_CAP}/24h cap` }),
      }, 'PATCH')
      skipped++
      continue
    }

    // Mark sending (in-progress) to avoid double-drain of overlapping cron runs.
    await supabaseJson(`/rest/v1/email_outbox?id=eq.${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'sending' }),
    }, 'PATCH')

    try {
      const payload = await enrich(row.payload ?? {})
      const msg = render(payload, (row.locale ?? 'es') === 'en' ? 'en' : 'es')
      await sendOne({ to: recipient, subject: msg.subject, html: msg.html, text: msg.text, payload }, row)
      await supabaseJson(`/rest/v1/email_outbox?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }),
      }, 'PATCH')
      sent++
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      const attempts = (row.attempts ?? 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        await supabaseJson(`/rest/v1/email_outbox?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', attempts, last_error: errMsg }),
        }, 'PATCH')
        await inAppFallback(row.payload ?? {}, errMsg)
        failed++
      } else {
        await supabaseJson(`/rest/v1/email_outbox?id=eq.${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'pending', attempts }),
        }, 'PATCH')
        failed++ // counted as not-sent this pass; retried on a later cron run
      }
    }
  }
  return { sent, failed, skipped }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Auth: EMAIL_FN_SECRET bearer (cron/pg_net), or Supabase role key (admin/test).
  const auth = req.headers.get('Authorization') ?? ''
  const bearer = auth.replace(/^Bearer\s+/i, '')
  if (FN_SECRET && bearer === FN_SECRET) {
    // ok — internal invocation
  } else if (auth && SERVICE_ROLE && bearer === SERVICE_ROLE) {
    // ok — service-role (admin/testing)
  } else {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const result = await drain()
    return new Response(JSON.stringify({ ok: true, ...result, enabled: ENABLED }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
