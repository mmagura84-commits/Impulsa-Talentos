import { createFileRoute } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMyApplications } from '@/hooks/useApplications'
import { ApplicationTimelineItem } from '@/components/dashboard/CandidateDashboard'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'

export const Route = createFileRoute('/_app/candidate/applications')({
  component: ApplicationsPage,
})

/** Full applications timeline — separate page for the candidate workspace. */
function ApplicationsPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: applications, isLoading } = useMyApplications(profile?.id)
  const { t } = useI18n()

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <FileText className="size-7 text-primary" />
            {t('dashboard.myApplications.title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('dashboard.myApplications.desc')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.myApplications.title')}</CardTitle>
            <CardDescription>{t('dashboard.myApplications.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {isLoading && <div className="h-16 rounded bg-muted animate-pulse" />}
            {!isLoading && (applications ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">{t('dashboard.myApplications.empty')}</p>
            )}
            {(applications ?? []).map((app, i) => (
              <ApplicationTimelineItem
                key={app.id}
                app={app}
                isLast={i === (applications ?? []).length - 1}
              />
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthGate>
  )
}
