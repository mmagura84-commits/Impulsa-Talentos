import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useAllProfiles } from '@/hooks/useProfile'
import {
  useInterviewsByJob,
  useCreateInterview,
  useUpdateInterview,
  useCancelInterview,
  useScorecards,
  useSubmitScorecard,
} from '@/hooks/useInterviews'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  CalendarClock,
  Plus,
  MapPin,
  Video,
  Star,
  CheckCircle2,
  Ban,
  Pencil,
  MessageSquareText,
  AlertCircle,
} from 'lucide-react'
import type {
  Application,
  Interview,
  InterviewType,
  InterviewStatus,
  ScorecardRecommendation,
} from '@/types'

const INTERVIEW_TYPES: InterviewType[] = [
  'phone',
  'screening',
  'technical',
  'cultural',
  'final',
]

const RECOMMENDATIONS: ScorecardRecommendation[] = [
  'strong_yes',
  'yes',
  'maybe',
  'no',
  'strong_no',
]

interface InterviewsPanelProps {
  jobId: string
  companyId: string
  applications: Application[]
}

function extractCoverName(coverLetter: string | null | undefined): string {
  if (!coverLetter) return ''
  return coverLetter
    .replace(/\[Resume\]\s+\S+/i, '')
    .split('\n')[0]
    .trim()
    .slice(0, 60)
}

