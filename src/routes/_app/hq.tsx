import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthGate } from '@/components/AuthGate'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { useAuth, useIsAdmin } from '@/hooks/useAuth'
import { useAllProfiles, useUpdateProfile } from '@/hooks/useProfile'
import { useAllCompanies, useUpdateCompany } from '@/hooks/useCompanies'
import { useAllJobs, useUpdateJob, useCreateJob } from '@/hooks/useJobs'
import { useAllApplications, useUpdateApplicationStatus } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { ModerationTab } from '@/components/hq/ModerationTab'
import { listRows, updateRow } from '@/lib/supabase'
import type { Profile } from '@/types'
import { APPLICATION_STATUS_FLOW, STATUS_PILL_CLASSES } from '@/lib/applicationStatus'
import { MdApprovalsTab } from '@/components/hq/MdApprovalsTab'
import { CareScreeningTab } from '@/components/hq/CareScreeningTab'
import { CredentialApprovalsTab } from '@/components/hq/CredentialApprovalsTab'
import { CampaignsTab } from '@/components/hq/CampaignsTab'
import {
  LayoutDashboard,
  Users,
  Building2,
  Briefcase,
  FileText,
  TrendingUp,
  Clock,
  Star,
  Search,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Shield,
  ShieldOff,
  ShieldCheck,
  RefreshCw,
  BarChart3,
  Eye,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  HeartPulse,
  Megaphone,
} from 'lucide-react'
import type { Company, Job, Application } from '@/types'

export const Route = createFileRoute('/_app/hq')({
  component: HqPage,
})

/* ── Animation ─────────────────────────────────────────── */
function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Helpers ───────────────────────────────────────────── */
function timeAgo(iso: string): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Role badge colors (admin/employer/candidate) — not application statuses. */
const ROLE_BADGE_CLASSES: Record<string, string> = {
  admin: 'border-primary/30 text-primary bg-primary/5',
  employer: 'border-amber-500/30 text-amber-700 bg-amber-500/5',
  candidate: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
}
function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
    closed: 'border-destructive/30 text-destructive bg-destructive/5',
  }
  return `inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status] ?? STATUS_PILL_CLASSES[status as keyof typeof STATUS_PILL_CLASSES] ?? 'border-border text-muted-foreground'}` as string
}

function copyToClipboard(text: string, label: string) {
  if (typeof navigator === 'undefined') return
  navigator.clipboard.writeText(text).then(
    () => toast.success(label, { duration: 1500 }),
    () => toast.error('Could not copy'),
  )
}

