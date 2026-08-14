import { StrictMode, startTransition } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
/**
 * P0 pages-hang guard (2026-08-14): react-dom 19.2.8 dispatches selectionchange/scroll
 * against a HostRoot left isDehydrated=true by the SPA-shell deep-link boot and spins
 * the main thread forever (gp->vp->jd loop; team report LOOP-ROUND3-INSTRUMENTED.md).
 * These events are unused by the app — block them at document CAPTURE so they never
 * reach React's root listener. Zero UX impact.
 */
if (typeof document !== 'undefined') {
  for (const ev of ['selectionchange', 'scroll', 'scrollend'] as const) {
    document.addEventListener(ev, (e) => e.stopPropagation(), true)
  }
}


/**
 * Custom TanStack Start client entry (overrides the framework default via the
 * `client` entry convention in src/).
 *
 * The framework default ALWAYS calls `hydrateRoot(document)`. That is correct
 * for prerendered pages (/, /jobs/*, /companies/*) whose SSR markup must be
 * hydrated — but it breaks the neutral SPA shell (spa-fallback.html) served
 * for auth workspaces (/employer, /candidate, /md, /hq, ...): the shell has
 * no SSR'd React content, so hydrating it against the route tree throws
 * Minified React error #418 on EVERY full page load of a SPA route — both
 * locales, auth and unauth.
 *
 * Path selection — presence of the app root container (`div.min-h-dvh`, the
 * root div every prerendered route tree renders). The shell's body is
 * SCRIPT-ONLY by construction (scripts/finalize-static-build.mjs strips all
 * other body content), so it never contains that container:
 *
 * - Prerendered page: leave the DOM completely untouched and hydrate exactly
 *   like the framework default (the TanStack bootstrap scripts are part of
 *   the SSR hydration contract — removing them breaks hydration, which threw
 *   #418 on public pages that were clean with the default).
 * - Neutral shell: remove the executed bootstrap <script> nodes (the
 *   $tsr-stream-barrier and the sessionStorage scroll-restore helper
 *   self-remove at parse; this entry module script is removed here — all
 *   three have executed by the time this module runs, so removing their DOM
 *   nodes is side-effect-free), then render FRESH with
 *   `createRoot(document.body)` — no hydration at all, so no mismatch is
 *   possible on SPA routes.
 */
const hasSsrContent = () => !!document.querySelector('div.min-h-dvh')

startTransition(() => {
  if (hasSsrContent()) {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  } else {
    for (const script of Array.from(document.body.querySelectorAll('script'))) {
      script.remove()
    }
    createRoot(document.body).render(
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  }
})