/** Format a datetime-local value into an ISO string for the API. */
function toIso(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

/** Convert an ISO timestamp to a value usable by <input type="datetime-local">. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function StatusBadge({ status }: { status: InterviewStatus }) {
  const { t } = useI18n()
  const map: Record<InterviewStatus, string> = {
    scheduled: 'border-blue-500/30 text-blue-700 bg-blue-500/5',
    completed: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
    cancelled: 'border-destructive/30 text-destructive bg-destructive/5',
    no_show: 'border-amber-500/30 text-amber-700 bg-amber-500/5',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status]}`}
    >
      {t(`interviews.status.${status}`)}
    </span>
  )
}

function ScorecardSection({ interview }: { interview: Interview }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: scorecards, isLoading } = useScorecards(interview.id)
  const submitScorecard = useSubmitScorecard()

  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState<number | null>(null)
  const [strengths, setStrengths] = useState('')
  const [concerns, setConcerns] = useState('')
  const [recommendation, setRecommendation] = useState<ScorecardRecommendation | null>(null)

  const reset = () => {
    setRating(null)
    setStrengths('')
    setConcerns('')
    setRecommendation(null)
    setShowForm(false)
  }

  const submit = async () => {
    if (!profile || rating == null || !recommendation) return
    try {
      await submitScorecard.mutateAsync({
        interviewId: interview.id,
        reviewerId: profile.id,
        overallRating: rating,
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        recommendation,
      })
      toast.success(t('interviews.scorecard.saved'), {
        description: t('interviews.scorecard.savedDesc'),
      })
      reset()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('interviews.scorecard.error'))
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <MessageSquareText className="size-3" /> {t('interviews.scorecard.title')}
        </p>
        {!showForm && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setShowForm(true)}>
            <Plus className="size-3" />
            {t('interviews.scorecard.add')}
          </Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('interviews.scorecard.overallRating')}</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating((r) => (r === n ? null : n))}
                  aria-label={`${n} / 5`}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    (rating ?? 0) >= n ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'
                  }`}
                >
                  <Star className={`size-5 ${(rating ?? 0) >= n ? 'fill-amber-400' : ''}`} />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('interviews.scorecard.recommendation')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {RECOMMENDATIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRecommendation(r)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    recommendation === r
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`interviews.scorecard.rec.${r}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`scorecard-strengths-${interview.id}`}>{t('interviews.scorecard.strengths')}</Label>
            <Textarea
              id={`scorecard-strengths-${interview.id}`}
              rows={2}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder={t('interviews.scorecard.strengthsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`scorecard-concerns-${interview.id}`}>{t('interviews.scorecard.concerns')}</Label>
            <Textarea
              id={`scorecard-concerns-${interview.id}`}
              rows={2}
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder={t('interviews.scorecard.concernsPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={submit}
              disabled={submitScorecard.isPending || rating == null || !recommendation}
              className="gap-1.5"
            >
              {submitScorecard.isPending ? t('interviews.scorecard.saving') : t('interviews.scorecard.submit')}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={submitScorecard.isPending}>
              {t('interviews.scorecard.cancel')}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground animate-pulse">{t('interviews.scorecard.loading')}</p>
      ) : !scorecards || scorecards.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t('interviews.scorecard.empty')}</p>
      ) : (
        <div className="space-y-2">
          {scorecards.map((sc) => (
            <div key={sc.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`size-3.5 ${i < sc.overallRating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
                    />
                  ))}
                </span>
                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {t(`interviews.scorecard.rec.${sc.recommendation}`)}
                </span>
              </div>
              {sc.strengths && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('interviews.scorecard.strengths')}</p>
                  <p className="text-xs text-foreground whitespace-pre-line">{sc.strengths}</p>
                </div>
              )}
              {sc.concerns && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('interviews.scorecard.concerns')}</p>
                  <p className="text-xs text-foreground whitespace-pre-line">{sc.concerns}</p>
                </div>
              )}
              {sc.submittedAt && (
                <p className="text-[10px] text-muted-foreground">
                  {new Date(sc.submittedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InterviewCard({
  interview,
  candidateName,
  companyId,
}: {
  interview: Interview
  candidateName: string
  companyId: string
}) {
  const { t } = useI18n()
  const updateInterview = useUpdateInterview()
  const cancelInterview = useCancelInterview()
  const [rescheduling, setRescheduling] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(interview.scheduledAt))
  const [pending, setPending] = useState(false)

  const doCancel = async () => {
    setPending(true)
    try {
      await cancelInterview.mutateAsync({ id: interview.id, companyId })
      toast.success(t('interviews.cancelled'), { description: t('interviews.cancelledDesc') })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('interviews.error'))
    } finally {
      setPending(false)
    }
  }

  const doComplete = async () => {
    setPending(true)
    try {
      await updateInterview.mutateAsync({ id: interview.id, data: { status: 'completed' } })
      toast.success(t('interviews.completed'), { description: t('interviews.completedDesc') })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('interviews.error'))
    } finally {
      setPending(false)
    }
  }

  const saveReschedule = async () => {
    const iso = toIso(scheduledAt)
    if (!iso) return
    setPending(true)
    try {
      await updateInterview.mutateAsync({ id: interview.id, data: { scheduledAt: iso } })
      toast.success(t('interviews.rescheduled'), { description: t('interviews.rescheduledDesc') })
      setRescheduling(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('interviews.error'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{candidateName}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <CalendarClock className="size-3" />
            {new Date(interview.scheduledAt).toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            <span>·</span>
            <Clock className="size-3" />
            {t('interviews.duration', { minutes: interview.durationMinutes })}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium">
              {t(`interviews.type.${interview.type}`)}
            </span>
            {interview.locationOrLink && (
              <span className="inline-flex items-center gap-1 truncate">
                {interview.locationOrLink.startsWith('http') ? (
                  <Video className="size-3 shrink-0" />
                ) : (
                  <MapPin className="size-3 shrink-0" />
                )}
                <span className="truncate">{interview.locationOrLink}</span>
              </span>
            )}
          </p>
        </div>
        <StatusBadge status={interview.status} />
      </div>

      {interview.notes && (
        <p className="text-xs text-muted-foreground whitespace-pre-line">{interview.notes}</p>
      )}

      {interview.status === 'scheduled' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => setRescheduling((v) => !v)}>
            <Pencil className="size-3" />
            {t('interviews.reschedule')}
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={doComplete} disabled={pending}>
            <CheckCircle2 className="size-3" />
            {t('interviews.complete')}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={doCancel} disabled={pending}>
            <Ban className="size-3" />
            {t('interviews.cancel')}
          </Button>
        </div>
      )}

      {rescheduling && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <Label htmlFor={`resched-${interview.id}`}>{t('interviews.dateTime')}</Label>
            <Input
              id={`resched-${interview.id}`}
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-52"
            />
          </div>
          <Button size="sm" onClick={saveReschedule} disabled={pending || !scheduledAt} className="gap-1.5">
            {pending ? t('interviews.saving') : t('interviews.save')}
          </Button>
        </div>
      )}

      {interview.status === 'completed' && <ScorecardSection interview={interview} />}
    </div>
  )
}

export function InterviewsPanel({ jobId, companyId, applications }: InterviewsPanelProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: allProfiles = [] } = useAllProfiles()
  const { data: interviews, isLoading, isError, refetch } = useInterviewsByJob(jobId)
  const createInterview = useCreateInterview()

  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of allProfiles) if (p.id) m[p.id] = p.fullName || p.email || p.id.slice(0, 8)
    return m
  }, [allProfiles])

  const candidateLabel = (candidateId: string, coverLetter: string | null | undefined) =>
    nameById[candidateId] || extractCoverName(coverLetter) || candidateId.slice(0, 8)

  // ── Create form state ──
  const [showCreate, setShowCreate] = useState(false)
  const [candidateId, setCandidateId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState('60')
  const [type, setType] = useState<InterviewType>('phone')
  const [locationOrLink, setLocationOrLink] = useState('')
  const [notes, setNotes] = useState('')

  const resetCreate = () => {
    setCandidateId('')
    setScheduledAt('')
    setDuration('60')
    setType('phone')
    setLocationOrLink('')
    setNotes('')
    setShowCreate(false)
  }

  const submitCreate = async () => {
    const iso = toIso(scheduledAt)
    const dur = Number.parseInt(duration, 10)
    if (!profile || !candidateId || !iso || !dur || dur <= 0) return
    try {
      await createInterview.mutateAsync({
        jobId,
        candidateId,
        companyId,
        scheduledAt: iso,
        durationMinutes: dur,
        type,
        locationOrLink: locationOrLink.trim() || undefined,
        notes: notes.trim() || undefined,
        createdBy: profile.id,
      })
      toast.success(t('interviews.scheduled'), { description: t('interviews.scheduledDesc') })
      resetCreate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('interviews.error'))
    }
  }

  const sorted = useMemo(
    () => [...(interviews ?? [])].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [interviews],
  )

  return (
    <Card className="overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <p className="font-serif text-base font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            {t('interviews.title')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('interviews.subtitle')}</p>
        </div>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 shrink-0">
            <Plus className="size-3.5" />
            {t('interviews.schedule')}
          </Button>
        )}
      </div>

      {showCreate && (
        <div className="p-4 sm:p-5 border-b border-border space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="interview-candidate">{t('interviews.candidate')}</Label>
            <select
              id="interview-candidate"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">{t('interviews.candidatePlaceholder')}</option>
              {applications.map((a) => (
                <option key={a.id} value={a.candidateId}>
                  {candidateLabel(a.candidateId, a.coverLetter)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="interview-datetime">{t('interviews.dateTime')}</Label>
              <Input
                id="interview-datetime"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-duration">{t('interviews.durationLabel')}</Label>
              <Input
                id="interview-duration"
                type="number"
                min={5}
                step={5}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('interviews.typeLabel')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {INTERVIEW_TYPES.map((ty) => (
                <button
                  key={ty}
                  type="button"
                  onClick={() => setType(ty)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    type === ty
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(`interviews.type.${ty}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interview-location">{t('interviews.locationOrLink')}</Label>
            <Input
              id="interview-location"
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              placeholder={t('interviews.locationPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="interview-notes">{t('interviews.notes')}</Label>
            <Textarea
              id="interview-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('interviews.notesPlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={submitCreate}
              disabled={createInterview.isPending || !candidateId || !scheduledAt || !duration}
              className="gap-1.5"
            >
              {createInterview.isPending ? t('interviews.saving') : t('interviews.scheduleSave')}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetCreate} disabled={createInterview.isPending}>
              {t('interviews.cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="py-8 text-center">
            <AlertCircle className="size-6 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t('interviews.loadError')}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('interviews.empty')}</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((iv) => (
              <InterviewCard
                key={iv.id}
                interview={iv}
                companyId={companyId}
                candidateName={candidateLabel(iv.candidateId, null)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
