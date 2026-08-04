import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfileById } from '@/hooks/useProfile'
import { useCompanyById } from '@/hooks/useCompanies'
import { useJobs, useJob as useJobRaw } from '@/hooks/useJobs'
import { useMyApplications, useWithdrawApplication } from '@/hooks/useApplications'
import { useMySavedJobs, useUnsaveJob } from '@/hooks/useSavedJobs'
import { useI18n } from '@/i18n/I18nProvider'
import { FadeIn, StatCard, formatSalary, formatPosted } from './shared'
import { rankJobs, type MatchScore } from '@/lib/matchScore'
import { useAiTopMatches } from '@/hooks/useAiMatching'
import { useProfileCompletion } from '@/hooks/useProfileCompletion'
import {
  Briefcase,
  FileText,
  Star,
  Clock,
  ArrowUpRight,
  Heart,
  Building2,
  Sparkles,
  Target,
  Activity,
  ChevronRight,
  Trash2,
  X,
  Brain,
  CheckCircle2,
  AlertCircle,
  Search,
  CalendarClock,
  ExternalLink,
} from 'lucide-react'
import type { Job, Application } from '@/types'

/* ── Match score pill ──────────────────────────────────── */
function MatchBadge({ score }: { score: number }) {
  const { t } = useI18n()
  const color =
    score >= 80
      ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
      : score >= 55
        ? 'border-primary/30 text-primary bg-primary/5'
        : 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
      title={t('dashboard.matches.matchScore')}
    >
      <Sparkles className="size-3" />
      {score}%
    </span>
  )
}

/* ── AI Match badge ────────────────────────────────────── */
function AiMatchBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
      : score >= 55
        ? 'border-primary/30 text-primary bg-primary/5'
        : 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
      title="AI-powered match score"
    >
      <Brain className="size-3" />
      {score}%
    </span>
  )
}

/* ── Job card (used in match / explore rows) ──────────── */
function JobCard({ job, score }: { job: Job; score?: MatchScore }) {
  const { locale, t } = useI18n()
  const showScore = score && score.total > 0
  return (
    <div className="group flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/30 hover:border-accent/50 transition-all duration-150">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm text-foreground truncate">{job.title}</h4>
          {showScore && <MatchBadge score={score!.total} />}
        </div>
        <p className="text-xs text-muted-foreground">{formatSalary(job, locale)}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" /> {formatPosted(job.createdAt, t)}
        </span>
        <Button variant="ghost" size="sm" className="h-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
          <Link to="/jobs/$id" params={{ id: job.id }}>{t('dashboard.view')}</Link>
        </Button>
      </div>
    </div>
  )
}

