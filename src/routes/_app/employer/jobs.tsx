import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Briefcase, Plus, Eye, Users, Pencil } from 'lucide-react'

export const Route = createFileRoute('/_app/employer/jobs')({
  component: EmployerJobsPage,
})

/** Employer workspace — full list of the employer's own job postings. */
function EmployerJobsPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const navigate = useNavigate()
  useEffect(() => {
    if (profile && profile.role !== 'employer') navigate({ to: '/dashboard', replace: true })
  }, [profile, navigate])
  const { t } = useI18n()
  const { data: company, isLoading: companyLoading } = useCompany(user?.id)
  const { data: jobs, isLoading: jobsLoading } = useCompanyJobs(company?.id)
  const myJobs = (jobs ?? []).filter((j) => j.companyId === company?.id)

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="size-7 text-primary" />
              {t('nav.myJobs')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {company ? t('dashboard.employerJobs.descWithName', { company: company.name }) : t('dashboard.employerJobs.descNoCompany')}
            </p>
          </div>
          <Button asChild className="gap-1.5">
            <Link to="/employer/post-job"><Plus className="size-4" />{t('dashboard.newJob')}</Link>
          </Button>
        </div>

        {!company && !companyLoading && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground mb-4">{t('dashboard.registerCompanyDesc')}</p>
              <Button asChild variant="outline" className="gap-1.5">
                <Link to="/employer/post-job"><Plus className="size-3.5" />{t('dashboard.registerCompany')}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {company && jobsLoading && <div className="h-24 rounded bg-muted animate-pulse" />}

        {company && !jobsLoading && myJobs.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">{t('dashboard.employerJobs.empty')}</p>
            </CardContent>
          </Card>
        )}

        {company && myJobs.map(job => (
          <Card key={job.id} className="mb-3">
            <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <Link to="/jobs/$id" params={{ id: job.id }} className="text-sm font-medium hover:text-primary transition-colors">
                  {job.title}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center gap-1 text-xs ${
                    job.status === 'open' ? 'text-emerald-600' : job.status === 'closed' ? 'text-muted-foreground' : 'text-amber-600'
                  }`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                      job.status === 'open' ? 'bg-emerald-500' : job.status === 'closed' ? 'bg-muted-foreground' : 'bg-amber-500'
                    }`} />
                    {job.status}
                  </span>
                  {job.moderationStatus === 'pending' && (
                    <span className="text-xs text-amber-600">· {t('moderation.pending')}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <Link to="/employer/manage/$id" params={{ id: job.id }}><Users className="size-3.5" />{t('dashboard.manage')}</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <Link to="/employer/edit-job/$id" params={{ id: job.id }}><Pencil className="size-3.5" />{t('common.edit')}</Link>
                </Button>
                <Button variant="ghost" size="sm" asChild className="gap-1.5">
                  <Link to="/jobs/$id" params={{ id: job.id }}><Eye className="size-3.5" />{t('common.view')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AuthGate>
  )
}
