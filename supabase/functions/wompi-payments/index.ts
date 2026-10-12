// wompi-payments — Supabase Edge Function (Deno)
//
// Instant card payments for job credits (migration 045). Three calls:
//   { action: 'config' }                       → { enabled } (any caller)
//   { action: 'checkout', companyId, packageId } → { url } (signed-in employer;
//        the order is created as that user, so the database checks ownership)
//   Wompi event (transaction.updated, signed)  → credits added via
//        apply_card_payment, only after the event signature checks out
//
// Deploy with JWT verification OFF (Wompi's server calls the events URL with
// no Supabase token):
//   supabase functions deploy wompi-payments --no-verify-jwt --project-ref <ref>
// Secrets (Wompi dashboard → Developers):
//   WOMPI_PUBLIC_KEY        pub_prod_...
//   WOMPI_INTEGRITY_SECRET  prod_integrity_...
//   WOMPI_EVENTS_SECRET     prod_events_...
//   optional SITE_URL (default https://impulsatalentos.expert)
// Wompi dashboard → Events URL:
//   https://<ref>.supabase.co/functions/v1/wompi-payments
// Card checkout stays hidden until all three secrets are set and a plan has a
// peso price (billing_packages.amount_cop_cents).

import { checkoutUrl, integritySignature, verifyEvent, type WompiEvent } from './wompi.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PUBLIC_KEY = Deno.env.get('WOMPI_PUBLIC_KEY') ?? ''
const INTEGRITY = Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? ''
const EVENTS = Deno.env.get('WOMPI_EVENTS_SECRET') ?? ''
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://impulsatalentos.expert').replace(/\/+$/, '')
const ENABLED = !!(PUBLIC_KEY && INTEGRITY && EVENTS)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function rpc(fn: string, args: Record<string, unknown>, auth: string, apikey: string): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey, Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }

  // ── Wompi event ──────────────────────────────────────────────────────────
  if (typeof body.event === 'string') {
    const ev = body as WompiEvent
    if (!ENABLED) return json({ error: 'card payments are not configured' }, 503)
    if (!(await verifyEvent(ev, EVENTS))) return json({ error: 'bad signature' }, 401)
    const tx = ev.data?.transaction
    if (ev.event !== 'transaction.updated' || !tx?.reference) return json({ ignored: ev.event })
    const res = await rpc('apply_card_payment', {
      p_reference: tx.reference, p_status: tx.status ?? '', p_transaction_id: tx.id ?? '',
      p_amount_in_cents: tx.amount_in_cents ?? 0, p_currency: tx.currency ?? '',
    }, `Bearer ${SERVICE_KEY}`, SERVICE_KEY)
    if (!res.ok) return json({ error: `could not apply payment (${res.status})` }, 500)
    return json({ result: await res.json() })
  }

  // ── App calls ────────────────────────────────────────────────────────────
  if (body.action === 'config') return json({ enabled: ENABLED })

  if (body.action === 'checkout') {
    if (!ENABLED) return json({ error: 'card payments are not configured' }, 503)
    const auth = req.headers.get('authorization') ?? ''
    if (!/^Bearer\s+\S+/i.test(auth)) return json({ error: 'sign in first' }, 401)
    const companyId = String(body.companyId ?? ''), packageId = String(body.packageId ?? '')
    // Created AS the signed-in user: the database checks they can pay for this company.
    const res = await rpc('start_card_payment', { p_company_id: companyId, p_package_id: packageId }, auth, ANON_KEY)
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { message?: string }
      return json({ error: err.message ?? `could not start payment (${res.status})` }, res.status === 401 ? 401 : 400)
    }
    const [order] = (await res.json()) as { reference: string; amount_in_cents: number; currency: string }[]
    if (!order) return json({ error: 'could not start payment' }, 400)
    const signature = await integritySignature(order.reference, Number(order.amount_in_cents), order.currency, INTEGRITY)
    const url = checkoutUrl({
      publicKey: PUBLIC_KEY, reference: order.reference, amountInCents: Number(order.amount_in_cents),
      currency: order.currency, signature, redirectUrl: `${SITE_URL}/pricing?payment=${encodeURIComponent(order.reference)}`,
    })
    return json({ url, reference: order.reference })
  }

  return json({ error: 'unknown action' }, 400)
})
