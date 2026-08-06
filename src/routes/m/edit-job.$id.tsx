import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useJob } from '@/hooks/useJobs'
import { useI18n } from '@/i18n/I18nProvider'

export const Route = createFileRoute('/m/edit-job/$id')({ component: MobileEditJob })
function MobileEditJob() {
  const { id } = useParams({ from: '/m/edit-job/$id' }); const { user } = useAuth(); const { data: profile, isLoading: profileLoading } = useProfile(user?.id); const { data: company } = useCompany(user?.id); const { data: job, isLoading } = useJob(id); const navigate = useNavigate(); const { t } = useI18n()
  useEffect(() => {
    if (profileLoading || isLoading) return
    if (!profile || (profile.role !== 'employer' && profile.role !== 'admin')) { navigate({ to: '/m/home', replace: true }); return }
    if (!job || !company || job.companyId !== company.id) navigate({ to: '/m/home', replace: true })
    else navigate({ to: '/employer/edit-job/$id', params: { id }, replace: true })
  }, [profileLoading, isLoading, profile, company, job, id, navigate])
  return <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc"><div className="px-4 pt-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div></AuthGate>
}
