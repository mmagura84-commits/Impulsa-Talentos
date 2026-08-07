/**
 * MobileShell — the chrome for the dedicated phone app at /m/...
 *
 * Three pieces:
 *   1. Top bar (sticky, blur): brand + language + account sheet
 *   2. Main content slot (scrollable, full-bleed, bottom-padded so
 *      the tab bar never covers the last row)
 *   3. Bottom tab bar (fixed, 4 tabs): Jobs / Saved / Home / Profile
 *
 * Touch targets are 48px+ (iOS HIG), tab bar is 64px (Material
 * Design), content has safe-area padding on iOS notch devices.
 *
 * Why a separate shell (instead of responsive Tailwind classes)?
 * The user explicitly asked for a phone-built app that does NOT
 * rely on media queries. The mobile shell is therefore a different
 * design language with its own navigation, spacing scale, and
 * tap targets. The desktop shell is untouched.
 */
import { useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import {
  Briefcase,
  Heart,
  Home,
  User,
  Monitor,
  Languages,
  PlusCircle,
  Inbox,
  Building2,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { setOptOutOfMobile } from '@/lib/device'
import { BrandMark } from '@/components/BrandMark'
import { LOCALE_LABELS, type Locale } from '@/i18n/translations'
import { cn } from '@/lib/utils'

interface MobileShellProps {
  children: ReactNode
  /** Page title shown in the top bar (small, top-left). */
  title?: string
}

const LOCALES: Locale[] = ['en', 'es']

function useIsActive(to: string): boolean {
  // TanStack exposes the current location via useRouterState. We
  // match by prefix so /m/jobs/123 also activates the "Jobs" tab.
  const { location } = useRouterState()
  if (to === '/m') return location.pathname === '/m' || location.pathname === '/m/'
  return location.pathname === to || location.pathname.startsWith(`${to}/`)
}

export function MobileShell({ children, title }: MobileShellProps) {
  const { t, locale, setLocale } = useI18n()
  const { user, login, logout } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const [langOpen, setLangOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isEmployer = profile?.role === 'employer' || profile?.role === 'admin'
  const greeting = profile?.fullName?.trim() || user?.email?.split('@')[0] || ''

  return (
    <div
      className="min-h-dvh max-w-full overflow-x-hidden bg-background text-foreground flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ── Top bar ───────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between gap-2 px-4 h-14">
          <Link
            to="/m"
            className="flex items-center gap-2 min-w-0 active:opacity-70"
            aria-label={t('mobile.appName')}
          >
            <BrandMark className="size-7 rounded-md shrink-0" title={t('mobile.appName')} />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold leading-tight truncate">
                {t('mobile.appName')}
              </span>
              {title ? (
                <span className="text-[11px] text-muted-foreground leading-tight truncate">
                  {title}
                </span>
              ) : greeting ? (
                <span className="text-[11px] text-muted-foreground leading-tight truncate">
                  {greeting}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground leading-tight truncate">
                  {t('mobile.tagline')}
                </span>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setLangOpen(v => !v)}
              className="flex items-center gap-1 h-9 px-2.5 rounded-full text-xs font-semibold tracking-wider text-muted-foreground hover:text-foreground active:bg-accent"
              aria-label={t('mobile.language')}
            >
              <Languages className="size-4" />
              {locale.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-foreground active:bg-accent"
              aria-label={t('common.signIn')}
            >
              <User className="size-4" />
            </button>
          </div>
        </div>

        {langOpen && (
          <div className="border-t border-border bg-card">
            <p className="px-4 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t('mobile.language')}
            </p>
            <div className="px-2 pb-2 grid grid-cols-2 gap-1">
              {LOCALES.map(l => {
                const active = l === locale
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => {
                      setLocale(l)
                      setLangOpen(false)
                    }}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md text-sm py-2.5 px-3 transition-colors',
                      active
                        ? 'bg-accent text-foreground font-semibold'
                        : 'text-muted-foreground active:bg-accent/50',
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center h-5 w-8 rounded border border-border bg-background text-[11px] font-bold">
                        {l.toUpperCase()}
                      </span>
                      {LOCALE_LABELS[l]}
                    </span>
                    {active && <Check className="size-3.5 text-primary" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </header>

      {/* ── Account / menu sheet ───────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="relative w-full max-w-md bg-card border-t border-border rounded-t-3xl shadow-2xl animate-fade-in"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="px-5 pb-5">
              {user ? (
                <>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {greeting || user.email}
                  </p>
                  <Link
                    to="/m/profile"
                    search={{ apply: undefined }}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 py-3 border-b border-border text-sm font-medium active:bg-accent"
                  >
                    <User className="size-4 text-primary" /> {t('mobile.nav.profile')}
                  </Link>
                  {isEmployer && (
                    <>
                      <Link
                        to="/m/applications"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 py-3 border-b border-border text-sm font-medium active:bg-accent"
                      >
                        <Inbox className="size-4 text-primary" /> {t('mobile.nav.applications')}
                      </Link>
                      <Link
                        to="/m/company"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 py-3 border-b border-border text-sm font-medium active:bg-accent"
                      >
                        <Building2 className="size-4 text-primary" /> {t('mobile.nav.company')}
                      </Link>
                      <Link
                        to="/m/post"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 py-3 border-b border-border text-sm font-medium active:bg-accent"
                      >
                        <PlusCircle className="size-4 text-primary" /> {t('mobile.nav.post')}
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                    }}
                    className="flex items-center gap-3 py-3 text-sm font-medium text-destructive active:bg-accent w-full text-left"
                  >
                    {t('mobile.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {t('mobile.authRequired')}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {t('mobile.authRequiredDesc')}
                  </p>
                  <Button onClick={() => { login(); setMenuOpen(false) }} size="lg" className="w-full">
                    {t('mobile.authRequiredCta')}
                  </Button>
                </>
              )}
              <div className="mt-4 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setOptOutOfMobile(true)
                    setMenuOpen(false)
                    if (typeof window !== 'undefined') {
                      window.location.href = '/'
                    }
                  }}
                  className="flex items-center gap-3 py-2.5 text-sm text-muted-foreground active:text-foreground w-full"
                >
                  <Monitor className="size-4" /> {t('mobile.viewDesktop')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content (scrollable, padded for the tab bar) ── */}
      <main
        id="main"
        className="flex-1"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:px-3 focus:py-2 focus:rounded-md focus:text-sm"
        >
          {t('mobile.skipToContent')}
        </a>
        {children}
      </main>

      {/* ── Bottom tab bar ─────────────────────────────────── */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t('nav.primary')}
      >
        <ul className="grid grid-cols-4 h-16 max-w-md mx-auto">
          {isEmployer ? (
            <TabItem to="/m/applications" icon={Inbox} label={t('mobile.nav.applications')} />
          ) : (
            <TabItem to="/m/jobs" icon={Briefcase} label={t('mobile.nav.jobs')} />
          )}
          {isEmployer ? (
            <TabItem to="/m/post" icon={PlusCircle} label={t('mobile.nav.post')} />
          ) : (
            <TabItem to="/m/saved" icon={Heart} label={t('mobile.nav.saved')} />
          )}
          <TabItem to={user ? '/m/home' : '/m'} icon={Home} label={t('mobile.nav.dashboard')} />
          <TabItem to="/m/profile" icon={User} label={t('mobile.nav.profile')} />
        </ul>
      </nav>
    </div>
  )
}

function TabItem({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: React.ElementType
  label: string
}) {
  const active = useIsActive(to)
  return (
    <li>
      <Link
        to={to}
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 h-full text-[11px] font-medium transition-colors',
          active
            ? 'text-primary'
            : 'text-muted-foreground active:text-foreground active:bg-accent/30',
        )}
        aria-current={active ? 'page' : undefined}
      >
        <Icon
          className={cn('size-5 transition-transform', active && 'scale-110')}
          strokeWidth={active ? 2.25 : 1.75}
        />
        <span>{label}</span>
      </Link>
    </li>
  )
}
