import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { useApplicationsByCompany } from '@/hooks/useApplications'
import { useProfileById } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { Inbox } from 'lucide-react'
import { statusLabel, formatPosted } from '@/components/dashboard/shared'

export const Route = createFileRoute('/_app/employer/applications')({ component: EmployerApplications })

function ApplicationRow({ application, jobTitle }: { application: any; jobTitle: string }) {
  const { data: candidate } = useProfileById(application.candidateId)
  const { t } = useI18n()
  return <Link to="/employer/manage/$id" params={{ id: application.jobId }} className="block rounded-lg border p-4 hover:bg-accent/40 transition-colors">
    <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium truncate">{candidate?.fullName ?? t('applications.candidate')}</p><p className="text-sm text-muted-foreground truncate">{jobTitle}</p></div><Badge variant="outline">{statusLabel(application.status, t)}</Badge></div>
    <p className="mt-2 text-xs text-muted-foreground">{formatPosted(application.createdAt, t)}</p>
  </Link>
}
function EmployerApplications() {
  const { user } = useAuth(); const { data: company } = useCompany(user?.id); const { data: jobs } = useCompanyJobs(company?.id)
  const jobIds = jobs?.map(j => j.id); const { data: applications, isLoading } = useApplicationsByCompany(jobIds); const { t } = useI18n()
  const titles = new Map((jobs ?? []).map(j => [j.id, j.title]))
  return <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc"><div className="p-6 max-w-5xl mx-auto space-y-5"><div><h1 className="font-serif text-2xl font-bold flex items-center gap-2"><Inbox className="size-6 text-primary" />{t('nav.applications')}</h1><p className="text-muted-foreground mt-1">{t('applications.subtitle')}</p></div>{isLoading ? <div className="h-28 rounded bg-muted animate-pulse" /> : !applications?.length ? <Card><CardContent className="py-12 text-center text-muted-foreground">{t('applications.empty')}</CardContent></Card> : <div className="space-y-2">{applications.map(a => <ApplicationRow key={a.id} application={a} jobTitle={titles.get(a.jobId) ?? ''} />)}</div>}</div></AuthGate>
}
