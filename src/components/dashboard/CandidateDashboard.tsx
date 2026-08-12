import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfileById } from '@/hooks/useProfile'
import { useCompanyById } from '@/hooks/useCompanies'
import { useJobs, useJob as useJobRaw } from '@/hooks/useJobs'
import { useMyApplications, useWithdrawApplication, useApplicationStatusHistory } from '@/hooks/useApplications'
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
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
  Brain,
  CheckCircle2,
  AlertCircle,
  Search,
  CalendarClock,
  ExternalLink,
  UserCheck,
  History,
  AlarmClock,
  MessageSquare,
} from 'lucide-react'
import type { Job, Application } from '@/types'
import { CandidateMessenger } from '@/components/messaging/CandidateMessenger'

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
  not_selected:     { step: -1, color: 'border-destructive text-destructive' },
  position_closed:  { step: -1, color: 'border-muted-foreground text-muted-foreground' },
  withdrawn:        { step: -1, color: 'border-destructive text-destructive' },
  draft:            { step: 0,  color: 'border-muted-foreground/50 text-muted-foreground/60' },
  applied:          { step: 1,  color: 'border-blue-500 text-blue-700' },
  under_review:     { step: 2,  color: 'border-blue-500 text-blue-700' },
  recruiter_screening:  { step: 3,  color: 'border-indigo-500 text-indigo-700' },
  interview_scheduled:  { step: 4,  color: 'border-amber-500 text-amber-700' },
  assessment_required:  { step: 5,  color: 'border-amber-500 text-amber-700' },
  assessment_submitted: { step: 6,  color: 'border-amber-500 text-amber-700' },
  submitted_to_client:  { step: 7,  color: 'border-purple-500 text-purple-700' },
  client_interview:     { step: 8,  color: 'border-purple-500 text-purple-700' },
  final_interview:      { step: 9,  color: 'border-purple-500 text-purple-700' },
  offer:            { step: 10, color: 'border-primary text-primary' },
  hired:            { step: 11, color: 'border-emerald-500 text-emerald-700' },
}

