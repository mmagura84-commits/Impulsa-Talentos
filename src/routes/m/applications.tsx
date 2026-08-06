import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { useApplicationsByCompany } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/m/applications')({ component: MobileApplications })
function MobileApplications() {
  const { user } = useAuth(); const { data: profile, isLoading: profileLoading } = useProfile(user?.id); const navigate = useNavigate(); const { t } = useI18n()
  useEffect(() => { if (!profileLoading && profile && profile.role !== 'employer' && profile.role !== 'admin') navigate({ to: '/m/home', replace: true }) }, [profileLoading, profile, navigate])
  const { data: company } = useCompany(user?.id); const { data: jobs } = useCompanyJobs(company?.id); const { data: applications, isLoading } = useApplicationsByCompany(jobs?.map(j => j.id))
  const titles = new Map((jobs ?? []).map(j => [j.id, j.title]))
  return <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc"><div className="px-4 pt-4 pb-4 space-y-3"><h1 className="font-serif text-xl font-bold">{t('nav.applications')}</h1>{isLoading ? <div className="h-24 rounded-xl bg-muted animate-pulse" /> : !applications?.length ? <p className="py-10 text-center text-sm text-muted-foreground">{t('applications.empty')}</p> : applications.map(a => <Link key={a.id} to="/m/jobs/$id" params={{ id: a.jobId }} className="block rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="font-semibold truncate">{titles.get(a.jobId) ?? ''}</p><p className="text-xs text-muted-foreground">{t('applications.candidate')}</p></div><Badge variant="outline">{t(`dashboard.status.${a.status}`)}</Badge></div></Link>)}</div></AuthGate>
}
