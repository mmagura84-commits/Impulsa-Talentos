/**
 * The separate phone app (/m/...) was retired: the main pages now work on
 * phones. Old links, bookmarks and emails pointing at /m/... are forwarded
 * to the matching page.
 */
export function desktopPathFor(mobilePath: string): string {
  const p = mobilePath.replace(/\/+$/, '') || '/m'
  const rest = p.replace(/^\/m(?=\/|$)/, '') || '/'
  const exact: Record<string, string> = {
    '/': '/',
    '/home': '/dashboard',
    '/jobs': '/jobs',
    '/companies': '/companies',
    '/company': '/employer',
    '/post': '/employer/post-job',
    '/profile': '/profile',
    '/saved': '/candidate/saved',
    '/applications': '/candidate/applications',
  }
  if (exact[rest]) return exact[rest]
  if (rest.startsWith('/jobs/')) return rest
  if (rest.startsWith('/companies/')) return rest
  if (rest.startsWith('/edit-job/')) return `/employer${rest}`
  if (rest.startsWith('/apply/')) return rest
  return '/'
}
