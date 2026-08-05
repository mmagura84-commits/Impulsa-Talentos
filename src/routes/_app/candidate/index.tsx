import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { FadeIn } from '@/components/dashboard/shared'
import { CandidateDashboard } from '@/components/dashboard/CandidateDashboard'
import { OnboardingPanel } from '@/components/onboarding/OnboardingPanel'
import { useOnboarding } from '@/hooks/useOnboarding'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LayoutDashboard, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/_app/candidate/')({
  component: CandidateHomePage,
})

/**
 * Candidate workspace — the landing page for job seekers.
 * Completely separate from the employer dashboard (/employer).
 */
function CandidateHomePage() {
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile(user?.id)
  const navigate = useNavigate()
  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'candidate') navigate({ to: '/dashboard', replace: true })
  }, [isLoading, profile, navigate])
  const { t } = useI18n()
  const onboarding = useOnboarding({ role: 'candidate', profile })

  const displayName =
    profile?.fullName ?? user?.displayName ?? user?.email?.split('@')[0] ?? ''

  if (isLoading) {
    return (
      <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
        <div className="p-6 max-w-5xl mx-auto">
          <div className="h-8 w-48 rounded bg-muted animate-pulse mb-2" />
          <div className="h-4 w-72 rounded bg-muted animate-pulse mb-8" />
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
      <div className="p-6 max-w-5xl mx-auto">
        <FadeIn>
          <div className="mb-8">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <LayoutDashboard className="size-7 text-primary" />
              {t('dashboard.greeting', { name: displayName })}
            </h1>
            <p className="mt-1 text-muted-foreground">{t('dashboard.candidate.subtitle')}</p>
          </div>
        </FadeIn>

        {onboarding.visible && (
          <OnboardingPanel
            steps={onboarding.steps}
            onDismiss={onboarding.dismiss}
            onVisit={(id) => { if (id === 'candidate-jobs') onboarding.markVisited('jobs') }}
          />
        )}

        {profile?.id ? (
          <CandidateDashboard candidateProfileId={profile.id} />
        ) : (
          <FadeIn>
            <Card>
              <CardContent className="py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                  <AlertCircle className="size-6 text-primary" />
                </div>
                <p className="font-medium text-foreground">{t('dashboard.needProfile.title')}</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{t('dashboard.needProfile.desc')}</p>
                <Button asChild className="mt-4">
                  <Link to="/profile">{t('dashboard.needProfile.cta')}</Link>
                </Button>
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </AuthGate>
  )
}
