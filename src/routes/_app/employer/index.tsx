import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { FadeIn } from '@/components/dashboard/shared'
import { EmployerDashboard } from '@/components/dashboard/EmployerDashboard'
import { OnboardingPanel } from '@/components/onboarding/OnboardingPanel'
import { useOnboarding } from '@/hooks/useOnboarding'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/_app/employer/')({
  component: EmployerHomePage,
})

/**
 * Employer workspace — the landing page for hiring managers.
 * Completely separate from the candidate dashboard (/candidate).
 */
function EmployerHomePage() {
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile(user?.id)
  const { data: company } = useCompany(user?.id)
  const { data: jobs } = useCompanyJobs(company?.id)
  const myJobs = (jobs ?? []).filter((j) => j.companyId === company?.id)
  const onboarding = useOnboarding({ role: 'employer', profile, company, jobs: myJobs })
  const { t } = useI18n()

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
              <Building2 className="size-7 text-primary" />
              {t('dashboard.greeting', { name: displayName })}
            </h1>
            <p className="mt-1 text-muted-foreground">{t('dashboard.employer.subtitle')}</p>
          </div>
        </FadeIn>

        {onboarding.visible && (
          <OnboardingPanel
            steps={onboarding.steps}
            onDismiss={onboarding.dismiss}
            onVisit={(id) => { if (id === 'employer-apps') onboarding.markVisited('manage') }}
          />
        )}

        {user ? (
          <EmployerDashboard employerId={user.id} />
        ) : (
          <FadeIn>
            <Card>
              <CardContent className="py-10 text-center">
                <AlertCircle className="size-6 text-primary mx-auto mb-3" />
                <p className="font-medium text-foreground">{t('dashboard.needProfile.title')}</p>
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
