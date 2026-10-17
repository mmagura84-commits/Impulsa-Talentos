import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useState } from 'react'

const useLayoutEffectSafe = typeof window === 'undefined' ? useEffect : useLayoutEffect
import { Briefcase, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { LanguageToggle } from '@/components/LanguageToggle'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * Site header (docs/design/TESLA-DESIGN.md §4 "Navigation").
 *
 * Over a photo hero it floats: no background, border or shadow, white labels.
 * Once the page scrolls (or on pages without a hero) it becomes frosted white
 * with Carbon labels — still no border or shadow. Labels are 14px / 500 in
 * 4px-radius buttons; the current page gets a subtle background highlight
 * (never an underline or a second color).
 *
 * The data-* hooks (data-public-header, data-early-menu, #mobile-nav-panel) are
 * used by the early-tap script that scripts/finalize-static-build.mjs inlines,
 * so the phone menu works before the app's JavaScript has loaded. Keep them.
 */
export function PublicHeader({ transparentOnTop = true }: { transparentOnTop?: boolean }) {
  const { t } = useI18n(); const { user } = useAuth(); const location = useLocation()
  const [scrolled, setScrolled] = useState(!transparentOnTop); const [open, setOpen] = useState(false)
  useEffect(() => { if (!transparentOnTop) return; const fn=()=>setScrolled(window.scrollY>24); fn(); window.addEventListener('scroll',fn,{passive:true,capture:true}); return ()=>window.removeEventListener('scroll',fn) }, [transparentOnTop])
  // Before the app's scripts run, the early-tap script (scripts/finalize-static-build.mjs)
  // can already have opened the menu: adopt that state, then let React handle taps.
  useLayoutEffectSafe(() => {
    if (document.getElementById('mobile-nav-panel')?.hidden === false) setOpen(true)
    ;(window as { __itHydrated?: boolean }).__itHydrated = true
  }, [])
  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => { const fn=(e:KeyboardEvent)=>e.key==='Escape'&&setOpen(false); window.addEventListener('keydown',fn); return ()=>window.removeEventListener('keydown',fn) }, [])
  // Owner direction (2026-08-24): menu items live at the FAR RIGHT of the header,
  // grouped with the language/sign-in cluster; the Pricing link is removed from nav.
  const nav = [{to:'/candidate',label:t('nav.applyForJobs'), match:location.pathname.startsWith('/candidate')},{to:'/companies',label:t('nav.companies'),match:location.pathname.startsWith('/companies')},{to:'/for-employers',label:t('nav.forEmployers'),match:location.pathname.startsWith('/for-employers')}]
  // Floating over the photo: transparent bar, white labels. Anything else: frosted white, Carbon labels.
  const overHero = transparentOnTop && !scrolled && !open
  const cls = (active: boolean) => [
    'inline-flex min-h-8 items-center rounded-md px-4 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    overHero ? 'text-white focus-visible:ring-white' : 'text-foreground',
    active ? (overHero ? 'bg-white/20' : 'bg-secondary') : (overHero ? 'hover:bg-white/10' : 'hover:bg-secondary'),
  ].join(' ')
  const quiet = overHero ? 'text-white hover:bg-white/10 hover:text-white' : 'text-foreground'
  return <header data-public-header className={`sticky top-0 z-40 w-full transition-colors ${overHero ? 'bg-transparent' : 'bg-background/80 backdrop-blur-md'}`}>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground">{t('common.skipToContent')}</a>
    <div className="flex h-16 w-full items-center justify-between gap-4 px-5 lg:px-10"><Link to="/" className={`flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${overHero ? 'focus-visible:ring-white' : ''}`}><BrandMark withWordmark className={`h-8 sm:h-10 ${overHero ? 'text-white' : ''}`} title={t('brand.name')} /></Link>
      <div className="flex items-center gap-2 lg:gap-4">
        <nav className="hidden items-center gap-1 md:flex" aria-label={t('nav.main')}>{nav.map((n,i)=><Link key={n.to} to={n.to} aria-current={n.match?'page':undefined} className={`${cls(n.match)} ${i===2?'ml-3':''}`}>{n.label}</Link>)}</nav>
        <div className="flex items-center gap-1">
          <LanguageToggle compact className={quiet} />
          {user
            ? <Button asChild variant="ghost" size="sm" className={`gap-1.5 ${quiet}`}><Link to="/dashboard"><Briefcase className="size-4" />{t('landing.dashboard')}</Link></Button>
            : <>
                <Button asChild variant="ghost" size="sm" className={quiet}><Link to="/dashboard">{t('landing.signIn')}</Link></Button>
                <Button asChild size="sm" className="hidden sm:inline-flex"><a href="/dashboard?signup=1">{t('landing.createAccount')}</a></Button>
              </>}
          <button type="button" data-early-menu aria-label={open?'Close menu':'Open menu'} aria-expanded={open} aria-controls="mobile-nav-panel" onClick={()=>setOpen(!open)} className={`inline-flex size-10 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden ${overHero ? 'text-white hover:bg-white/10 focus-visible:ring-white' : 'text-foreground hover:bg-secondary'}`}>{open?<X className="size-5"/>:<Menu className="size-5"/>}</button>
        </div>
      </div>
    </div>
    <div id="mobile-nav-panel" hidden={!open} className="bg-background px-5 pb-5 pt-2 md:hidden"><nav className="flex flex-col gap-1" aria-label={t('nav.mobile')}>{nav.map(n=><Link key={n.to} to={n.to} aria-current={n.match?'page':undefined} onClick={()=>setOpen(false)} className={`flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary ${n.match?'bg-secondary':''}`}>{n.label}</Link>)}{!user&&<a href="/dashboard?signup=1" className="mt-2 flex min-h-11 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--color-primary),#000_14%)]">{t('landing.createAccount')}</a>}</nav></div>
  </header>
}
