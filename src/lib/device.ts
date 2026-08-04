/**
 * Lightweight device detection + a one-shot redirect that hands
 * phone visitors off to the dedicated mobile app at `/m/...`.
 *
 * Strategy:
 *   1. Server-side: nothing happens. We do NOT 302 from `/` based
 *      on User-Agent because the same UA can mean a tablet or a
 *      desktop and search crawlers (Googlebot mobile) would all
 *      land on mobile. Instead, we render a tiny inline script that
 *      decides client-side.
 *
 *   2. Client-side: on every desktop page we mount
 *      `<MobileRedirect />` (mounted from `__root.tsx`). It checks
 *      (a) stored opt-out cookie, (b) UA signal, (c) viewport width
 *      and only fires a `history.replaceState` to the closest mobile
 *      URL when the device qualifies. The desktop page renders
 *      normally and is replaced in-place, so the user does not see
 *      a flash of the desktop UI.
 *
 *   3. Mobile pages mount `<DesktopOptOut />` (a footer link) that
 *      sets the opt-out cookie and navigates back to `/` (desktop).
 *
 * Caching: the device decision is cached in `sessionStorage` so
 * the redirect only runs once per session.
 */

const COOKIE_NAME = 'it_no_mobile'
const CACHE_KEY = 'it_device_class'

export type DeviceClass = 'mobile' | 'desktop'

/** Parse a UA string. Mobile-first, never trusts tablets as desktop. */
export function isMobileUA(ua: string): boolean {
  if (!ua) return false
  // Quick wins: iOS + Android webviews
  if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true
  }
  // iPadOS sometimes identifies as Mac — fall back to touch points.
  if (/iPad/i.test(ua)) return true
  if (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1) {
    return true
  }
  return false
}

/** Read the opt-out cookie. `true` means "force desktop, do not redirect me." */
export function isOptedOutOfMobile(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some(c => c.startsWith(`${COOKIE_NAME}=1`))
}

export function setOptOutOfMobile(value: boolean): void {
  if (typeof document === 'undefined') return
  if (value) {
    // 30 days, top-level so the redirect never resurfaces
    document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`
  } else {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
  }
}

/**
 * Classify once per session, persist to sessionStorage so the
 * script tag doesn't re-evaluate on hydration.
 */
export function classifyDevice(): DeviceClass {
  if (typeof window === 'undefined') return 'desktop'
  try {
    const cached = window.sessionStorage.getItem(CACHE_KEY) as DeviceClass | null
    if (cached === 'mobile' || cached === 'desktop') return cached
  } catch {
    // sessionStorage can throw in privacy modes — fall through
  }
  const ua = navigator.userAgent
  const narrow = Math.min(window.innerWidth, window.screen.width || 9999) < 768
  const cls: DeviceClass = isMobileUA(ua) && narrow ? 'mobile' : 'desktop'
  try {
    window.sessionStorage.setItem(CACHE_KEY, cls)
  } catch {
    // ignore
  }
  return cls
}

/**
 * The pre-paint inline script. Renders into the document head and
 * runs before React hydrates. If the device qualifies as mobile,
 * it rewrites `window.location` to the mobile equivalent BEFORE
 * the SPA ever mounts, so the user never sees the desktop shell.
 *
 * Mounted from `__root.tsx` via the route's `head()` scripts array.
 */
export const devicePrePaintScript = `
(function(){
  try {
    var NO = 'it_no_mobile';
    function hasOptOut() {
      return document.cookie.split('; ').some(function(c){return c.indexOf(NO + '=1') === 0});
    }
    if (hasOptOut()) return;
    var ua = navigator.userAgent || '';
    function isMobileUA(u) {
      if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(u)) return true;
      if (/iPad/i.test(u)) return true;
      if (/Macintosh/i.test(u) && navigator.maxTouchPoints > 1) return true;
      return false;
    }
    var w = Math.min(window.innerWidth || 9999, (window.screen && window.screen.width) || 9999);
    if (!isMobileUA(ua) || w >= 768) return;
    var path = window.location.pathname || '/';
    // Public routes get mirrored to /m/... — internal app routes
    // (dashboard, profile, post-job, manage, apply) get the same
    // prefix so the URL stays predictable.
    var map = {
      '/': '/m',
      '/jobs': '/m/jobs',
    };
    var target = null;
    for (var k in map) {
      if (path === k) { target = map[k]; break; }
    }
    if (path.indexOf('/jobs/') === 0) target = '/m/jobs' + path.slice('/jobs'.length);
    if (path.indexOf('/apply/') === 0) target = '/m' + path;
    if (path.indexOf('/dashboard') === 0) target = '/m/home';
    if (path.indexOf('/profile') === 0) target = '/m/profile';
    if (path.indexOf('/post-job') === 0) target = '/m/post';
    if (path.indexOf('/edit-job/') === 0) target = '/m/home';
    if (path.indexOf('/manage/') === 0) target = '/m/home';
    if (target && target !== path) {
      window.location.replace(target + window.location.search + window.location.hash);
    }
  } catch(e) { /* never block the app on a UA parsing failure */ }
})();
`.trim()
