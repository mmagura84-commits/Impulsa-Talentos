import { createFileRoute } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { useApplicationsByCompany } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { BarChart3, Briefcase, Users, CheckCircle2 } from 'lucide-react'
export const Route = createFileRoute('/_app/employer/analytics')({ component: EmployerAnalytics })
function EmployerAnalytics() {
 const { user }=useAuth(); const {data:company}=useCompany(user?.id); const {data:jobs,isLoading}=useCompanyJobs(company?.id); const {data:apps,isLoading:appsLoading}=useApplicationsByCompany(jobs?.map(j=>j.id)); const {t}=useI18n(); const all=apps??[]
 const stats=[['analytics.activeJobs',String((jobs??[]).filter(j=>j.status==='open').length),Briefcase],['analytics.totalApplicants',String(all.length),Users],['analytics.interviews',String(all.filter(a=>a.status==='interview_scheduled').length),BarChart3],['analytics.hires',String(all.filter(a=>a.status==='hired').length),CheckCircle2]] as const
 return <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc"><div className="p-6 max-w-5xl mx-auto space-y-6"><div><h1 className="font-serif text-2xl font-bold flex items-center gap-2"><BarChart3 className="size-6 text-primary"/>{t('nav.analytics')}</h1><p className="text-muted-foreground mt-1">{t('analytics.subtitle')}</p></div>{isLoading||appsLoading?<div className="h-32 rounded bg-muted animate-pulse"/>:<><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label,value,Icon])=><Card key={label}><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground flex items-center justify-between">{t(label)}<Icon className="size-4 text-primary"/></CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{value}</p></CardContent></Card>)}</div><Card><CardHeader><CardTitle className="text-base">{t('analytics.byJob')}</CardTitle></CardHeader><CardContent className="space-y-3">{(jobs??[]).map(j=><div key={j.id} className="flex justify-between border-b pb-2 text-sm"><span className="truncate">{j.title}</span><span className="text-muted-foreground">{all.filter(a=>a.jobId===j.id).length}</span></div>)}</CardContent></Card></>}</div></AuthGate>
}
