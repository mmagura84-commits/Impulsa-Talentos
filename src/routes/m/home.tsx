import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState, useRef, type ReactNode } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  Briefcase,
  Heart,
  ArrowUpRight,
  PlusCircle,
  FileText,
  TrendingUp,
  X,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs, useJobs, useDeleteJob } from '@/hooks/useJobs'
import { useMyApplications } from '@/hooks/useApplications'
import { useMySavedJobs, useUnsaveJob } from '@/hooks/useSavedJobs'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { rankJobs, type MatchScore } from '@/lib/matchScore'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Job, Application } from '@/types'

export const Route = createFileRoute('/m/home')({
  head: () => ({ meta: [{ title: 'Home — Impulsa (mobile)' }] }),
  component: MobileHome,
})

function formatSalary(job: Job, locale: 'en' | 'es'): string {
  if (!job.salaryMin && !job.salaryMax) return '—'
  const ccy = job.currency || 'COP'
  const min = job.salaryMin ? job.salaryMin.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const max = job.salaryMax ? job.salaryMax.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US') : '?'
  return `${ccy} $${min} - $${max}`
}

function formatPosted(iso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (!iso) return t('time.recent')
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return t('time.today')
  if (days === 1) return t('time.yesterday')
  if (days < 7) return t('time.daysAgo', { n: days })
  if (days < 30) return t('time.weeksAgo', { n: Math.floor(days / 7) })
  return t('time.monthsAgo', { n: Math.floor(days / 30) })
}

function MobileHome() {
  const { user, isLoading, login } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { t, locale } = useI18n()

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-4 pt-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
          <Sparkles className="size-7 text-primary" />
        </div>
        <p className="text-base font-bold text-foreground">{t('mobile.authRequired')}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('mobile.authRequiredDesc')}
        </p>
        <Button onClick={login} size="lg" className="mt-4 w-full">
          {t('mobile.authRequiredCta')}
        </Button>
      </div>
    )
  }

  const role = profile?.role ?? 'candidate'
  return role === 'employer' ? <EmployerHome /> : <CandidateHome />
}