export function ApplicationTimelineItem({ app, isLast, onWithdraw }: { app: Application; isLast: boolean; onWithdraw?: (id: string) => void }) {
  const { t, locale } = useI18n()
  const { data: job } = useJobRaw(app.jobId)
  const { data: company } = useCompanyById(job?.companyId)
  const { data: recruiter } = useProfileById(app.recruiterId)
  const { data: statusHistory } = useApplicationStatusHistory(app.id)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [messengerOpen, setMessengerOpen] = useState(false)
  const ts = TIMELINE_STATUSES[app.status] ?? { step: 0, color: 'border-muted-foreground text-muted-foreground' }
  const stepLabels: Record<string, string> = {
    draft: t('timeline.step.draft'),
    applied: t('timeline.step.applied'),
    under_review: t('timeline.step.underReview'),
    recruiter_screening: t('timeline.step.recruiterScreening'),
    interview_scheduled: t('timeline.step.interviewScheduled'),
    assessment_required: t('timeline.step.assessmentRequired'),
    assessment_submitted: t('timeline.step.assessmentSubmitted'),
    submitted_to_client: t('timeline.step.submittedToClient'),
    client_interview: t('timeline.step.clientInterview'),
    final_interview: t('timeline.step.finalInterview'),
    offer: t('timeline.step.offered'),
    hired: t('timeline.step.hired'),
    not_selected: t('timeline.step.notSelected'),
    position_closed: t('timeline.step.positionClosed'),
    withdrawn: t('timeline.step.withdrawn'),
  }
  const mutableStatuses = new Set(['draft', 'applied', 'under_review', 'recruiter_screening'])
  const isMutable = mutableStatuses.has(app.status)
  const hasNextAction = !!(app.nextAction?.trim())
  const historyStatusLabel = (s: string) => stepLabels[s] ?? s

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <div className={`flex items-center justify-center h-5 w-5 rounded-full border-2 bg-card ${ts.color}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${app.status === 'hired' ? 'bg-emerald-500' : app.status === 'not_selected' || app.status === 'withdrawn' ? 'bg-destructive' : app.status === 'draft' ? 'bg-muted-foreground/30' : app.status === 'applied' ? 'bg-blue-500' : 'bg-current opacity-40'}`} />
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

        {/* Recruiter info */}
        {recruiter && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <UserCheck className="size-3.5 shrink-0" />
            <span>{t('timeline.recruiter')}: {recruiter.fullName || recruiter.email}</span>
          </div>
        )}

        <div className="mt-2 flex items-center gap-3">
          <Link
            to="/jobs/$id"
            params={{ id: app.jobId }}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            View job <ChevronRight className="size-2.5 inline ml-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => setMessengerOpen(!messengerOpen)}
            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
          >
            <MessageSquare className="size-3" />
            {messengerOpen ? t('messenger.close') : t('messenger.open')}
          </button>
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

        {/* Messenger (expandable inline) */}
        <AnimatePresence>
          {messengerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3">
                <CandidateMessenger applicationId={app.id} candidateId={app.candidateId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Next Action Required widget */}
        {hasNextAction && (
          <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <AlarmClock className="size-3.5" />
              {t('timeline.nextActionRequired')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{app.nextAction}</p>
            {app.nextActionDue && (
              <p className="mt-1 text-[11px] text-amber-600">
                {t('timeline.dueDate')}: {new Date(app.nextActionDue).toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', { dateStyle: 'medium' })}
              </p>
            )}
            <div className="mt-2">
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 border-amber-500/30 text-amber-700 hover:bg-amber-500/10">
                {t('timeline.takeAction')} <ExternalLink className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Interview card */}
        {(app.interviewLink || app.interviewDate) && (
          <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
            <p className="font-medium text-amber-700 flex items-center gap-1.5">
              <CalendarClock className="size-3.5" />
              {t('application.interview.title')}
            </p>
            {app.interviewDate && (
              <p className="mt-1 text-muted-foreground">
                {t('application.interview.date')}:{' '}
                {new Date(app.interviewDate).toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', {
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

        {/* Expandable status history */}
        {statusHistory && statusHistory.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <History className="size-3" />
              {t('timeline.statusHistory')} ({statusHistory.length})
              {historyOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
            <AnimatePresence>
              {historyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1.5 pl-1 border-l-2 border-muted">
                    {statusHistory.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-2 text-xs pl-3">
                        <span className={`shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full ${TIMELINE_STATUSES[entry.status]?.color?.replace(/border-|text-/g, 'bg-').replace(/\s.*$/, '') || 'bg-muted-foreground'}`} />
                        <div className="min-w-0">
                          <span className="font-medium text-foreground">{historyStatusLabel(entry.status)}</span>
                          {entry.note && <span className="text-muted-foreground"> — {entry.note}</span>}
                          <span className="block text-[10px] text-muted-foreground/70">
                            {new Date(entry.createdAt).toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', { dateStyle: 'medium' })}
                            {entry.changedBy && ` · ${entry.changedBy}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
          <Link to="/jobs/$id" params={{ id: job.id }}>{t('savedJobs.apply')}</Link>
        </Button>
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
  const completion = useProfileCompletion(profile ?? null)
  const hasProfileSignal = !!(profile?.bio?.trim() || profile?.languages?.trim() || profile?.location?.trim())
  const ranked = useMemo(() => hasProfileSignal ? rankJobs(profile ?? null, jobs ?? []) : [], [hasProfileSignal, profile, jobs])
  const fallbackJobs = (jobs ?? []).filter(j => j.status === 'open').slice(0, 5)
  const { data: aiMatches, isLoading: aiLoading } = useAiTopMatches(candidateProfileId, hasProfileSignal)
  const recentApps = (applications ?? []).slice(0, 5)
  const recentSaved = (savedJobs ?? []).slice(0, 3)
  const handleWithdraw = async (appId: string) => {
    try { await withdraw.mutateAsync({ id: appId }); toast.success(t('timeline.withdrawn'), { duration: 1800 }) }
    catch (err) { toast.error(t('timeline.withdrawError'), { description: err instanceof Error ? err.message : '' }) }
  }
  const aiJobs = (aiMatches ?? []).map(result => ({ job: jobs?.find(j => j.id === result.jobId), score: result.score })).filter(x => x.job).slice(0, 5) as { job: Job; score: number }[]
  const matches = aiJobs.length ? aiJobs : ranked.slice(0, 5)
  return (
    <div className="space-y-6">
      {completion.percent < 100 && <FadeIn delay={0.04}><Card className="border-amber-500/20"><CardContent className="p-4"><div className="flex flex-wrap items-center gap-3"><Target className="size-5 text-amber-500"/><div className="min-w-0 flex-1"><p className="text-sm font-medium">{t('profileCompletion.title')} · {completion.percent}%</p><div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-amber-500" style={{width:`${completion.percent}%`}}/></div><p className="mt-1 text-xs text-muted-foreground">{completion.missingLabels.slice(0,2).join(', ')}</p></div><Button size="sm" variant="outline" asChild><Link to="/profile">{t('profileCompletion.cta')}</Link></Button></div></CardContent></Card></FadeIn>}
      <div className="grid sm:grid-cols-3 gap-4"><StatCard icon={Briefcase} label={t('dashboard.stat.matches')} value={String((jobs ?? []).filter(j => j.status === 'open').length)} delay={0} accent="gold"/><StatCard icon={FileText} label={t('dashboard.stat.applications')} value={String(applications?.length ?? 0)} delay={0.05} accent="gold"/><StatCard icon={Star} label={t('dashboard.stat.inProgress')} value={String((applications ?? []).filter(a => !['hired','not_selected','position_closed','withdrawn'].includes(a.status)).length)} delay={0.1} accent="gold"/></div>
      <FadeIn delay={0.08}><Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base flex items-center gap-2"><Sparkles className="size-4 text-primary"/>{t('dashboard.matches.title')}</CardTitle><CardDescription>{hasProfileSignal ? t('dashboard.matches.desc') : t('dashboard.matches.weakDesc')}</CardDescription></div><Button variant="outline" size="sm" asChild><Link to="/jobs">{t('dashboard.exploreMore')}</Link></Button></CardHeader><CardContent className="space-y-2">{jobsLoading || aiLoading ? <div className="h-16 rounded bg-muted animate-pulse"/> : !matches.length ? <div className="py-6 text-center text-sm text-muted-foreground">{t('dashboard.matches.weakDesc')}<br/><Button size="sm" variant="outline" className="mt-3" asChild><Link to="/profile">{t('profileCompletion.cta')}</Link></Button></div> : matches.map(({job,score})=><JobCard key={job.id} job={job} score={typeof score === 'number' ? (score as unknown as MatchScore) : undefined}/>)}</CardContent></Card></FadeIn>
      <FadeIn delay={0.12}><Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base flex items-center gap-2"><Activity className="size-4 text-primary"/>{t('timeline.title')}</CardTitle><CardDescription>{t('dashboard.myApplications.desc')}</CardDescription></div><Button variant="outline" size="sm" asChild><Link to="/jobs">{t('dashboard.viewJobs')}</Link></Button></CardHeader><CardContent>{appsLoading ? <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-12 rounded bg-muted animate-pulse"/>)}</div> : !recentApps.length ? <div className="py-6 text-center text-sm text-muted-foreground">{t('timeline.empty')}<br/><Button size="sm" className="mt-3" asChild><Link to="/jobs">{t('dashboard.viewJobs')}</Link></Button></div> : <>{recentApps.map((app,i)=><ApplicationTimelineItem key={app.id} app={app} isLast={i===recentApps.length-1} onWithdraw={handleWithdraw}/>)}{(applications?.length ?? 0)>5 && <Link className="block pt-2 text-center text-xs text-primary hover:underline" to="/candidate/applications">{t('timeline.viewAll')} ({applications?.length})</Link>}</>}</CardContent></Card></FadeIn>
      <FadeIn delay={0.16}><Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base flex items-center gap-2"><Heart className="size-4 text-pink-600 fill-current"/>{t('savedJobs.title')}</CardTitle><CardDescription>{t('savedJobs.desc')}</CardDescription></div><Button variant="outline" size="sm" asChild><Link to="/jobs">{t('savedJobs.browse')}</Link></Button></CardHeader><CardContent className="space-y-2">{savedLoading ? <div className="h-16 rounded bg-muted animate-pulse"/> : !recentSaved.length ? <div className="py-6 text-center text-sm text-muted-foreground">{t('savedJobs.empty')}<br/><Button size="sm" variant="outline" className="mt-3" asChild><Link to="/jobs">{t('savedJobs.browse')}</Link></Button></div> : recentSaved.map(job=><SavedJobRow key={job.id} job={job} candidateId={candidateProfileId}/>)}</CardContent></Card></FadeIn>
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