function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) { toast.info('No data to export'); return }
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => JSON.stringify(String(r[h] ?? ''))).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/* ── KPI Card ───────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, hint, delay }: {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
  delay?: number
}) {
  return (
    <FadeIn delay={delay}>
      <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold text-foreground font-serif">{value}</p>
            </div>
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
          </div>
          {hint && <p className="mt-2 text-[10px] text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

/* ── Mini bar chart (CSS, no library dep) ──────────────── */
function MiniBar({ data, totalLabel }: { data: { label: string; value: number; color: string }[]; totalLabel?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 text-muted-foreground truncate">{d.label}</span>
          <div className="flex-1 h-4 rounded-sm bg-muted overflow-hidden">
            <div
              className={`h-full rounded-sm transition-all duration-500 ${d.color}`}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right font-mono text-muted-foreground">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Overview Tab ───────────────────────────────────────── */
function OverviewTab({
  profiles, companies, jobs, applications,
}: {
  profiles: Profile[]
  companies: Company[]
  jobs: Job[]
  applications: Application[]
}) {
  const { t } = useI18n()

  const openJobs = jobs.filter(j => j.status === 'open').length
  const hired = applications.filter(a => a.status === 'hired').length
  const conversion = applications.length > 0 ? ((hired / applications.length) * 100).toFixed(0) : '0'

  // Avg time-to-hire: earliest hired app created_at to hired status update
  const hiredApps = applications.filter(a => a.status === 'hired')
  const avgTTH = hiredApps.length > 0
    ? Math.round(
        hiredApps.reduce((sum, a) => {
          const created = new Date(a.createdAt).getTime()
          const updated = new Date(a.updatedAt).getTime()
          return sum + Math.max(0, (updated - created) / 86_400_000)
        }, 0) / hiredApps.length,
      )
    : 0

  // GMV: sum of salaryMax across all jobs (open only)
  const gmv = jobs
    .filter(j => j.status === 'open')
    .reduce((sum, j) => sum + (j.salaryMax || 0), 0)
  const gmvFmt = gmv > 1_000_000 ? `$${(gmv / 1_000_000).toFixed(1)}M` : `$${(gmv / 1_000).toFixed(0)}K`

  // Funnel (15-status pipeline)
  const funnelStatuses: Application['status'][] = ['applied', 'under_review', 'recruiter_screening', 'interview_scheduled', 'assessment_required', 'assessment_submitted', 'submitted_to_client', 'client_interview', 'final_interview', 'offer', 'hired']
  const funnelColor: Record<string, string> = {
    applied: 'bg-blue-500', under_review: 'bg-cyan-500', recruiter_screening: 'bg-indigo-500',
    interview_scheduled: 'bg-amber-500', assessment_required: 'bg-orange-500', assessment_submitted: 'bg-orange-500',
    submitted_to_client: 'bg-purple-500', client_interview: 'bg-purple-500', final_interview: 'bg-violet-500',
    offer: 'bg-pink-500', hired: 'bg-emerald-500',
  }
  const funnelData = funnelStatuses.map((status) => ({
    label: t(`dashboard.status.${status}`),
    value: applications.filter(a => a.status === status).length,
    color: funnelColor[status] ?? 'bg-muted-foreground/40',
  }))

  // By role
  const candidatesCount = profiles.filter(p => p.role === 'candidate').length
  const employersCount = profiles.filter(p => p.role === 'employer').length
  const adminsCount = profiles.filter(p => p.role === 'admin').length
  const roleData = [
    { label: 'Candidates', value: candidatesCount, color: 'bg-blue-500' },
    { label: 'Employers', value: employersCount, color: 'bg-amber-500' },
    { label: 'Admins', value: adminsCount, color: 'bg-primary' },
  ]

  // Jobs by status
  const jobStatusData = [
    { label: t('dashboard.jobStatus.open'), value: jobs.filter(j => j.status === 'open').length, color: 'bg-emerald-500' },
    { label: t('dashboard.jobStatus.closed'), value: jobs.filter(j => j.status === 'closed').length, color: 'bg-destructive' },
    { label: t('dashboard.jobStatus.draft'), value: jobs.filter(j => j.status === 'draft').length, color: 'bg-muted-foreground/40' },
  ]

  // Top skills
  const skillsMap = new Map<string, number>()
  jobs.forEach(j => {
    (j.skillsRequired || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean).forEach(s => {
      skillsMap.set(s, (skillsMap.get(s) ?? 0) + 1)
    })
  })
  const topSkills = [...skillsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const skillsData = topSkills.map(([label, value]) => ({ label, value, color: 'bg-chart-3' }))

  // Top languages
  const langsMap = new Map<string, number>()
  jobs.forEach(j => {
    (j.languagesRequired || '').split(/[,;|]/).map(s => s.trim()).filter(Boolean).forEach(s => {
      langsMap.set(s, (langsMap.get(s) ?? 0) + 1)
    })
  })
  const topLangs = [...langsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const langsData = topLangs.map(([label, value]) => ({ label, value, color: 'bg-chart-4' }))

  // Top companies by applications
  const appsByCompany = new Map<string, number>()
  applications.forEach(a => {
    const job = jobs.find(j => j.id === a.jobId)
    if (job) appsByCompany.set(job.companyId, (appsByCompany.get(job.companyId) ?? 0) + 1)
  })
  const topCosByApps = [...appsByCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cid, count]) => {
      const c = companies.find(co => co.id === cid)
      return { label: c?.name ?? cid.slice(0, 8), value: count, color: 'bg-chart-1' }
    })

  // Top companies by jobs
  const jobsByCompany = new Map<string, number>()
  jobs.forEach(j => jobsByCompany.set(j.companyId, (jobsByCompany.get(j.companyId) ?? 0) + 1))
  const topCosByJobs = [...jobsByCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cid, count]) => {
      const c = companies.find(co => co.id === cid)
      return { label: c?.name ?? cid.slice(0, 8), value: count, color: 'bg-chart-2' }
    })

  const refresh = () => { window.location.reload() }

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{t('hq.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('hq.subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
            <RefreshCw className="size-3.5" />
            {t('hq.refresh')}
          </Button>
        </div>
      </FadeIn>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard icon={Users} label={t('hq.kpi.users')} value={String(profiles.length)} hint={t('hq.kpi.usersHint')} delay={0} />
        <KpiCard icon={Building2} label={t('hq.kpi.companies')} value={String(companies.length)} hint={t('hq.kpi.companiesHint')} delay={0.02} />
        <KpiCard icon={Briefcase} label={t('hq.kpi.jobs')} value={String(jobs.length)} hint={`${jobs.filter(j => j.status === 'open').length} ${t('hq.kpi.jobsOpen')}`} delay={0.04} />
        <KpiCard icon={FileText} label={t('hq.kpi.applications')} value={String(applications.length)} hint={t('hq.kpi.applicationsHint')} delay={0.06} />
        <KpiCard icon={Star} label={t('hq.kpi.hires')} value={String(hired)} hint={t('hq.kpi.hiresHint')} delay={0.08} />
        <KpiCard icon={TrendingUp} label={t('hq.kpi.conversion')} value={`${conversion}%`} hint={t('hq.kpi.conversionHint')} delay={0.1} />
      </div>

      {/* Platform health */}
      <FadeIn delay={0.12}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              {t('hq.sections.platformHealth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Users by role */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('hq.chart.usersByRole')}</p>
                <MiniBar data={roleData} />
              </div>
              {/* Jobs by status */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('hq.chart.jobsByStatus')}</p>
                <MiniBar data={jobStatusData} />
              </div>
              {/* Applications funnel */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('hq.chart.applicationsByStatus')}</p>
                <MiniBar data={funnelData} />
              </div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Detail charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <FadeIn delay={0.15}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('hq.chart.topSkills')}</CardTitle>
            </CardHeader>
            <CardContent>
              {skillsData.length > 0 ? <MiniBar data={skillsData} /> : (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.table.empty')}</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.18}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('hq.chart.topLanguages')}</CardTitle>
            </CardHeader>
            <CardContent>
              {langsData.length > 0 ? <MiniBar data={langsData} /> : (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.table.empty')}</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.21}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('hq.chart.topCompaniesByApps')}</CardTitle>
            </CardHeader>
            <CardContent>
              {topCosByApps.length > 0 ? <MiniBar data={topCosByApps} /> : (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.table.empty')}</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={0.24}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('hq.chart.topCompaniesByJobs')}</CardTitle>
            </CardHeader>
            <CardContent>
              {topCosByJobs.length > 0 ? <MiniBar data={topCosByJobs} /> : (
                <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.table.empty')}</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* GMV + Time-to-hire */}
      <FadeIn delay={0.27}>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard icon={TrendingUp} label={t('hq.kpi.gmv')} value={gmvFmt} hint={t('hq.kpi.gmvHint')} />
          <KpiCard icon={Clock} label={t('hq.kpi.timeToHire')} value={avgTTH > 0 ? `${avgTTH} days` : '—'} hint={t('hq.kpi.timeToHireHint')} />
        </div>
      </FadeIn>
    </div>
  )
}

/* ── Directory Tables ──────────────────────────────────── */
function DataTable<T extends { id: string }>({
  title, desc, columns, rows, searchPlaceholder, onExport, exportLabel, renderRow, searchFields,
}: {
  title: string
  desc?: string
  columns: { key: string; label: string }[]
  rows: T[]
  searchPlaceholder: string
  onExport?: () => void
  exportLabel?: string
  renderRow: (row: T) => ReactNode
  searchFields: (keyof T)[]
}) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const s = search.toLowerCase()
    return rows.filter(r =>
      searchFields.some(f => String(r[f] ?? '').toLowerCase().includes(s)),
    )
  }, [rows, search, searchFields])

  const displayed = expanded ? filtered : filtered.slice(0, 15)

  return (
    <FadeIn delay={0.08}>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              {desc && <CardDescription>{desc}</CardDescription>}
              <p className="text-xs text-muted-foreground mt-1">{filtered.length} records</p>
            </div>
            <div className="flex items-center gap-2">
              {onExport && (
                <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
                  <Download className="size-3.5" />
                  {exportLabel ?? t('hq.action.exportCsv')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t('hq.table.empty')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {columns.map(c => (
                        <th key={c.key} className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(row => renderRow(row))}
                  </tbody>
                </table>
              </div>
              {filtered.length > 15 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(e => !e)}
                  className="mt-3 w-full gap-1"
                >
                  {expanded ? (
                    <><ChevronUp className="size-3.5" /> Show fewer</>
                  ) : (
                    <><ChevronDown className="size-3.5" /> Show all {filtered.length}</>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

/* ── Applications Tab ───────────────────────────────────── */
function ApplicationsTab({ applications, jobs, profiles }: {
  applications: Application[]
  jobs: Job[]
  profiles: Profile[]
}) {
  const { t } = useI18n()
  const updateStatus = useUpdateApplicationStatus()

  const cols = [
    { key: 'candidate', label: t('hq.table.col.candidate') },
    { key: 'job', label: t('hq.table.col.job') },
    { key: 'status', label: t('hq.table.col.status') },
    { key: 'submitted', label: t('hq.table.col.submitted') },
    { key: 'actions', label: t('hq.table.col.actions') },
  ]

  const handleStatusChange = async (id: string, newStatus: Application['status']) => {
    try {
      await updateStatus.mutateAsync({ id, status: newStatus })
      toast.success(t('manage.statusUpdated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('manage.statusError'))
    }
  }

  return (
    <DataTable
      title={t('hq.sections.applications')}
      rows={applications}
      columns={cols}
      searchPlaceholder={t('hq.table.searchPlaceholder')}
      searchFields={['id' as keyof Application]}
      onExport={() => exportCsv(applications.map(a => {
        const job = jobs.find(j => j.id === a.jobId)
        const profile = profiles.find(p => p.id === a.candidateId)
        return {
          id: a.id,
          candidate: profile?.fullName ?? a.candidateId,
          job: job?.title ?? a.jobId,
          status: a.status,
          submitted: a.createdAt,
        }
      }), 'applications')}
      renderRow={(app) => {
        const job = jobs.find(j => j.id === app.jobId)
        const profile = profiles.find(p => p.id === app.candidateId)
        return (
          <tr key={app.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
            <td className="py-2.5 px-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-xs">{profile?.fullName ?? app.candidateId.slice(0, 8)}</span>
              </div>
            </td>
            <td className="py-2.5 px-2">
              <Link to="/jobs/$id" params={{ id: app.jobId }} className="text-xs text-primary hover:underline">
                {job?.title?.slice(0, 40) ?? app.jobId.slice(0, 8)}
              </Link>
            </td>
            <td className="py-2.5 px-2">
              <select
                value={app.status}
                onChange={e => handleStatusChange(app.id, e.target.value as Application['status'])}
                className="h-7 rounded border border-border bg-background px-2 text-[11px] text-foreground outline-none focus-visible:border-ring"
              >
                {APPLICATION_STATUS_FLOW.map(s => (
                  <option key={s} value={s}>{t(`dashboard.status.${s}`)}</option>
                ))}
              </select>
            </td>
            <td className="py-2.5 px-2 text-xs text-muted-foreground">{timeAgo(app.createdAt)}</td>
            <td className="py-2.5 px-2">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => copyToClipboard(app.id, t('hq.action.copied'))}>
                <Copy className="size-3 mr-1" /> {t('hq.action.copyId')}
              </Button>
            </td>
          </tr>
        )
      }}
    />
  )
}

/* ── Jobs Tab ───────────────────────────────────────────── */
function JobsTab({ jobs, companies, applications }: {
  jobs: Job[]
  companies: Company[]
  applications: Application[]
}) {
  const { t } = useI18n()
  const updateJob = useUpdateJob()

  const cols = [
    { key: 'title', label: t('hq.table.col.title') },
    { key: 'company', label: t('hq.table.col.company') },
    { key: 'status', label: t('hq.table.col.status') },
    { key: 'applications', label: t('hq.table.col.applications') },
    { key: 'salary', label: t('hq.table.col.salary') },
    { key: 'actions', label: t('hq.table.col.actions') },
  ]

  const toggleStatus = async (job: Job) => {
    const next = job.status === 'open' ? 'closed' : 'open'
    try {
      await updateJob.mutateAsync({ id: job.id, data: { status: next as 'open' | 'closed' } })
      toast.success(next === 'open' ? t('hq.action.reopenJob') : t('hq.action.closeJob'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <DataTable
      title={t('hq.sections.jobs')}
      rows={jobs}
      columns={cols}
      searchPlaceholder={t('hq.table.searchPlaceholder')}
      searchFields={['title' as keyof Job, 'id' as keyof Job]}
      onExport={() => exportCsv(jobs.map(j => {
        const c = companies.find(co => co.id === j.companyId)
        return {
          id: j.id, title: j.title, company: c?.name ?? j.companyId,
          status: j.status, applications: applications.filter(a => a.jobId === j.id).length,
          salary: `${j.currency ?? 'COP'} ${j.salaryMin ?? '?'} - ${j.salaryMax ?? '?'}`,
          level: j.level, languages: j.languagesRequired, created: j.createdAt,
        }
      }), 'jobs')}
      renderRow={(job) => {
        const c = companies.find(co => co.id === job.companyId)
        const appCount = applications.filter(a => a.jobId === job.id).length
        return (
          <tr key={job.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
            <td className="py-2.5 px-2">
              <Link to="/jobs/$id" params={{ id: job.id }} className="text-xs font-medium text-foreground hover:text-primary">{job.title.slice(0, 50)}</Link>
            </td>
            <td className="py-2.5 px-2 text-xs text-muted-foreground">{c?.name ?? job.companyId.slice(0, 8)}</td>
            <td className="py-2.5 px-2">
              <span className={statusBadge(job.status)}>{job.status}</span>
              {job.moderationStatus === 'pending' && (
                <span className="ml-1.5 inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <Clock className="mr-1 size-3" />{t('job.moderation.pending')}
                </span>
              )}
              {job.moderationStatus === 'rejected' && (
                <span className="ml-1.5 inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                  {t('job.moderation.rejected')}
                </span>
              )}
            </td>
            <td className="py-2.5 px-2 text-xs text-muted-foreground">{appCount}</td>
            <td className="py-2.5 px-2 text-xs font-mono text-muted-foreground">{job.currency ?? 'COP'} {job.salaryMin ?? '?'}</td>
            <td className="py-2.5 px-2 flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => toggleStatus(job)} disabled={job.status === 'draft'}>
                {job.status === 'open' ? t('hq.action.closeJob') : t('hq.action.reopenJob')}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" asChild>
                <Link to="/jobs/$id" params={{ id: job.id }}>{t('hq.action.view')}</Link>
              </Button>
            </td>
          </tr>
        )
      }}
    />
  )
}

/* ── Companies Tab (with inline editing) ────────────────── */
function CompaniesTab({ companies, jobs }: { companies: Company[]; jobs: Job[] }) {
  const { t } = useI18n()
  const updateCompany = useUpdateCompany()
  const [editing, setEditing] = useState<Company | null>(null)
  const [editForm, setEditForm] = useState<Partial<Company>>({})

  const cols = [
    { key: 'name', label: t('hq.table.col.name') },
    { key: 'industry', label: t('hq.table.col.industry') },
    { key: 'size', label: t('hq.table.col.size') },
    { key: 'location', label: t('hq.table.col.location') },
    { key: 'contact', label: t('dashboard.stat.companyStatus') },
    { key: 'jobs', label: t('hq.table.col.applications') },
    { key: 'actions', label: t('hq.table.col.actions') },
  ]

  const handleSave = async () => {
    if (!editing) return
    try {
      await updateCompany.mutateAsync({ id: editing.id, data: editForm })
      toast.success('Company updated')
      setEditing(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <DataTable
        title={t('hq.sections.directory')}
        rows={companies}
        columns={cols}
        searchPlaceholder={t('hq.table.searchPlaceholder')}
        searchFields={['name' as keyof Company, 'industry' as keyof Company, 'location' as keyof Company]}
        onExport={() => exportCsv(companies.map(c => ({
          id: c.id, name: c.name, industry: c.industry, size: c.size,
          location: c.location, website: c.website, jobs: jobs.filter(j => j.companyId === c.id).length,
          contactEmail: (c as any).contactEmail ?? '',
        })), 'companies')}
        renderRow={(c) => {
          const jobCount = jobs.filter(j => j.companyId === c.id).length
          return (
            <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
              <td className="py-2.5 px-2">
                <span className="font-medium text-xs text-foreground">{c.name}</span>
                {(c as any).verificationRequested && !c.verified && (
                  <span className="ml-1.5 inline-flex rounded-full border border-amber-500/30 bg-amber-500/5 px-1.5 py-px text-[9px] font-medium text-amber-600">
                    {t('verification.requested')}
                  </span>
                )}
              </td>
              <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.industry ?? '—'}</td>
              <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.size ?? '—'}</td>
              <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.location ?? '—'}</td>
              <td className="py-2.5 px-2 text-xs text-muted-foreground">
                {(c as any).contactEmail ? (
                  <span className="text-emerald-600">✓ Configured</span>
                ) : (
                  <span className="text-amber-600">Not set</span>
                )}
              </td>
              <td className="py-2.5 px-2 text-xs text-muted-foreground">{jobCount}</td>
              <td className="py-2.5 px-2 flex items-center gap-1">
                {c.verified ? (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-600"
                    onClick={async () => {
                      try {
                        await updateCompany.mutateAsync({ id: c.id, data: { verified: false } })
                        toast.success(t('verification.unverifySuccess'))
                      } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
                    }}>
                    {t('verification.unverify')}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-7 text-[11px]"
                    onClick={async () => {
                      try {
                        await updateCompany.mutateAsync({ id: c.id, data: { verified: true, verificationRequested: false } })
                        toast.success(t('verification.verifySuccess'))
                      } catch (err) { toast.error(err instanceof Error ? err.message : String(err)) }
                    }}>
                    {t('verification.verify')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setEditing(c); setEditForm({ name: c.name, industry: c.industry, size: c.size, location: c.location, website: c.website, description: c.description, contactEmail: c.contactEmail ?? '' }) }}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => c.website ? window.open(c.website, '_blank') : copyToClipboard(c.id, t('hq.action.copied'))}>
                  {c.website ? <><Eye className="size-3 mr-1" /> {t('hq.action.view')}</> : <><Copy className="size-3 mr-1" /> {t('hq.action.copyId')}</>}
                </Button>
              </td>
            </tr>
          )
        }}
      />

      {/* Inline company editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(null)} />
          <div className="relative w-[min(92vw,32rem)] rounded-2xl border border-border bg-card p-6 shadow-2xl z-10 max-h-[70vh] overflow-y-auto">
            <h2 className="font-serif text-lg font-bold text-foreground mb-4">Edit: {editing.name}</h2>
            <div className="space-y-3">
              {(['name', 'industry', 'size', 'location', 'website', 'contactEmail', 'description'] as (keyof Company)[]).map(field => (
                <div key={field} className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{field}</label>
                  {field === 'description' ? (
                    <textarea
                      value={String(editForm[field] ?? '')}
                      onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-y outline-none focus-visible:border-ring"
                    />
                  ) : (
                    <Input
                      type={field === 'contactEmail' ? 'email' : 'text'}
                      value={String(editForm[field] ?? '')}
                      onChange={e => setEditForm(f => ({ ...f, [field]: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={updateCompany.isPending}>
                {updateCompany.isPending ? 'Saving...' : t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Post Job Tab (HQ admin posts for any company) ─────── */
function PostJobTab({ companies, jobs }: { companies: Company[]; jobs: Job[] }) {
  const { t } = useI18n()
  const createJob = useCreateJob()
  const updateJob = useUpdateJob()

  const [companyId, setCompanyId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [level, setLevel] = useState('')
  const [locationType, setLocationType] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [currency, setCurrency] = useState('COP')
  const [skills, setSkills] = useState('')
  const [languages, setLanguages] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const drafts = useMemo(() => jobs.filter(j => j.status === 'draft'), [jobs])

  const handlePublish = async (asDraft = false) => {
    if (!title.trim() || !companyId) {
      toast.error('Title and company are required')
      return
    }
    setSubmitting(true)
    try {
      await createJob.mutateAsync({
        companyId,
        title: title.trim(),
        description: description.trim() || 'No description provided.',
        level: level.trim() || '',
        locationType: locationType.trim() || 'Remote',
        salaryMin: Number(salaryMin) || 0,
        salaryMax: Number(salaryMax) || 0,
        currency: currency || 'COP',
        skillsRequired: skills.trim(),
        languagesRequired: languages.trim(),
        status: asDraft ? 'draft' : 'open',
      })
      toast.success(asDraft ? 'Draft saved' : 'Job published')
      if (!asDraft) {
        setTitle(''); setDescription(''); setLevel(''); setLocationType('')
        setSalaryMin(''); setSalaryMax(''); setSkills(''); setLanguages('')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublishDraft = async (jobId: string) => {
    try {
      await updateJob.mutateAsync({ id: jobId, data: { status: 'open' } })
      toast.success('Draft published')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post a new job</CardTitle>
            <CardDescription>Create a job listing for any registered company.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Company *</label>
                <select
                  value={companyId}
                  onChange={e => setCompanyId(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring"
                >
                  <option value="">Select company...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bilingual Full Stack Developer" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Level</label>
                <select value={level} onChange={e => setLevel(e.target.value)} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
                  <option value="">Any</option>
                  {['Junior', 'Mid-level', 'Senior', 'Lead', 'Manager'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Location / Modality</label>
                <select value={locationType} onChange={e => setLocationType(e.target.value)} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
                  <option value="">Select...</option>
                  {['Remote', 'Hybrid', 'On-site', 'Remote · Medellín', 'Hybrid · Bogotá'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Salary Min</label>
                <Input type="number" value={salaryMin} onChange={e => setSalaryMin(e.target.value)} placeholder="0" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Salary Max</label>
                <Input type="number" value={salaryMax} onChange={e => setSalaryMax(e.target.value)} placeholder="0" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring">
                  {['COP', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Skills (comma-separated)</label>
                <Input value={skills} onChange={e => setSkills(e.target.value)} placeholder="React, Node.js, AWS" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Languages</label>
                <Input value={languages} onChange={e => setLanguages(e.target.value)} placeholder="English B2, Spanish Native" className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the role, responsibilities, and requirements..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-y outline-none focus-visible:border-ring"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handlePublish(false)} disabled={submitting} className="gap-2 font-medium">
                {submitting ? 'Publishing...' : 'Publish Job'}
              </Button>
              <Button variant="outline" onClick={() => handlePublish(true)} disabled={submitting}>
                Save as draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Drafts */}
      {drafts.length > 0 && (
        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Drafts ({drafts.length})</CardTitle>
              <CardDescription>Unpublished jobs waiting for review.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Title</th>
                      <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Company</th>
                      <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map(d => {
                      const c = companies.find(co => co.id === d.companyId)
                      return (
                        <tr key={d.id} className="border-b border-border/60 hover:bg-muted/30">
                          <td className="py-2.5 px-2 text-xs font-medium">{d.title}</td>
                          <td className="py-2.5 px-2 text-xs text-muted-foreground">{c?.name ?? '—'}</td>
                          <td className="py-2.5 px-2 text-xs text-muted-foreground">{timeAgo(d.createdAt)}</td>
                          <td className="py-2.5 px-2">
                            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => handlePublishDraft(d.id)}>
                              Publish
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  )
}

/* ── Users Tab (with delegation / second-tier management) ─ */
function UsersTab({ profiles }: { profiles: Profile[] }) {
  const { t } = useI18n()
  const updateProfile = useUpdateProfile()
  const [confirm, setConfirm] = useState<{ id: string; action: 'promote' | 'demote' } | null>(null)

  const cols = [
    { key: 'name', label: t('hq.table.col.name') },
    { key: 'email', label: t('hq.table.col.email') },
    { key: 'role', label: t('hq.table.col.role') },
    { key: 'location', label: t('hq.table.col.location') },
    { key: 'languages', label: t('hq.table.col.languages') },
    { key: 'actions', label: t('hq.table.col.actions') },
  ]

  const handleRoleChange = async (id: string, newRole: Profile['role']) => {
    try {
      await updateProfile.mutateAsync({ id, data: { role: newRole } })
      toast.success(`Role changed to ${newRole}`)
      setConfirm(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <>
      <DataTable
        title={t('hq.sections.users')}
        rows={profiles}
        columns={cols}
        searchPlaceholder={t('hq.table.searchPlaceholder')}
        searchFields={['fullName' as keyof Profile, 'email' as keyof Profile, 'role' as keyof Profile]}
        onExport={() => exportCsv(profiles.map(p => ({
          id: p.id, name: p.fullName, email: p.email, role: p.role,
          location: p.location, languages: p.languages, created: p.createdAt,
        })), 'users')}
        renderRow={(p) => (
          <tr key={p.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
            <td className="py-2.5 px-2 font-medium text-xs text-foreground">{p.fullName ?? '—'}</td>
            <td className="py-2.5 px-2 text-xs text-muted-foreground">{p.email ?? '—'}</td>
            <td className="py-2.5 px-2">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ROLE_BADGE_CLASSES[p.role] ?? 'border-border text-muted-foreground'}`}>
                {p.role}
              </span>
            </td>
            <td className="py-2.5 px-2 text-xs text-muted-foreground">{p.location ?? '—'}</td>
            <td className="py-2.5 px-2 text-xs text-muted-foreground">{p.languages ?? '—'}</td>
            <td className="py-2.5 px-2 flex items-center gap-1">
              {p.role !== 'admin' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-primary"
                  onClick={() => setConfirm({ id: p.id, action: 'promote' })}
                >
                  <Shield className="size-3 mr-1" />
                  Make admin
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-destructive"
                  onClick={() => setConfirm({ id: p.id, action: 'demote' })}
                >
                  <ShieldOff className="size-3 mr-1" />
                  Remove admin
                </Button>
              )}
            </td>
          </tr>
        )}
      />

      {/* Confirmation dialog for role change */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative w-[min(92vw,24rem)] rounded-2xl border border-border bg-card p-6 shadow-2xl z-10">
            <h2 className="font-serif text-lg font-bold text-foreground mb-1">
              {confirm.action === 'promote' ? 'Promote to admin?' : 'Remove admin role?'}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {confirm.action === 'promote'
                ? 'This user will gain full access to the Headquarters dashboard and can manage all platform data. They will be able to promote or demote other users as admins.'
                : 'This user will be demoted to candidate. They will lose access to the Headquarters dashboard.'}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
              <Button
                variant={confirm.action === 'promote' ? 'default' : 'destructive'}
                onClick={() => handleRoleChange(confirm.id, confirm.action === 'promote' ? 'admin' : 'candidate')}
              >
                {confirm.action === 'promote' ? 'Promote' : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── No Access Fallback ──────────────────────────────────── */
function NoAccess() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-md w-full text-center border-border shadow-lg">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex items-center justify-center h-14 w-14 rounded-full bg-destructive/10 text-destructive">
            <ShieldOff className="size-7" />
          </div>
          <CardTitle className="font-serif text-xl">{t('hq.noAccess.title')}</CardTitle>
          <CardDescription>{t('hq.noAccess.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="gap-2 font-medium">
            <Link to="/dashboard">{t('hq.noAccess.cta')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ── Main HQ Shell ───────────────────────────────────────── */
type HqTab = 'overview' | 'applications' | 'jobs' | 'companies' | 'moderation' | 'users' | 'post' | 'mdApprovals' | 'careScreening' | 'credentialApprovals' | 'campaigns'

const TABS: { id: HqTab; labelKey: string; icon: React.ElementType }[] = [
  { id: 'overview', labelKey: 'hq.tab.overview', icon: BarChart3 },
  { id: 'applications', labelKey: 'hq.tab.applications', icon: FileText },
  { id: 'jobs', labelKey: 'hq.tab.jobs', icon: Briefcase },
  { id: 'companies', labelKey: 'hq.tab.companies', icon: Building2 },
  { id: 'moderation', labelKey: 'hq.tab.moderation', icon: ShieldCheck },
  { id: 'users', labelKey: 'hq.tab.users', icon: Users },
  { id: 'post', labelKey: 'postJob.step2.title', icon: PlusCircle },
  { id: 'mdApprovals', labelKey: 'hq.mdApprovals', icon: CheckCircle2 },
  { id: 'careScreening', labelKey: 'hq.careScreening', icon: HeartPulse },
  { id: 'credentialApprovals', labelKey: 'hq.cred.title', icon: ShieldCheck },
  { id: 'campaigns', labelKey: 'hq.campaigns', icon: Megaphone },
]

function HqShell() {
  const { t } = useI18n()
  const [tab, setTab] = useState<HqTab>('overview')

  const { data: profiles, isLoading: pLoading, isError: pErr } = useAllProfiles()
  const { data: companies, isLoading: cLoading, isError: cErr } = useAllCompanies()
  const { data: jobs, isLoading: jLoading, isError: jErr } = useAllJobs()
  const { data: applications, isLoading: aLoading, isError: aErr } = useAllApplications()

  const allLoaded = !pLoading && !cLoading && !jLoading && !aLoading
  const anyError = pErr || cErr || jErr || aErr

  if (pLoading || cLoading || jLoading || aLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted" />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if (anyError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle className="font-serif text-xl">{t('hq.error.title')}</CardTitle>
            <CardDescription>{t('hq.error.desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="size-4" /> {t('hq.refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const p = profiles ?? []
  const co = companies ?? []
  const j = jobs ?? []
  const a = applications ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Tab bar */}
      <FadeIn>
        <div className="flex flex-wrap items-center gap-1 mb-6 border-b border-border pb-3">
          {TABS.map(tb => {
            const isActive = tab === tb.id
            return (
              <button
                key={tb.id}
                type="button"
                onClick={() => setTab(tb.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
              >
                <tb.icon className="size-3.5" />
                {t(tb.labelKey)}
              </button>
            )
          })}
        </div>
      </FadeIn>

      {tab === 'overview' && <OverviewTab profiles={p} companies={co} jobs={j} applications={a} />}
      {tab === 'applications' && <ApplicationsTab applications={a} jobs={j} profiles={p} />}
      {tab === 'jobs' && <JobsTab jobs={j} companies={co} applications={a} />}
      {tab === 'companies' && <CompaniesTab companies={co} jobs={j} />}
      {tab === 'moderation' && <ModerationTab jobs={j} companies={co} />}
      {tab === 'users' && <UsersTab profiles={p} />}
      {tab === 'post' && <PostJobTab companies={co} jobs={j} />}
      {tab === 'mdApprovals' && <MdApprovalsTab />}
      {tab === 'careScreening' && <CareScreeningTab />}
      {tab === 'credentialApprovals' && <CredentialApprovalsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
    </div>
  )
}

/* ── Page Entry ─────────────────────────────────────────── */
function HqPage() {
  return (
    <AuthGate
      fallbackKey="auth.signInTitle"
      fallbackDescKey="auth.signInDescription"
    >
      <BlinkClientBoundary
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
          </div>
        }
      >
        <HqGate>
          <HqShell />
        </HqGate>
      </BlinkClientBoundary>
    </AuthGate>
  )
}

/** Final admin gate: if the user's profile is not admin, show no-access. */
function HqGate({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin()
  const { isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  if (!isAdmin) return <NoAccess />
  return <>{children}</>
}
