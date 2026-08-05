import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useAllProfiles } from '@/hooks/useProfile'
import { useAllJobs } from '@/hooks/useJobs'
import { useAllApplications } from '@/hooks/useApplications'
import { useAllCompanies } from '@/hooks/useCompanies'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LayoutDashboard, Megaphone, MessageSquare, Landmark, Users, Briefcase, FileText, Building2, TrendingUp, Printer } from 'lucide-react'
export const Route = createFileRoute('/_app/md/')({ component: MdDashboard })
function MdDashboard() {
 const { t } = useI18n(); const { user } = useAuth(); const { data: profile, isLoading } = useProfile(user?.id); const isMd = useIsMd(); const navigate = useNavigate()
 const { data: profiles=[] } = useAllProfiles(); const { data: jobs=[] } = useAllJobs(); const { data: applications=[] } = useAllApplications(); const { data: companies=[] } = useAllCompanies()
 useEffect(()=>{ if(!isLoading && !isMd) navigate({to:'/dashboard',replace:true}) },[isLoading,isMd,navigate])
 const nav=[['/md',LayoutDashboard,'md.nav.dashboard'],['/md/marketing',Megaphone,'md.nav.marketing'],['/md/messages',MessageSquare,'md.nav.messages'],['/md/banking',Landmark,'md.nav.banking']]
 const candidates=profiles.filter(p=>p.role==='candidate').length, employers=profiles.filter(p=>p.role==='employer').length, openJobs=jobs.filter(j=>j.status==='open').length
 const monthStart=new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
 const monthJobs=jobs.filter(j=>j.createdAt && new Date(j.createdAt)>=monthStart && j.status==='open').length
 const activeEmployers=new Set(jobs.filter(j=>j.status==='open').map(j=>j.employerId)).size
 const leads = (()=>{ try { return Number(sessionStorage.getItem('impulsa_leads_count')||0) } catch { return 0 } })()
 const stats=[[Users,candidates,'Candidates'],[Building2,employers,'Employers'],[Briefcase,openJobs,'Open jobs'],[FileText,applications.length,'Applications'],[TrendingUp,leads,'Employer leads'],[Briefcase,monthJobs,'Jobs this month']]
 return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-6xl p-6 print:p-0"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">{t('md.welcome')}</p><h1 className="text-3xl font-bold">{t('md.title')}</h1></div><Button variant="outline" className="gap-2 print:hidden" onClick={()=>window.print()}><Printer className="size-4"/>Generate Report</Button></div>{profile?.profileStatus==='pending' ? <Card className="mt-8 border-amber-500/30"><CardHeader><CardTitle>{t('md.pendingTitle')}</CardTitle></CardHeader><CardContent className="text-muted-foreground">{t('md.pendingDesc')}</CardContent></Card> : <><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stats.map(([Icon,value,label])=><Card key={String(label)}><CardContent className="flex items-center gap-4 p-5"><Icon className="size-7 text-primary"/><div><p className="text-2xl font-bold">{String(value)}</p><p className="text-sm text-muted-foreground">{label}</p></div></CardContent></Card>)}</div><div className="mt-6 grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Employer pipeline</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p>Employers with active jobs <strong>{activeEmployers}</strong></p><p>Estimated monthly revenue <strong>${activeEmployers*2*49}</strong></p><p>Open roles across {companies.length} companies <strong>{openJobs}</strong></p></CardContent></Card><Card><CardHeader><CardTitle>Workspace</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{nav.map(([to,Icon,key])=><Link key={String(to)} to={to as any} className="rounded-xl border bg-card p-4 hover:border-primary"><Icon className="size-5 text-primary"/><p className="mt-2 text-sm font-medium">{t(String(key))}</p></Link>)}</CardContent></Card></div></>}</main></AuthGate>
}
