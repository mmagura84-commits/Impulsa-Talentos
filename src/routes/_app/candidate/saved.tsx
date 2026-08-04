import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMySavedJobs } from '@/hooks/useSavedJobs'
import { SavedJobRow } from '@/components/dashboard/CandidateDashboard'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Heart, Briefcase } from 'lucide-react'

export const Route = createFileRoute('/_app/candidate/saved')({
  component: SavedJobsPage,
})

/** Full saved-jobs list — separate page for the candidate workspace. */
function SavedJobsPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: savedJobs, isLoading } = useMySavedJobs(profile?.id)
  const { t } = useI18n()

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Heart className="size-7 text-primary" />
            {t('savedJobs.title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('savedJobs.desc')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('savedJobs.title')}</CardTitle>
            <CardDescription>{t('savedJobs.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <div className="h-16 rounded bg-muted animate-pulse" />}
            {!isLoading && (savedJobs ?? []).length === 0 && (
              <div className="py-10 text-center">
                <Briefcase className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('savedJobs.empty')}</p>
                <Button asChild variant="outline" className="mt-3 gap-1.5">
                  <Link to="/jobs"><Briefcase className="size-3.5" />{t('savedJobs.browse')}</Link>
                </Button>
              </div>
            )}
            {profile?.id && (savedJobs ?? []).map(job => (
              <SavedJobRow key={job.id} job={job} candidateId={profile.id} />
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthGate>
  )
}
