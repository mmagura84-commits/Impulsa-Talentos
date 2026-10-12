/**
 * Real-visitor load times. On the first page a visitor opens, measures what
 * Google calls the Core Web Vitals with the `web-vitals` library:
 *   LCP  main content visible        FCP  first content visible
 *   TTFB first byte from the server  INP  delay after a tap
 *   CLS  how much the layout moves
 * and sends them once to record_web_vitals (migration 051), which HQ reads as
 * 75th-percentile summaries. Anonymous technical data only: page path with ids
 * removed, phone or desktop, connection type, site build. Sent over plain
 * fetch (no supabase-js), when the visitor leaves or hides the page, or after
 * 15 s, whichever comes first.
 */
const SEND_AFTER_MS = 15_000

let started = false

const pagePattern = (path: string) =>
  (path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .slice(0, 200)) || '/'

export function startWebVitals(): void {
  if (started || typeof window === 'undefined') return
  started = true
  // Real visitors only: skip Lighthouse/PageSpeed and other automated browsers
  // (tests can opt in with localStorage it_vitals_debug=1).
  let debug = false
  try { debug = window.localStorage.getItem('it_vitals_debug') === '1' } catch { /* ignore */ }
  if (!debug && (navigator.webdriver || /Chrome-Lighthouse|HeadlessChrome|PTST/.test(navigator.userAgent))) return
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return

  const page = pagePattern(window.location.pathname)
  const values: Partial<Record<'lcp' | 'fcp' | 'ttfb' | 'inp' | 'cls', number>> = {}
  let navType = ''
  let sent = false
  const ms = (v?: number) => (v == null ? null : Math.round(v))

  const send = () => {
    if (sent || (values.lcp == null && values.fcp == null)) return
    sent = true
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType ?? null
    const body = {
      p_page: page,
      p_device: window.matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
      p_connection: connection,
      p_build: document.querySelector('script[data-build]')?.getAttribute('data-build') ?? null,
      p_nav_type: navType || null,
      p_lcp_ms: ms(values.lcp),
      p_fcp_ms: ms(values.fcp),
      p_ttfb_ms: ms(values.ttfb),
      p_inp_ms: ms(values.inp),
      p_cls: values.cls == null ? null : Math.round(values.cls * 10000) / 10000,
    }
    void fetch(`${url}/rest/v1/rpc/record_web_vitals`, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => { /* best effort */ })
  }

  void import('web-vitals').then(({ onLCP, onFCP, onTTFB, onINP, onCLS }) => {
    const keep = (k: keyof typeof values) => (m: { value: number; navigationType?: string }) => {
      values[k] = m.value
      if (m.navigationType) navType = m.navigationType
    }
    const opts = { reportAllChanges: true }
    onLCP(keep('lcp'), opts)
    onFCP(keep('fcp'), opts)
    onTTFB(keep('ttfb'), opts)
    onINP(keep('inp'), opts)
    onCLS(keep('cls'), opts)
    // Registered after web-vitals' own listeners, so final values are in.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') send() })
    window.addEventListener('pagehide', send)
    window.setTimeout(send, SEND_AFTER_MS)
  }).catch(() => { /* measurement is optional */ })
}
