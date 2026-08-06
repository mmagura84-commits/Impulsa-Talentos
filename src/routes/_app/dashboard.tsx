import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useLayoutEffect, useState } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { getOnboardingIntent, clearOnboardingIntent, setOnboardingIntent } from '@/lib/intent'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Briefcase, Search, ArrowRight } from 'lucide-react'
import { BrandMark } from '@/components/BrandMark'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardRedirect,
})

/**
 * /dashboard is a role-based entry point that sends each user to
 * their own workspace:
 *   • candidates → /candidate   (job search, saved jobs, applications)
 *   • employers  → /employer    (job postings, applicants, analytics)
 *   • admins     → /hq          (platform moderation & overview)
 *
 * For new users without a profile:
 *   • If an onboarding intent was stored (via employer CTA), use it
 *   • Otherwise, show a bilingual candidate/employer chooser
 */
function DashboardRedirect() {
  const { user, isLoading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const { t } = useI18n()
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState(false)

  // Wait for BOTH auth and profile to resolve before redirecting.
  // Without the authLoading gate, the effect fires when useProfile is
  // disabled (user === undefined, isLoading === false) and defaults
  // to /candidate — causing a bounce for non-candidate users:
  //   /dashboard → /candidate → /dashboard → /employer.
  useLayoutEffect(() => {
    if (authLoading || profileLoading) return

    // If user has a profile, redirect based on their role
    if (profile?.role) {
      const target =
        profile.role === 'admin' ? '/hq'
        : profile.role === 'md' ? '/md'
        : profile.role === 'employer' ? '/employer'
        : '/candidate'
      navigate({ to: target, replace: true })
      return
    }

    // No profile yet — check for stored onboarding intent
    const intent = getOnboardingIntent()
    if (intent) {
      clearOnboardingIntent()
      const target = intent === 'employer' ? '/employer' : '/candidate'
      navigate({ to: target, replace: true })
      return
    }

    // No profile and no intent — show the chooser
    setChoosing(true)
  }, [authLoading, profileLoading, profile?.role, navigate])

  if (!choosing) {
    return (
      <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <div className="mx-auto animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      </AuthGate>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <Card className="max-w-lg w-full text-center shadow-lg">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <BrandMark className="size-12 rounded-lg" title={t('brand.name')} />
          </div>
          <CardTitle className="font-serif text-xl">{t('onboarding.chooser.title')}</CardTitle>
          <CardDescription>{t('onboarding.chooser.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setOnboardingIntent('candidate')
              navigate({ to: '/candidate', replace: true })
            }}
            className="w-full text-left rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <Search className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{t('onboarding.chooser.candidate')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.chooser.candidateDesc')}</p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2.5" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setOnboardingIntent('employer')
              navigate({ to: '/employer', replace: true })
            }}
            className="w-full text-left rounded-xl border border-border p-5 hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                <Briefcase className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{t('onboarding.chooser.employer')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('onboarding.chooser.employerDesc')}</p>
              </div>
              <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2.5" />
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