/* ── AI match detail card (expandable rationale) ────────── */
function AiMatchDetailCard({ result, job }: { result: NonNullable<ReturnType<typeof useAiTopMatches>['data']>[number]; job: Job }) {
  const [expanded, setExpanded] = useState(false)
  const { locale } = useI18n()
  const d = result.detail

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className={`flex items-center justify-center h-9 w-9 shrink-0 rounded-lg ${
          result.score >= 80 ? 'bg-emerald-500/10 text-emerald-600'
          : result.score >= 55 ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground'
        }`}>
          <Brain className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm text-foreground truncate">{job.title}</h4>
          <p className="text-xs text-muted-foreground">{formatSalary(job, locale)}</p>
        </div>
        <AiMatchBadge score={result.score} />
      </div>

      {/* Expandable detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border">
              <p className="text-xs text-muted-foreground leading-relaxed mt-3">{d.summary}</p>

              {/* Dimension bars */}
              <div className="mt-3 space-y-1.5">
                {[
                  { label: 'Skills', ...d.skillsFit },
                  { label: 'Language', ...d.languageFit },
                  { label: 'Experience', ...d.experienceFit },
                  { label: 'Location', ...d.locationFit },
                  { label: 'Culture', ...d.cultureFit },
                ].map(dim => (
                  <div key={dim.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-16 shrink-0">{dim.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          dim.score >= 80 ? 'bg-emerald-500' : dim.score >= 55 ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground w-7 text-right">{dim.score}</span>
                  </div>
                ))}
              </div>

              {/* Strengths + Gaps */}
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {d.strengths.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <CheckCircle2 className="size-3" /> Strengths
                    </p>
                    <ul className="space-y-0.5">
                      {d.strengths.map((s, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                          <span className="mt-1 h-1 w-1 rounded-full bg-emerald-500 shrink-0" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {d.gaps.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <AlertCircle className="size-3" /> Gaps
                    </p>
                    <ul className="space-y-0.5">
                      {d.gaps.map((g, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1">
                          <span className="mt-1 h-1 w-1 rounded-full bg-amber-500 shrink-0" />{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                <Button variant="outline" size="sm" asChild className="gap-1 text-xs">
                  <Link to="/jobs/$id" params={{ id: job.id }}>
                    View job <ChevronRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Application timeline item ─────────────────────────── */
const TIMELINE_STATUSES: Record<string, { step: number; color: string }> = {
  rejected: { step: -1, color: 'border-destructive text-destructive' },
  pending: { step: 0, color: 'border-muted-foreground text-muted-foreground' },
  reviewed: { step: 1, color: 'border-blue-500 text-blue-700' },
  interview: { step: 2, color: 'border-amber-500 text-amber-700' },
  offered: { step: 3, color: 'border-primary text-primary' },
  hired: { step: 4, color: 'border-emerald-500 text-emerald-700' },
}

export function ApplicationTimelineItem({ app, isLast, onWithdraw }: { app: Application; isLast: boolean; onWithdraw?: (id: string) => void }) {
  const { t, locale } = useI18n()
  const { data: job } = useJobRaw(app.jobId)
  const { data: company } = useCompanyById(job?.companyId)
  const ts = TIMELINE_STATUSES[app.status] ?? { step: 0, color: 'border-muted-foreground text-muted-foreground' }
  const stepLabels: Record<string, string> = {
    pending: t('timeline.step.submitted'),
    reviewed: t('timeline.step.reviewed'),
    interview: t('timeline.step.interview'),
    offered: t('timeline.step.offered'),
    hired: t('timeline.step.hired'),
    rejected: t('timeline.step.rejected'),
  }
  const isMutable = app.status === 'pending'

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className={`flex items-center justify-center h-5 w-5 rounded-full border-2 bg-card ${ts.color}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${app.status === 'hired' ? 'bg-emerald-500' : app.status === 'rejected' ? 'bg-destructive' : app.status === 'pending' ? 'bg-muted-foreground/40' : 'bg-current opacity-40'}`} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-[8px] bg-border" />}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {job?.title ?? t('dashboard.loadingJob')}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              {company?.name && (
                <><Building2 className="size-3" /> {company.name} <span className="mx-1">·</span></>
              )}
              {formatPosted(app.createdAt, t)}
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium bg-card ${ts.color}`}>
            {stepLabels[app.status] ?? app.status}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Link
            to="/jobs/$id"
            params={{ id: app.jobId }}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            View job <ChevronRight className="size-2.5 inline ml-0.5" />
          </Link>
          {isMutable && onWithdraw && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onWithdraw(app.id) }}
              className="text-[11px] text-muted-foreground hover:text-destructive underline underline-offset-2 cursor-pointer"
            >
              {t('timeline.withdraw')}
            </button>
          )}
        </div>
        {(app.interviewLink || app.interviewDate) && (
          <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
            <p className="font-medium text-amber-700 flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              {t('application.interview.title')}
            </p>
            {app.interviewDate && (
              <p className="mt-1 text-muted-foreground">
                {t('application.interview.date')}:{' '}
                {new Date(app.interviewDate).toLocaleString(locale === 'es' ? 'es-CO' : 'en-US', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </p>
            )}
            {app.interviewLink && (
              <a
                href={app.interviewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {t('application.interview.link')} <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Saved-jobs row ────────────────────────────────────── */
export function SavedJobRow({ job, candidateId }: { job: Job; candidateId: string }) {
  const { locale, t } = useI18n()
  const { data: company } = useCompanyById(job.companyId)
  const unsave = useUnsaveJob()
  const [confirming, setConfirming] = useState(false)

  const handleUnsave = async () => {
    try {
      await unsave.mutateAsync({ candidateId, jobId: job.id })
      toast.success(t('savedJobs.remove'), { duration: 1500 })
      setConfirming(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    }
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/30 hover:border-accent/50 transition-all duration-150 gap-3">
      <Link to="/jobs/$id" params={{ id: job.id }} className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600">
          <Heart className="size-4 fill-current" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm text-foreground truncate">{job.title}</h4>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="size-3" />
            {company?.name ?? t('jobDetail.confidential')}
            {' · '}
            {formatSalary(job, locale)}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden sm:inline-flex items-center text-[11px] text-muted-foreground gap-1">
          <Clock className="size-3" /> {formatPosted(job.createdAt, t)}
        </span>
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirming(true)} aria-label={t('savedJobs.remove')}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <AnimatePresence>
        {confirming && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setConfirming(false)} />
            <motion.div role="dialog" aria-modal="true"
              initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/10 text-pink-600">
                    <Heart className="size-4 fill-current" />
                  </div>
                  <h2 className="font-serif text-lg font-bold text-foreground">{t('savedJobs.removeConfirm')}</h2>
                </div>
                <button onClick={() => setConfirming(false)} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label={t('dashboard.confirmDeleteNo')}>
                  <X className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t('savedJobs.removeConfirmDesc')}</p>
              <p className="text-sm font-medium text-foreground line-clamp-2 mb-5">&ldquo;{job.title}&rdquo;</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)}>{t('dashboard.confirmDeleteNo')}</Button>
                <Button variant="destructive" onClick={handleUnsave} disabled={unsave.isPending} className="gap-2">
                  {unsave.isPending ? (
                    <><span className="inline-block size-3.5 rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground animate-spin" />{t('common.loading')}</>
                  ) : (
                    <><Trash2 className="size-3.5" />{t('savedJobs.remove')}</>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   Candidate (Employee) Dashboard
   ════════════════════════════════════════════════════════════ */
export function CandidateDashboard({ candidateProfileId }: { candidateProfileId: string }) {
  const { t } = useI18n()
  const { data: profile } = useProfileById(candidateProfileId)
  const { data: applications, isLoading: appsLoading } = useMyApplications(candidateProfileId)
  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const { data: savedJobs, isLoading: savedLoading } = useMySavedJobs(candidateProfileId)
  const withdraw = useWithdrawApplication()

  const handleWithdraw = async (appId: string) => {
    try {
      await withdraw.mutateAsync(appId)
      toast.success(t('timeline.withdrawn'), { duration: 1800 })
    } catch (err) {
      toast.error(t('timeline.withdrawError'), { description: err instanceof Error ? err.message : '' })
    }
  }

  const hasProfileSignal = !!(profile?.bio?.trim() || profile?.languages?.trim() || profile?.location?.trim())

  // Deterministic fast matches (for the card row)
  const ranked = useMemo(
    () => (hasProfileSignal ? rankJobs(profile ?? null, jobs ?? []) : []),
    [hasProfileSignal, profile, jobs],
  )
  const topMatches = ranked.slice(0, 3)
  const fallbackJobs = (jobs ?? []).slice(0, 3)

  // AI-powered deep matches
  const { data: aiMatches, isLoading: aiLoading } = useAiTopMatches(
    profile ?? null,
    jobs ?? null,
    3,
  )
  const hasAiMatches = aiMatches && aiMatches.length > 0

  const recentApps = (applications ?? []).slice(0, 5)
  const recentSaved = (savedJobs ?? []).slice(0, 3)

  // Enhanced profile completion
  const completion = useProfileCompletion(profile ?? null)

  return (
    <div className="space-y-6">
      {/* Profile completion bar */}
      {profile && completion.percent < 100 && (
        <FadeIn delay={0}>
          <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent">
            <CardContent className="pt-5 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex items-center justify-center h-9 w-9 shrink-0 rounded-full bg-amber-500/10 text-amber-600">
                    <Target className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('profileCompletion.title')} · {completion.percent}% ({completion.completed}/{completion.total})
                    </p>
                    <div className="mt-1.5 w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${completion.percent}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {completion.missingLabels.length > 0
                      ? t('profileCompletion.missingFields', {
                          fields: completion.missingLabels.slice(0, 2).join(', ') +
                            (completion.missingLabels.length > 2 ? '…' : ''),
                        })
                      : t('profileCompletion.allDone')}
                  </p>
                  <Button size="sm" variant="outline" asChild className="shrink-0">
                    <Link to="/profile">{t('profileCompletion.cta')}</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Stats row */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={FileText} label={t('dashboard.stat.applications')} value={String(applications?.length ?? 0)} delay={0} />
        <StatCard icon={Briefcase} label={t('dashboard.stat.matches')} value={String((jobs ?? []).filter(j => j.status === 'open').length)} delay={0.05} />
        <StatCard icon={Star} label={t('dashboard.stat.inProgress')}
          value={String((applications ?? []).filter(a => a.status === 'pending' || a.status === 'reviewed' || a.status === 'interview').length)}
          delay={0.1}
        />
      </div>

      {/* AI-Powered Best Matches (primary panel) */}
      {hasProfileSignal && (
        <FadeIn delay={0.08}>
          <Card className="border-primary/20 bg-gradient-to-b from-primary/[0.03] to-transparent">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary">
                    <Brain className="size-4" />
                  </div>
                  {t('dashboard.aiMatches.title')}
                </CardTitle>
                <CardDescription>{t('dashboard.aiMatches.desc')}</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/jobs">{t('dashboard.exploreMore')} <ArrowUpRight className="size-3 ml-1" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-14 rounded-lg bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              )}
              {!aiLoading && !hasAiMatches && (
                <div className="text-center py-6">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary/10 mb-3">
                    <Search className="size-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('dashboard.aiMatches.empty')}</p>
                  <Button size="sm" variant="outline" asChild className="mt-3">
                    <Link to="/jobs">{t('dashboard.viewJobs')}</Link>
                  </Button>
                </div>
              )}
              {hasAiMatches && aiMatches!.map((result, i) => {
                const job = jobs?.find(j => j.id === result.jobId)
                if (!job) return null
                return <AiMatchDetailCard key={result.jobId} result={result} job={job} />
              })}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Companies you match with */}
      {hasProfileSignal && hasAiMatches && (
        <FadeIn delay={0.1}>
          <Card className="border-accent/30 bg-gradient-to-b from-accent/[0.03] to-transparent">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-accent/10 text-accent">
                    <Building2 className="size-4" />
                  </div>
                  Companies you match with
                </CardTitle>
                <CardDescription>
                  Based on your profile, these companies have roles that fit your skills
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiMatches!.slice(0, 3).map((result) => {
                const job = jobs?.find(j => j.id === result.jobId)
                if (!job) return null
                return <CompanyMatchRow key={result.jobId} job={job} score={result.score} />
              })}
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Application timeline */}
      <FadeIn delay={0.12}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4 text-primary" />
                {t('timeline.title')}
              </CardTitle>
              <CardDescription>{t('dashboard.myApplications.desc')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/jobs">{t('dashboard.exploreMore')}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-0">
            {appsLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 rounded bg-muted animate-pulse" />
                ))}
              </div>
            )}
            {!appsLoading && recentApps.length === 0 && (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
                  <Activity className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">{t('timeline.empty')}</p>
                <Button size="sm" asChild className="mt-3">
                  <Link to="/jobs">{t('dashboard.viewJobs')}</Link>
                </Button>
              </div>
            )}
            {recentApps.map((app, i) => (
              <ApplicationTimelineItem key={app.id} app={app} isLast={i === recentApps.length - 1} onWithdraw={handleWithdraw} />
            ))}
            {(applications ?? []).length > 5 && (
              <div className="pt-2 text-center">
                <button type="button"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                  onClick={() => { document.querySelector('[data-tab="all-apps"]')?.scrollIntoView({ behavior: 'smooth' }) }}
                >
                  {t('timeline.viewAll')} ({applications?.length}) <ChevronRight className="size-3" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Deterministic match cards (compact row below timeline) */}
      <FadeIn delay={0.18}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                {hasProfileSignal ? t('dashboard.matches.title') : t('dashboard.matches.weakTitle')}
              </CardTitle>
              <CardDescription>
                {hasProfileSignal ? t('dashboard.matches.desc') : t('dashboard.matches.weakDesc')}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/jobs">{t('dashboard.exploreMore')} <ArrowUpRight className="size-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobsLoading && <div className="h-16 rounded bg-muted animate-pulse" />}
            {!jobsLoading && (jobs ?? []).length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">{t('dashboard.noJobs')}</p>
              </div>
            )}
            {!jobsLoading && hasProfileSignal && topMatches.length === 0 && (jobs ?? []).length > 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">{t('dashboard.matches.empty')}</p>
              </div>
            )}
            {(hasProfileSignal ? topMatches : fallbackJobs.map(j => ({ job: j, score: null as unknown as MatchScore }))).map(({ job, score }) => (
              <JobCard key={job.id} job={job} score={score ?? undefined} />
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Saved jobs */}
      <FadeIn delay={0.2}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="size-4 text-pink-600 fill-current" />
                {t('savedJobs.title')}
              </CardTitle>
              <CardDescription>{t('savedJobs.desc')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/jobs">{t('dashboard.exploreMore')} <ArrowUpRight className="size-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedLoading && <div className="h-16 rounded bg-muted animate-pulse" />}
            {!savedLoading && recentSaved.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">{t('savedJobs.empty')}</p>
                <Button size="sm" variant="outline" asChild className="mt-3">
                  <Link to="/jobs"><Heart className="size-3.5 mr-1.5" />{t('savedJobs.browse')}</Link>
                </Button>
              </div>
            )}
            {recentSaved.map(job => (
              <SavedJobRow key={job.id} job={job} candidateId={candidateProfileId} />
            ))}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

function CompanyMatchRow({ job, score }: { job: Job; score: number }) {
  const { data: company } = useCompanyById(job.companyId)
  const { t } = useI18n()
  if (!company) return null

  const matchColor = score >= 80 ? 'from-emerald-500/10 to-transparent border-emerald-500/20'
    : score >= 55 ? 'from-primary/5 to-transparent border-primary/20'
    : 'from-muted/30 to-transparent border-border'

  return (
    <Link
      to="/companies/$id"
      params={{ id: company.id }}
      className={`block rounded-lg border bg-gradient-to-r ${matchColor} p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary font-bold text-sm">
          {company.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{company.name}</p>
          <p className="text-xs text-muted-foreground">
            {[company.industry, company.location].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">
              <Sparkles className="size-2.5" /> {score}% match
            </span>
            {' '}via {job.title}
          </p>
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground shrink-0" />
      </div>
    </Link>
  )
}