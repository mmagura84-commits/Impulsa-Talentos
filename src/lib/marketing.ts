export const UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'] as const
export type UTMKey = typeof UTM_KEYS[number]
export function captureUTMParams() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const captured: Partial<Record<UTMKey,string>> = {}
  for (const key of UTM_KEYS) { const value = params.get(key); if (value) captured[key] = value }
  if (Object.keys(captured).length) sessionStorage.setItem('impulsa_utm', JSON.stringify(captured))
  return getUTMParams()
}
export function getUTMParams(): Partial<Record<UTMKey,string>> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(sessionStorage.getItem('impulsa_utm') ?? '{}') } catch { return {} }
}
export function trackEvent(name: string, data: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const event = { name, data, timestamp: new Date().toISOString(), path: location.pathname }
  const key = 'impulsa_analytics'
  try { const events = JSON.parse(sessionStorage.getItem(key) ?? '[]'); events.push(event); sessionStorage.setItem(key, JSON.stringify(events.slice(-100))) } catch { /* storage unavailable */ }
  console.info(`[impulsa] ${name}`, data)
}
