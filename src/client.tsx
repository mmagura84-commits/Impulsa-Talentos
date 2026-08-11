import { StrictMode, startTransition } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'

/**
 * Custom TanStack Start client entry (overrides the framework default via the
 * `client` entry convention in src/).
 *
 * The framework default ALWAYS calls `hydrateRoot(document)`. That is correct
 * for prerendered pages (/, /jobs/*, /companies/*) whose SSR markup must be
 * hydrated — but it breaks the neutral SPA shell (spa-fallback.html) served
 * for auth workspaces (/employer, /candidate, /md, /hq, ...): the shell's
 * <body> holds only TanStack's bootstrap scripts (which self-remove at
 * parse), so `hydrateRoot(document)` compares an empty body — plus the
 * HOME-route <head> — against the route's tree and throws Minified React
 * error #418 (?args[]=HTML&args[]=) on EVERY full page load of a SPA route,
 * both locales, auth and unauth.
 *
 * Fix — Option A from QA's diagnosis: when the document has NO SSR content
 * (the neutral shell), skip hydration entirely and render fresh with
 * `createRoot(document.body)`. The shell's body is empty by construction, so
 * nothing is lost, and with no hydration there is no mismatch — #418 is
 * structurally impossible on SPA routes. Prerendered pages still hydrate
 * (their markup matches the client tree).
 *
 * The bootstrap scripts are removed from <body> before either path runs: the
 * $tsr-stream-barrier self-removes, the sessionStorage scroll-restore helper
 * self-removes too, and this entry module script is removed here. All three
 * have executed by the time this module runs (inline scripts run during
 * parse; this async module runs after), so removing their DOM nodes is
 * side-effect-free.
 */
const hasSsrContent = () => {
  for (const node of document.body.childNodes) {
    if (node.nodeType === 1 && (node as Element).tagName !== 'SCRIPT') return true
  }
  return false
}

startTransition(() => {
  for (const script of Array.from(document.body.querySelectorAll('script'))) {
    script.remove()
  }
  if (hasSsrContent()) {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  } else {
    createRoot(document.body).render(
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  }
})
