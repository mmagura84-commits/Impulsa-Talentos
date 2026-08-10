import { createFileRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useLayoutEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AuthGate } from '@/components/AuthGate'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandMark } from '@/components/BrandMark'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'

/**
 * Pathless candidate layout — role-gates every /candidate/* page.
 * Redirects non-candidates to /dashboard before any child content renders.
 * Requires email verification before allowing access.
 */
export const Route = createFileRoute('/_app/candidate')({
  component: CandidateLayout,
})

function CandidateLayout() {
  const { user, isLoading: authLoading, resendVerificationEmail } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState('')

  useLayoutEffect(() => {
    // Wait for both auth and profile to settle before deciding.
    if (authLoading || profileLoading) return
    if (profile && profile.role !== 'candidate') {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [authLoading, profileLoading, profile, navigate])

  // ── Loading ──
  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  // ── No user — AuthGate renders the bilingual sign-in/create-account form.
  if (!user) {
    const isCreateAccount = location.pathname.endsWith('/create-account')
    return (
      <AuthGate
        initialMode={isCreateAccount ? 'signUp' : 'signIn'}
        fallbackKey={isCreateAccount ? 'auth.signUpTitle' : 'auth.signInTitle'}
        fallbackDescKey={isCreateAccount ? 'auth.signUpDescription' : 'auth.signInDescription'}
      >
        <Outlet />
      </AuthGate>
    )
  }
  // ── Email verification gate ──
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

  return <Outlet />
}
