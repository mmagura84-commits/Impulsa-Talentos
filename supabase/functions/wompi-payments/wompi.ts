// Pure helpers for the wompi-payments Edge Function (no Deno APIs, so they
// can be unit-tested with bun): checkout signing and event verification,
// following Wompi's documented formulas.

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Integrity signature for Web Checkout: SHA256(reference + amountInCents + currency + integritySecret). */
export function integritySignature(reference: string, amountInCents: number, currency: string, integritySecret: string): Promise<string> {
  return sha256Hex(`${reference}${amountInCents}${currency}${integritySecret}`)
}

export function checkoutUrl(o: { publicKey: string; reference: string; amountInCents: number; currency: string; signature: string; redirectUrl: string }): string {
  const q = new URLSearchParams({
    'public-key': o.publicKey,
    currency: o.currency,
    'amount-in-cents': String(o.amountInCents),
    reference: o.reference,
    'signature:integrity': o.signature,
    'redirect-url': o.redirectUrl,
  })
  return `https://checkout.wompi.co/p/?${q.toString()}`
}

export interface WompiEvent {
  event?: string
  data?: { transaction?: { id?: string; status?: string; reference?: string; amount_in_cents?: number; currency?: string } } & Record<string, unknown>
  signature?: { properties?: string[]; checksum?: string }
  timestamp?: number | string
}

function pick(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj)
}

/** Constant-time string compare. */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/**
 * Event checksum: SHA256(values of signature.properties read from `data`, in
 * order + timestamp + eventsSecret), compared with signature.checksum.
 */
export async function verifyEvent(ev: WompiEvent, eventsSecret: string): Promise<boolean> {
  const props = ev.signature?.properties
  const checksum = ev.signature?.checksum
  if (!eventsSecret || !Array.isArray(props) || !props.length || !checksum || ev.timestamp == null) return false
  const values = props.map(p => pick(ev.data, p))
  if (values.some(v => v === undefined || v === null)) return false
  const expected = await sha256Hex(values.map(String).join('') + String(ev.timestamp) + eventsSecret)
  return safeEqual(expected.toLowerCase(), String(checksum).toLowerCase())
}
