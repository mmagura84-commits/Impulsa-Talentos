/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider, useI18n } from '@/i18n/I18nProvider'
import { Fragment, useEffect, useLayoutEffect, type ReactNode } from 'react'

const useLayoutEffectSafe = typeof window === 'undefined' ? useEffect : useLayoutEffect
import { captureUTMParams } from '@/lib/marketing'
import { startWebVitals } from '@/lib/webVitals'
import indexCss from '../index.css?url'

/**
 * Pre-paint theme script. Runs synchronously in <head> BEFORE first paint, so
 * the document renders in the correct theme on the very first frame — no flash.
 * Dark mode is a single `.dark` class on <html>; the token values in index.css
 * flip under it. Persisted to localStorage, falls back to system preference.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

const queryClient = new QueryClient()
// A team invite accepted at sign-in changes which company/jobs this person can
// see: refetch everything (see acceptTeamInvitesOnce in useAuth).
if (typeof window !== 'undefined') {
  window.addEventListener('impulsa:team-invite-accepted', () => {
    void queryClient.invalidateQueries()
  })
}

/**
 * Root route — owns the HTML document (SSR), global <head> (SEO-ready),
 * and the app-wide providers.
 *
 * NO app chrome (sidebar/top bar) is applied here by default, so every app —
 * landing pages, marketing sites, content, games — renders FULL-BLEED.
 * Building a SaaS / dashboard app? Opt into the sidebar shell by ADDING a
 * `src/routes/_app.tsx` pathless layout route with pages under `src/routes/_app/`
 * (a `_app.tsx` with no children conflicts with this index route). Keep this
 * root bare — don't add chrome here.
 *
 * SEO/AEO: <HeadContent /> renders the merged head() output (title, meta,
 * Open Graph, links) on the server, so crawlers and AI bots receive a
 * fully-rendered, indexable document on the first request. Per-page routes
 * override title/description via their own head().
 *
 * SSR: this document (and every route) is server-rendered/prerendered. A child
 * that reads browser-only state at render — `supabase.auth`/`onAuthStateChange`,
 * `localStorage`, `window` — must be wrapped in `<BlinkClientBoundary>`
 * (`src/components/BlinkClientBoundary.tsx`) or use the route's `ssr: false`,
 * or the page ships blank / hydration-mismatched. Do NOT read SDK/auth here.
 */
