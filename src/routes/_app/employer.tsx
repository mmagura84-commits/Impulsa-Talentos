import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useLayoutEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandMark } from '@/components/BrandMark'
import { Mail, CheckCircle2, AlertTriangle, ShieldX, Loader2, ArrowRight, BadgeCheck, Clock } from 'lucide-react'
import type { Company } from '@/types'

/**
 * Pathless employer layout — role-gates every /employer/* page with
 * progressive verification gates:
 *   1. Email not verified? → resend-verification interstitial
 *   2. Profile rejected/pending? → status interstitial
 *   3. Company unverified? → aware but not blocked (info banner)
 *   4. Not an employer? → redirect to /dashboard
 */
export const Route = createFileRoute('/_app/employer')({
  component: EmployerLayout,
})

function EmployerLayout() {
  const { user, isLoading: authLoading, resendVerificationEmail } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const { data: company, isLoading: companyLoading } = useCompany(user?.id)
  const { t } = useI18n()
  const navigate = useNavigate()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState('')
  // One-shot redirect latch: guards against an effect/re-render loop if the
  // profile object identity (or the router navigate fn) ever churns per
  // render. Depends on the PRIMITIVE role (dashboard parity), never the whole
  // profile object — a new object identity every render + navigate() in the
  // body is the exact render-loop pattern seen on SPA-shell boots (P0).
  const [roleRedirected, setRoleRedirected] = useState(false)

  useLayoutEffect(() => {
    // Wait for both auth and profile to settle before deciding.
    if (authLoading || profileLoading || roleRedirected) return
    // Profile resolved: if user has a different role, bounce them ONCE.
    if (profile && profile.role !== 'employer') {
      setRoleRedirected(true)
      navigate({ to: '/dashboard', replace: true })
    }
  }, [authLoading, profileLoading, profile?.role, navigate, roleRedirected])

  // ── Loading ──
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  // ── Gate 0: No user — pass through to children; every child wraps in AuthGate
  //    which renders the full sign-in form (email + button).
  if (!user) {
    return <Outlet />
  }

  // ── Gate 1: Email not verified ──
  if (!user.emailVerified) {
    const handleResend = async () => {
      if (!user.email || resending) return
      setResending(true)
      setResendError('')
      try {
        const returnPath = window.location.pathname
        await resendVerificationEmail(user.email, window.location.origin + returnPath)
        setResent(true)
      } catch (err) {
        setResendError(err instanceof Error ? err.message : t('common.retry'))
      } finally {
        setResending(false)
      }
    }

    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md w-full text-center border-border shadow-lg">
          <CardHeader>
            <div className="mx-auto mb-4 flex items-center justify-center">
              <BrandMark className="size-12 rounded-lg" title={t('brand.name')} />
            </div>
            <CardTitle className="font-serif text-xl">{t('auth.verifyEmail.title')}</CardTitle>
            <CardDescription>{t('auth.verifyEmail.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resent ? (
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="size-8 text-emerald-600" />
                <p className="text-sm font-medium text-foreground">{t('auth.verifyEmail.sent')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('auth.verifyEmail.sentDesc', { email: user.email ?? '' })}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {t('auth.verifyEmail.emailLabel')}{' '}
                  <span className="font-medium text-foreground">{user.email}</span>
                </p>
                {resendError && (
                  <p className="text-xs text-destructive">{resendError}</p>
                )}
                <Button
                  size="lg"
                  className="w-full gap-2 font-medium"
                  disabled={resending || !user.email}
                  onClick={handleResend}
                >
                  {resending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  {resending ? t('auth.sending') : t('auth.verifyEmail.resend')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Gate 2: Profile status (pending/rejected) ──
  if (profile?.profileStatus === 'rejected') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md w-full text-center border-destructive/30 shadow-lg">
          <CardHeader>
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldX className="size-7" />
            </div>
            <CardTitle className="font-serif text-xl">{t('auth.profileStatus.rejectedTitle')}</CardTitle>
            <CardDescription>{t('auth.profileStatus.rejectedDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="gap-2">
              <a href="/contact">
                <Mail className="size-4" />
                {t('contact.title')}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (profile?.profileStatus === 'pending') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md w-full text-center border-amber-500/30 shadow-lg">
          <CardHeader>
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <Clock className="size-7" />
            </div>
            <CardTitle className="font-serif text-xl">{t('auth.profileStatus.pendingTitle')}</CardTitle>
            <CardDescription>{t('auth.profileStatus.pendingDesc')}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // ── Gate 3: Company verification awareness (not a block — just info) ──
  // Render children with an interstitial banner if company exists and is unverified.
  const showVerificationBanner =
    company && !company.verified && !company.verificationRequested && !companyLoading

  return (
    <>
      {showVerificationBanner && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t('verification.banner.title')}</p>
              <p className="text-xs text-muted-foreground">{t('verification.banner.desc')}</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" asChild>
              <a href="/employer">
                <BadgeCheck className="size-3.5" />
                {t('verification.request')}
              </a>
            </Button>
          </div>
        </div>
      )}
      <Outlet />
    </>
  )
}
