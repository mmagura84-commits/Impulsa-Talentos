/**
 * Employer analytics (Gap 10) — per-job hiring pipeline metrics and charts.
 * All data is computed client-side from existing Supabase queries.
 */
import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Clock, Gauge, Users } from 'lucide-react'
import { useAllProfiles } from '@/hooks/useProfile'
import { scoreMatch } from '@/lib/matchScore'
import { useI18n } from '@/i18n/I18nProvider'
import type { Job, Application } from '@/types'

const STATUSES = ['pending', 'reviewed', 'interview', 'offered', 'hired', 'rejected'] as const
const STATUS_COLORS: Record<string, string> = {
  pending: '#94a3b8',
  reviewed: '#3b82f6',
  interview: '#f59e0b',
  offered: '#8b5cf6',
  hired: '#10b981',
  rejected: '#ef4444',
}

export function JobAnalytics({ job, applications }: { job: Job; applications: Application[] }) {
  const { t, locale } = useI18n()
  const { data: profiles } = useAllProfiles()

  const profileById = useMemo(
    () => new Map((profiles ?? []).map(p => [p.id, p])),
    [profiles],
  )

  /* Match scores — only for applications whose candidate profile we can load. */
  const scores = useMemo(
    () =>
      applications
        .map(a => {
          const p = profileById.get(a.candidateId)
          return p ? scoreMatch(p, job).total : null
        })
        .filter((s): s is number => s !== null),
    [applications, profileById, job],
  )
  const avgScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0

  /* Time to first application (hours between posting and first applicant). */
  const timeToFirstHours = useMemo(() => {
    if (applications.length === 0) return null
    const jobTime = new Date(job.createdAt).getTime()
    const firstTime = Math.min(
      ...applications.map(a => new Date(a.createdAt).getTime()),
    )
    return Math.max(0, Math.round((firstTime - jobTime) / 36e5))
  }, [applications, job.createdAt])

  /* Applications per day, last 30 days. */
  const daily = useMemo(() => {
    const out: { day: string; iso: string; count: number }[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      out.push({
        iso: d.toISOString().slice(0, 10),
        day: d.toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
          month: 'short',
          day: 'numeric',
        }),
        count: 0,
      })
    }
    for (const a of applications) {
      const key = new Date(a.createdAt).toISOString().slice(0, 10)
      const row = out.find(r => r.iso === key)
      if (row) row.count++
    }
    return out
  }, [applications, locale])

  /* Status breakdown for the donut. */
  const statusData = useMemo(
    () =>
      STATUSES.map(s => ({
        status: s,
        name: t(`dashboard.status.${s}`),
        value: applications.filter(a => a.status === s).length,
      })).filter(d => d.value > 0),
    [applications, t],
  )

  /* Match score distribution buckets. */
  const bucketData = useMemo(() => {
    const bounds = [0, 20, 40, 60, 80]
    return bounds.map(b => {
      const top = b === 80 ? 100 : b + 19
      return {
        range: `${b}-${top}`,
        count: scores.filter(s => s >= b && s <= top).length,
      }
    })
  }, [scores])

  const maxStatus = Math.max(1, ...statusData.map(d => d.value))
  const funnel = STATUSES.filter(s => s !== 'rejected').map(s => ({
    status: s,
    count: applications.filter(a => a.status === s).length,
    label: t(`dashboard.status.${s}`),
  }))

  const total = applications.length

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          {t('manage.analytics.title')}
        </CardTitle>
        <CardDescription>{t('manage.analytics.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metric row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Users className="size-3" /> {t('manage.total')}
            </p>
            <p className="text-2xl font-bold font-serif text-foreground mt-1">{total}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Gauge className="size-3" /> {t('manage.analytics.avgScore')}
            </p>
            <p className="text-2xl font-bold font-serif text-foreground mt-1">
              {scores.length ? `${avgScore}%` : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="size-3" /> {t('manage.analytics.timeToFirst')}
            </p>
            <p className="text-2xl font-bold font-serif text-foreground mt-1">
              {timeToFirstHours === null
                ? '—'
                : timeToFirstHours < 24
                  ? t('manage.analytics.hours', { n: String(timeToFirstHours) })
                  : t('manage.analytics.days', { n: String(Math.round(timeToFirstHours / 24)) })}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Clock className="size-3" /> {t('manage.analytics.interviews')}
            </p>
            <p className="text-2xl font-bold font-serif text-foreground mt-1">
              {applications.filter(a => a.status === 'interview').length}
            </p>
          </div>
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t('manage.analytics.noData')}
          </p>
        ) : (
          <>
            {/* Charts */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-foreground mb-3">{t('manage.analytics.overTime')}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} stroke="#94a3b8" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="count" stroke="#1d4ed8" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-semibold text-foreground mb-3">{t('manage.analytics.byStatus')}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusData.map(d => (
                        <Cell key={d.name} fill={STATUS_COLORS[d.status] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-foreground mb-3">{t('manage.analytics.matchDist')}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={bucketData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Conversion funnel */}
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs font-semibold text-foreground mb-3">{t('manage.analytics.funnel')}</p>
              <div className="space-y-2">
                {funnel.map(f => (
                  <div key={f.status} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{f.label}</span>
                    <div className="flex-1 h-5 rounded-md bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${(f.count / maxStatus) * 100}%`,
                          backgroundColor: STATUS_COLORS[f.status],
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-medium text-foreground">{f.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
