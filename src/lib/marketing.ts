export const UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'] as const
export type UTMKey = typeof UTM_KEYS[number]
/**
 * First-touch campaign attribution. The first visit that carries campaign tags
 * (utm_*, or a referral code ?ref=) wins for 30 days, on whatever page the
 * visitor landed. It travels with the sign-up (auth metadata `attribution`)
 * and lands on profiles.signup_attribution (migration 047), so HQ can see
 * which channel brought each candidate and whether they uploaded a CV.
 */
export interface Attribution extends Partial<Record<UTMKey, string>> {
  ref?: string
  landing?: string
  referrer?: string
  at?: string
}
const ATTR_KEY = 'impulsa_attribution'
const ATTR_TTL_MS = 30 * 24 * 60 * 60 * 1000
const clip = (v: string) => v.slice(0, 120)

export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  try {
    const a = JSON.parse(localStorage.getItem(ATTR_KEY) ?? '{}') as Attribution
    if (a.at && Date.now() - Date.parse(a.at) > ATTR_TTL_MS) return {}
    return a
  } catch { return {} }
}

export function captureUTMParams(): Attribution {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const tagged: Attribution = {}
  for (const key of UTM_KEYS) { const v = params.get(key); if (v) tagged[key] = clip(v) }
  const ref = params.get('ref'); if (ref) tagged.ref = clip(ref)
  if (Object.keys(tagged).length && !getAttribution().at) {
    let referrer: string | undefined
    try { referrer = document.referrer ? new URL(document.referrer).hostname : undefined } catch { referrer = undefined }
    const attribution: Attribution = { ...tagged, landing: clip(window.location.pathname), referrer, at: new Date().toISOString() }
    try { localStorage.setItem(ATTR_KEY, JSON.stringify(attribution)) } catch { /* storage unavailable */ }
  }
  return getAttribution()
}

/** Back-compat: the UTM part of the stored attribution. */
export function getUTMParams(): Partial<Record<UTMKey, string>> {
  const a = getAttribution(); const out: Partial<Record<UTMKey, string>> = {}
  for (const key of UTM_KEYS) if (a[key]) out[key] = a[key]
  return out
}
export function trackEvent(name: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const event = { name, data, timestamp: new Date().toISOString(), path: location.pathname }
  const key = 'impulsa_analytics'
  try { const events = JSON.parse(sessionStorage.getItem(key) ?? '[]'); events.push(event); sessionStorage.setItem(key, JSON.stringify(events.slice(-100))) } catch { /* storage unavailable */ }
  console.info(`[impulsa] ${name}`, data)
}