/* ── Candidate home (applications + saved + matches) ──────── */
function CandidateHome() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: applications, isLoading: appsLoading } = useMyApplications(profile?.id)
  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const { data: savedJobs, isLoading: savedLoading } = useMySavedJobs(profile?.id)
  const { t, locale } = useI18n()

  const hasProfileSignal = !!(
    profile?.bio?.trim() || profile?.languages?.trim() || profile?.location?.trim()
  )
  const ranked = useMemo(
    () => (hasProfileSignal ? rankJobs(profile ?? null, jobs ?? []) : []),
    [hasProfileSignal, profile, jobs],
  )
  const topMatches = ranked.slice(0, 3)
  const fallbackJobs = (jobs ?? []).slice(0, 3)
  const recentApps = (applications ?? []).slice(0, 3)
  const recentSaved = (savedJobs ?? []).slice(0, 3)

  return (
    <div className="px-4 pt-4 pb-2 space-y-4">
      {/* Stats */}
      <FadeIn>
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label={t('dashboard.stat.applications')}
            value={String(applications?.length ?? 0)}
            icon={FileText}
          />
          <StatTile
            label={t('dashboard.stat.matches')}
            value={String((jobs ?? []).length)}
            icon={Briefcase}
          />
          <StatTile
            label={t('dashboard.stat.inProgress')}
            value={String(
              (applications ?? []).filter(a =>
                a.status === 'pending' || a.status === 'reviewed' || a.status === 'interview',
              ).length,
            )}
            icon={TrendingUp}
          />
        </div>
      </FadeIn>

      {/* Recent applications */}
      <FadeIn delay={0.04}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">{t('dashboard.myApplications.title')}</CardTitle>
            <Link to="/m/saved" className="text-[11px] font-medium text-primary">
              {t('dashboard.view')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {appsLoading && <div className="h-10 rounded bg-muted animate-pulse" />}
            {!appsLoading && recentApps.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                {t('dashboard.noApplications')}
              </p>
            )}
            {recentApps.map(app => (
              <AppListItem key={app.id} app={app} />
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Saved */}
      <FadeIn delay={0.08}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Heart className="size-3.5 text-pink-600 fill-current" /> {t('savedJobs.title')}
            </CardTitle>
            <Link to="/m/saved" className="text-[11px] font-medium text-primary">
              {t('dashboard.view')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedLoading && <div className="h-10 rounded bg-muted animate-pulse" />}
            {!savedLoading && recentSaved.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                {t('savedJobs.empty')}
              </p>
            )}
            {recentSaved.map(job => (
              <SavedJobRow key={job.id} job={job} candidateId={profile!.id} />
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Top matches */}
      <FadeIn delay={0.12}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> {t('dashboard.matches.title')}
            </CardTitle>
            <Link to="/m/jobs" className="text-[11px] font-medium text-primary">
              {t('dashboard.viewJobs')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobsLoading && <div className="h-10 rounded bg-muted animate-pulse" />}
            {!jobsLoading && (jobs ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                {t('dashboard.noJobs')}
              </p>
            )}
            {(hasProfileSignal ? topMatches : fallbackJobs.map(j => ({ job: j, score: null as unknown as MatchScore }))).map(({ job, score }) => (
              <JobRow key={job.id} job={job} score={score ?? undefined} />
            ))}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

/* ── Employer home (active jobs + delete) ─────────────────── */
function EmployerHome() {
  const { user } = useAuth()
  const { data: company } = useCompany(user?.id)
  const { data: jobs, isLoading } = useCompanyJobs(company?.id)
  const postedJobs = jobs ?? []
  const { t, locale } = useI18n()
  const deleteJob = useDeleteJob()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="px-4 pt-4 pb-2 space-y-4">
      <FadeIn>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label={t('dashboard.stat.activeJobs')}
            value={String(postedJobs.filter(j => j.status === 'open').length)}
            icon={Briefcase}
          />
          <StatTile
            label={t('dashboard.stat.totalJobs')}
            value={String(postedJobs.length)}
            icon={FileText}
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.04}>
        <Button asChild size="lg" className="w-full h-12 font-semibold gap-2">
          <Link to="/m/post">
            <PlusCircle className="size-4" /> {t('dashboard.newJob')}
          </Link>
        </Button>
      </FadeIn>

      <FadeIn delay={0.08}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">{t('dashboard.employerJobs.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading && <div className="h-10 rounded bg-muted animate-pulse" />}
            {!isLoading && postedJobs.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground">{t('dashboard.noEmployerJobs')}</p>
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to="/m/post">{t('dashboard.firstJob')}</Link>
                </Button>
              </div>
            )}
            {postedJobs.map(job => (
              <div
                key={job.id}
                className="flex items-center gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {formatSalary(job, locale)} · {formatPosted(job.createdAt, t)}
                  </p>
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    job.status === 'open'
                      ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
                      : job.status === 'closed'
                        ? 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
                        : 'border-amber-500/30 text-amber-700 bg-amber-500/5',
                  )}
                >
                  {job.status === 'open'
                    ? t('dashboard.jobStatus.open')
                    : job.status === 'closed'
                      ? t('dashboard.jobStatus.closed')
                      : t('dashboard.jobStatus.draft')}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setConfirmId(job.id)}
                  className="shrink-0 h-8 w-8 text-muted-foreground active:text-destructive"
                  aria-label={t('dashboard.delete')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      <AnimatePresence>
        {confirmId && (
          <ConfirmDialog
            title={t('dashboard.confirmDelete')}
            description={t('dashboard.confirmDeleteDesc')}
            confirmLabel={t('dashboard.confirmDeleteYes')}
            cancelLabel={t('dashboard.confirmDeleteNo')}
            destructive
            onCancel={() => setConfirmId(null)}
            onConfirm={async () => {
              try {
                await deleteJob.mutateAsync(confirmId)
                toast.success(t('dashboard.jobDeleted'))
              } catch (err) {
                toast.error(t('dashboard.jobDeleteError'), {
                  description: err instanceof Error ? err.message : '',
                })
              }
              setConfirmId(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="size-3.5 text-primary" />
      </div>
      <p className="mt-1.5 text-2xl font-bold text-foreground font-serif">
        {value}
      </p>
    </div>
  )
}

function AppListItem({ app }: { app: Application }) {
  const { t } = useI18n()
  const { data: job } = useJobs()
  const jobRow = (job ?? []).find(j => j.id === app.jobId)
  const statusColor: Record<Application['status'], string> = {
    pending: 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
    reviewed: 'border-blue-500/30 text-blue-700 bg-blue-500/5',
    interview: 'border-amber-500/30 text-amber-700 bg-amber-500/5',
    offered: 'border-primary/30 text-primary bg-primary/5',
    hired: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
    rejected: 'border-destructive/30 text-destructive bg-destructive/5',
  }
  return (
    <Link
      to="/m/jobs/$id"
      params={{ id: app.jobId }}
      className="flex items-center gap-2 active:bg-accent/30 rounded-md -mx-1 px-1 py-1"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground truncate">
          {jobRow?.title ?? t('dashboard.loadingJob')}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatPosted(app.createdAt, t)}
        </p>
      </div>
      <span
        className={cn(
          'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
          statusColor[app.status],
        )}
      >
        {t(`dashboard.status.${app.status}`)}
      </span>
    </Link>
  )
}

function SavedJobRow({ job, candidateId }: { job: Job; candidateId: string }) {
  const { t, locale } = useI18n()
  const unsave = useUnsaveJob()
  const ccy = job.currency || 'COP'
  const salary =
    job.salaryMin && job.salaryMax
      ? `${job.salaryMin.toLocaleString()}-${job.salaryMax.toLocaleString()} ${ccy}`
      : t('jobs.salaryTBD')
  return (
    <Link
      to="/m/jobs/$id"
      params={{ id: job.id }}
      className="flex items-center gap-2 active:bg-accent/30 rounded-md -mx-1 px-1 py-1"
    >
      <Heart className="size-4 text-pink-600 fill-current shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground truncate">{job.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {formatLocationType(job.locationType, t)} · {salary}
        </p>
      </div>
      <button
        type="button"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          unsave.mutate({ candidateId, jobId: job.id })
        }}
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground active:text-destructive"
        aria-label={t('savedJobs.unsave')}
      >
        <X className="size-3.5" />
      </button>
    </Link>
  )
}

function JobRow({ job, score }: { job: Job; score?: MatchScore }) {
  const { t, locale } = useI18n()
  return (
    <Link
      to="/m/jobs/$id"
      params={{ id: job.id }}
      className="flex items-center gap-2 active:bg-accent/30 rounded-md -mx-1 px-1 py-1"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-foreground truncate">{job.title}</p>
          {score && score.total > 0 && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
                score.total >= 80
                  ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
                  : score.total >= 55
                    ? 'border-primary/30 text-primary bg-primary/5'
                    : 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
              )}
            >
              <Sparkles className="size-2.5" /> {score.total}%
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          {formatLocationType(job.locationType, t)} · {formatPosted(job.createdAt, t)}
        </p>
      </div>
      <ArrowUpRight className="size-3.5 text-muted-foreground shrink-0" />
    </Link>
  )
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,20rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </motion.div>
    </>
  )
}

function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