export const Route = createRootRoute({
  head: () => ({
  meta: [
    { charSet: 'utf-8' },
    { name: 'google', content: 'notranslate' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
    { title: 'Impulsa Talentos — Connecting Bilingual Talent with the World' },
    { name: 'description', content: 'Recruitment platform powered by our proprietary technology, connecting bilingual professionals in Colombia with top local and international employers. Tech, CX, healthcare, and finance roles.' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
    { name: 'apple-mobile-web-app-title', content: 'Impulsa' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'theme-color', content: '#1f3a8a' },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: 'Impulsa Talentos — Connecting Bilingual Talent' },
    { property: 'og:description', content: 'Recruitment platform powered by our proprietary technology, connecting bilingual professionals in Colombia with top local and international employers.' },
    { property: 'og:site_name', content: 'Impulsa Talentos' },
    { property: 'og:locale', content: 'en_US' },
    { property: 'og:locale:alternate', content: 'es_CO' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
    links: [
      { rel: 'dns-prefetch', href: 'https://images.unsplash.com' },
      { rel: 'stylesheet', href: indexCss },
      // ?v= : Hostinger caches every file for a year, so a new icon needs a new URL.
      { rel: 'icon', href: '/favicon.ico?v=2', sizes: '48x48' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=2' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png?v=2' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json?v=2' },
    ],
  }),
  shellComponent: RootDocument,
})

// Brand fonts (self-hosted, @fontsource) load once the app is running, i.e.
// after the page is already on screen, so they never hold up the first paint.
// Only the subsets a page actually uses are downloaded (unicode-range).
function useBrandFonts() {
  useEffect(() => {
    void import('@fontsource-variable/dm-sans/wght.css')
    void import('@fontsource-variable/lora/wght.css')
    void import('@fontsource/ibm-plex-mono/400.css')
    void import('@fontsource/ibm-plex-mono/500.css')
  }, [])
}

function RootDocument({ children }: { children: ReactNode }) {
  const { location } = useRouterState()
  useBrandFonts()
  // React now handles taps; the pre-hydration tap script stands down.
  useLayoutEffectSafe(() => { (window as { __itHydrated?: boolean }).__itHydrated = true }, [])
  // Real-visitor load times (anonymous; see lib/webVitals and migration 051).
  useEffect(() => { startWebVitals() }, [])
  return (
    // translate="no" (+ the `google: notranslate` meta): the site ships its own
    // EN/ES/PT switcher. Browser auto-translate rewrites React-owned text nodes
    // (wrapping them in <font>), which breaks updates — e.g. the language toggle
    // stopped responding on a Chrome-translated Spanish page.
    <html lang="en" translate="no" data-route={location.pathname} suppressHydrationWarning>
      <head>
        {/* MUST be first: sets the theme class before paint so there is no
            flash-of-wrong-theme. Do not move below <HeadContent />. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
        {/*
          WebSite + Organization entity (rendered on every page, once at the root).
          Gives Google's Knowledge Graph + AI answer engines explicit, machine-
          readable identity. Replace name/url and add the brand's real profile
          links to `sameAs` (LinkedIn, GitHub, X, Crunchbase) per app.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                { '@type': 'WebSite', name: 'Impulsa Talentos', url: '/' },
                { '@type': 'Organization', name: 'Impulsa Talentos', url: '/', sameAs: [] },
              ],
            }),
          }}
        />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <I18nProvider>
            <TooltipProvider delayDuration={0}>
              <Toaster />
              <AttributionCapture />
              {/*
                Full-bleed by default — NO app chrome. Child routes render directly.
                SaaS / dashboard app? Opt in by adding a `src/routes/_app.tsx` layout
                route with pages under `src/routes/_app/`. Landing pages, marketing
                sites, content, and games stay full-bleed.
              */}
              {children}
              {/*
                Global legal footer strip — Terms / Privacy linked from every
                route (landing, dashboard, legal pages, mobile). Hidden on the
                /m app shell (viewport-locked; footer would add doc scroll).
              */}
              <GlobalFooter />
            </TooltipProvider>
          </I18nProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}

/** Remembers the campaign tags of the page a visitor first lands on. */
function AttributionCapture() {
  useEffect(() => { captureUTMParams() }, [])
  return null
}

/** Global legal footer strip — localized (EN/ES/PT) on every route.
 *
 * Phones: exactly two centred rows of similar width — the four section links,
 * then the two legal links with the copyright — instead of the ragged wrap it
 * used to produce. The legal links use their short labels there, because
 * "Política de Privacidad" alone is almost a full row.
 * Tablet and up: one centred line, copyright first, as before. */
function GlobalFooter() {
  const { t } = useI18n()
  const links = [
    { href: '/jobs', label: t('footer.jobs') },
    { href: '/companies', label: t('footer.companies') },
    { href: '/dashboard', label: t('footer.forEmployers') },
    { href: '/pricing', label: t('footer.pricing') },
    { href: '/terms', label: t('footer.terms'), short: t('footer.termsShort') },
    { href: '/privacy', label: t('footer.privacy'), short: t('footer.privacyShort') },
  ]
  return (
    <footer className="bg-background px-5 py-6 text-center">
      <nav
        aria-label={t('footer.pricing') === 'Pricing' ? 'Footer' : 'Pie de página'}
        data-site-footer
        className="mx-auto flex max-w-sm flex-wrap items-center justify-center gap-x-3.5 gap-y-2 text-sm leading-tight text-muted-foreground sm:max-w-none sm:gap-x-4 sm:gap-y-1 sm:text-xs"
      >
        {/* Last on phones (it closes the second row), first on wider screens.
            min-h-11 matches the 44px tap target the links get on phones (see
            index.css), and every item centres its text inside that box, so a
            row reads as one line. */}
        <span className="order-last inline-flex min-h-11 items-center sm:order-none sm:min-h-0">© {new Date().getFullYear()} Impulsa Talentos</span>
        {links.map((l, i) => (
          <Fragment key={l.href}>
            <a href={l.href} className="inline-flex items-center justify-center hover:text-foreground hover:underline underline-offset-4">
              {l.short ? (<><span className="sm:hidden">{l.short}</span><span className="hidden sm:inline">{l.label}</span></>) : l.label}
            </a>
            {/* Row break after the fourth link, so phones get 4 + 3 rather than a ragged wrap. */}
            {i === 3 && <span aria-hidden className="-mt-2 basis-full sm:hidden" />}
          </Fragment>
        ))}
      </nav>
    </footer>
  )
}
