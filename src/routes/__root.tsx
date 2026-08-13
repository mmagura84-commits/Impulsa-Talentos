/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { I18nProvider, useI18n } from '@/i18n/I18nProvider'
import type { ReactNode } from 'react'
import indexCss from '../index.css?url'
import { devicePrePaintScript } from '@/lib/device'

/**
 * Pre-paint theme script. Runs synchronously in <head> BEFORE first paint, so
 * the document renders in the correct theme on the very first frame — no flash.
 * Dark mode is a single `.dark` class on <html>; the token values in index.css
 * flip under it. Persisted to localStorage, falls back to system preference.
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`

const queryClient = new QueryClient()

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
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'preconnect', href: 'https://images.unsplash.com' },
      { rel: 'preconnect', href: 'https://assets.mixkit.co' },
      { rel: 'dns-prefetch', href: 'https://cdn.coverr.co' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Lora:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:ital,wght@0,100..700;1,100..700&display=swap',
        media: 'print',
        // Onload swap to `all` after the stylesheet is fetched so the
        // first paint never blocks on Google Fonts.
      },
      { rel: 'stylesheet', href: indexCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/favicon.svg' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
    scripts: [
      {
        // The non-blocking font-swap pattern: load the Google Fonts
        // stylesheet with `media=print` then flip to `media=all` once
        // it's loaded so the browser never blocks first paint on it.
        children: `(function(){var l=document.querySelector('link[rel=stylesheet][href*="fonts.googleapis.com"]');if(!l||!l.media||l.media.indexOf('print')===-1)return;l.addEventListener('load',function(){l.media='all'});l.addEventListener('error',function(){l.media='all'})})();`,
      },
      {
        // Pre-paint device-class redirect. Runs before React hydrates
        // and rewrites the URL to the mobile app (/m/...) when the UA
        // + viewport width say so. The opt-out cookie (it_no_mobile)
        // suppresses it for users who explicitly want the desktop.
        children: devicePrePaintScript,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
              {/*
                Full-bleed by default — NO app chrome. Child routes render directly.
                SaaS / dashboard app? Opt in by adding a `src/routes/_app.tsx` layout
                route with pages under `src/routes/_app/`. Landing pages, marketing
                sites, content, and games stay full-bleed.
              */}
              {children}
              {/*
                Global legal footer strip — Terms / Privacy linked from every
                route (landing, dashboard, legal pages, mobile).
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

/** Global legal footer strip — localized (EN/ES) on every route. */
function GlobalFooter() {
  const { t } = useI18n()
  return (
    <footer className="border-t border-border/60 py-4 px-5 text-center">
      <nav aria-label={t('footer.pricing') === 'Pricing' ? 'Footer' : 'Pie de página'} className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>© {new Date().getFullYear()} Impulsa Talentos</span>
        <a href="/jobs" className="hover:text-foreground hover:underline underline-offset-4">{t('footer.jobs')}</a>
        <a href="/companies" className="hover:text-foreground hover:underline underline-offset-4">{t('footer.companies')}</a>
        <a href="/dashboard" className="hover:text-foreground hover:underline underline-offset-4">{t('footer.forEmployers')}</a>
        <a href="/pricing" className="hover:text-foreground hover:underline underline-offset-4">{t('footer.pricing')}</a>
        <a href="/terms" className="hover:text-foreground hover:underline underline-offset-4">{t('footer.terms')}</a>
        <a href="/privacy" className="hover:text-foreground hover:underline underline-offset-4">{t('footer.privacy')}</a>
      </nav>
    </footer>
  )
}
