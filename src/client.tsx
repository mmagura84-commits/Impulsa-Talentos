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
// Match the root container by id OR class, not tag: it was changed from
// <div class="min-h-dvh"> to <main id="main" class="... min-h-dvh">, and a
// tag-bound selector silently sent every prerendered page down the
// createRoot(document.body) path (nested <html> inside <body>, SSR discarded).
// The prerendered page must also be for THIS path. Hostinger answers unknown
// paths (/employer, /hq, a job posted after the last build, …) with the
// prerendered HOME page no matter what .htaccess says; hydrating that against
// another route throws React #418 and flashes the home page. Each prerendered
// page records its path on <html data-route>; a mismatch takes the fresh-render
// path below, exactly like the neutral spa-fallback shell.
const norm = (p: string) => (p.replace(/\/+$/, '') || '/')
const prerenderedFor = document.documentElement.getAttribute('data-route')
const pathMatches = prerenderedFor === null || norm(prerenderedFor) === norm(window.location.pathname)
const hasSsrContent = () => pathMatches && !!document.querySelector('#main, .min-h-dvh')

startTransition(() => {
  if (hasSsrContent()) {
    hydrateRoot(
      document,
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  } else {
    // Executed bootstrap scripts, and any prerendered markup that belongs to a
    // different path, are cleared before the fresh render.
    for (const node of Array.from(document.body.childNodes)) {
      node.remove()
    }
    // Render into the DOCUMENT, not document.body. The route tree renders
    // <html>/<head>/<body>, which React 19 maps onto the real singletons; with
    // document.body as the container, the <body> singleton IS the container,
    // and React's event dispatcher walks body → HostSingleton → HostRoot →
    // body forever (main thread frozen; reproduced after an invited teammate
    // signs up and opens a job pipeline). This is also the root cause of the
    // 2026-08-14 "pages hang" that the capture-phase listeners above papered over.
    createRoot(document).render(
      <StrictMode>
        <StartClient />
      </StrictMode>,
    )
  }
})
