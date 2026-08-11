import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

/**
 * Custom TanStack Start client entry (overrides the framework default via the
 * `client` entry convention in src/).
 *
 * The framework default ALWAYS calls `hydrateRoot(document)`. That is correct
 * for prerendered pages (/, /jobs/*, /companies/*) whose SSR markup must be
 * hydrated — but it breaks the neutral SPA shell (spa-fallback.html) served
 * for auth workspaces (/employer, /candidate, /md, /hq, ...): the shell's
 * <body> holds only TanStack's bootstrap scripts and its <head> holds the
 * HOME route's SSR content, so React compares those against the route tree
 * and throws Minified React error #418 on EVERY full page load of a SPA
 * route — both locales, auth and unauth.
 *
 * Fix (runs before hydrateRoot):
 * 1. Remove the executed bootstrap <script> nodes from <body> (the
 *    $tsr-stream-barrier self-removes; the sessionStorage scroll-restore
 *    helper and this entry module script do not). The body then contains
 *    only React-rendered markup (prerendered pages — hydration matches) or
 *    nothing (neutral shell — hydration fills an empty body).
 * 2. When the body has NO SSR content (neutral shell), prune <head> down to
 *    the theme-init script (the one RootDocument renders BEFORE HeadContent).
 *    Everything else (title, meta, stylesheets, scripts) is rendered by the
 *    client tree and gets APPENDED during hydration — server nodes that the
 *    client tree also renders are matched by React 19's hoistable identity,
 *    and client-only nodes are appended, so no mismatch is possible. The
 *    home-route head (image preloads, home title/meta overrides) would
 *    otherwise be compared against the root route's head and throw #418.
 *
 * All three bootstrap scripts have executed by the time this module runs
 * (inline scripts run during parse; this async module runs after), so
 * removing their DOM nodes is side-effect-free.
 */
const hasSsrContent = () => {
  for (const node of document.body.childNodes) {
    if (node.nodeType === 1 && (node as Element).tagName !== 'SCRIPT') return true
  }
  return false
}

const pruneShellHead = () => {
  const themeScripts = new Set(
    Array.from(document.head.querySelectorAll('script')).filter((s) =>
      (s.textContent || '').includes("localStorage.getItem('theme')"),
    ),
  )
  for (const node of Array.from(document.head.childNodes)) {
    if (node.nodeType !== 1) continue
    if (themeScripts.has(node as HTMLScriptElement)) continue
    ;(node as Element).remove()
  }
}

startTransition(() => {
  for (const script of Array.from(document.body.querySelectorAll('script'))) {
    script.remove()
  }
  if (!hasSsrContent()) {
    pruneShellHead()
  }
  // TEMP DIAGNOSTIC (remove before shipping)
  console.log(
    '[client-entry] pre-hydration DOM',
    JSON.stringify({
      htmlAttr: document.documentElement.getAttributeNames().join(','),
      body: Array.from(document.body.childNodes).map(
        (n) => n.nodeName + ':' + (n.textContent || '').slice(0, 24),
      ),
      head: Array.from(document.head.childNodes).map(
        (n) => n.nodeName + (n.nodeType === 1 ? ':' + ((n as Element).getAttribute('rel') || (n as Element).getAttribute('href') || '') : ''),
      ),
    }),
  )
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
