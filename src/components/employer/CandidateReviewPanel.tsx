import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n/I18nProvider'
import { useUpdateApplication } from '@/hooks/useApplications'
import { useProfileById } from '@/hooks/useProfile'
import { useSignedStorageUrl } from '@/hooks/useSignedStorageUrl'
import { scoreMatch, type MatchScore } from '@/lib/matchScore'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  User,
  FileText,
  Eye,
  ExternalLink,
  MapPin,
  Clock,
  Briefcase,
  Lock,
  Sparkles,
  Languages,
  GraduationCap,
  CalendarClock,
  Globe,
  Heart,
  ShieldCheck,
  Banknote,
  CircleAlert,
} from 'lucide-react'
import type { Application, Job, Profile } from '@/types'

/* ── Helpers ─────────────────────────────────────────── */
function splitList(s: string | null | undefined): string[] {
  if (!s) return []
  return s
    .split(/[,;|]/)
    .map(x => x.trim())
    .filter(Boolean)
}

function extractResumePointer(coverLetter: string | null | undefined): string | null {
  if (!coverLetter) return null
  const m = coverLetter.match(/\[Resume\]\s+(\S+)/i)
  return m ? m[1] : null
}

/** Match-score dimension caps (weights) from src/lib/matchScore.ts. */
const SCORE_DIMS: { key: keyof Omit<MatchScore, 'total' | 'rationale'>; max: number }[] = [
  { key: 'skills', max: 50 },
  { key: 'language', max: 20 },
  { key: 'seniority', max: 15 },
  { key: 'modality', max: 10 },
  { key: 'location', max: 5 },
  { key: 'title', max: 5 },
]

function scoreColor(total: number): string {
  if (total >= 80) return 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
  if (total >= 55) return 'border-primary/30 text-primary bg-primary/5'
  return 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 55) return 'bg-primary'
  return 'bg-muted-foreground/30'
}

function formatDate(value: string, locale: 'en' | 'es'): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/* ── Profile snapshot ────────────────────────────────── */
function ProfileSnapshot({ profile, loading }: { profile: Profile | null; loading: boolean }) {
  const { t, locale } = useI18n()
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        <div className="h-3 w-40 rounded bg-muted animate-pulse" />
        <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      </div>
    )
  }
  if (!profile) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-dashed border-border p-3">
        <CircleAlert className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">{t('review.noProfile')}</p>
      </div>
    )
  }
  const skills = profile.skills ?? []
  const languages = splitList(profile.languages)
  const empStatus = profile.employmentStatus
    ? t(`review.empStatus.${profile.employmentStatus}`)
    : null
  const empPref = profile.employmentPreference
    ? t(`review.empPref.${profile.employmentPreference}`)
    : null
  // Structured rows — only fields the candidate actually provided.
  const rows: { icon: typeof MapPin; label: string; value: string | null }[] = [
    { icon: MapPin, label: t('review.location'), value: profile.location?.trim() || null },
    { icon: Clock, label: t('review.timezone'), value: profile.timezone?.trim() || null },
    { icon: Briefcase, label: t('review.desiredRole'), value: profile.desiredRole?.trim() || null },
    {
      icon: GraduationCap,
      label: t('review.experienceYears'),
      value: profile.experienceYears != null
        ? profile.experienceYears === 1
          ? t('review.experienceYearsOne')
          : t('review.experienceYearsMany', { count: profile.experienceYears })
        : null,
    },
    { icon: Heart, label: t('review.employmentStatus'), value: empStatus },
    { icon: CalendarClock, label: t('review.availabilityDate'), value: profile.availabilityDate ? formatDate(profile.availabilityDate, locale) : null },
    { icon: Briefcase, label: t('review.employmentPreference'), value: empPref },
    {
      icon: MapPin,
      label: t('review.willingToRelocate'),
      value: profile.willingToRelocate == null ? null : profile.willingToRelocate ? t('review.yes') : t('review.no'),
    },
    { icon: ShieldCheck, label: t('review.workAuthorization'), value: profile.workAuthorization?.trim() || null },
    { icon: Globe, label: t('review.portfolio'), value: profile.portfolioUrl?.trim() || null },
    { icon: Languages, label: t('review.preferredLanguage'), value: profile.preferredLanguage || null },
    { icon: Banknote, label: t('review.currencyPreference'), value: profile.currencyPreference?.trim() || null },
  ].filter(r => r.value != null && r.value.length > 0)
  return (
    <div className="space-y-3">
      {profile.headline?.trim() && (
        <p className="text-xs font-medium text-foreground">{profile.headline.trim()}</p>
      )}
      {profile.bio?.trim() && (
        <p className="text-xs text-muted-foreground leading-relaxed">{profile.bio.trim()}</p>
      )}
      {skills.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            {t('review.skills')}
          </p>
          <div className="flex flex-wrap gap-1">
            {skills.map(s => (
              <span
                key={s}
                className="inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {languages.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            {t('review.languages')}
          </p>
          <p className="text-xs text-foreground">{languages.join(' · ')}</p>
        </div>
      )}
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          {rows.map(r => {
            const Icon = r.icon
            const isLink = r.label === t('review.portfolio') && r.value?.startsWith('http')
            return (
              <div key={r.label} className="contents">
                <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3 shrink-0" />
                  {r.label}
                </dt>
                <dd className="text-xs text-foreground break-words">
                  {isLink ? (
                    <a
                      href={r.value!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {r.value}
                      <ExternalLink className="size-2.5 shrink-0" />
                    </a>
                  ) : (
                    r.value
                  )}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
      {rows.length === 0 && skills.length === 0 && languages.length === 0 && !profile.bio?.trim() && (
        <p className="text-xs text-muted-foreground italic">{t('review.notProvided')}</p>
      )}
    </div>
  )
}

/* ── CV preview ──────────────────────────────────────── */
function CvPreview({ app, profile }: { app: Application; profile: Profile | null }) {
  const { t } = useI18n()
  const resumePointer = extractResumePointer(app.coverLetter) ?? profile?.cvUrl ?? null
  const resumeUrl = useSignedStorageUrl(resumePointer)
  if (!resumeUrl) {
    return (
      <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
        <FileText className="size-3.5 shrink-0" />
        {t('review.noCv')}
      </p>
    )
  }
  return (
    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
      <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
        <Eye className="size-3.5" />
        {t('review.openCv')}
        <ExternalLink className="size-3" />
      </a>
    </Button>
  )
}

/* ── Match score ─────────────────────────────────────── */
function MatchScoreSection({ profile, job }: { profile: Profile | null; job: Job }) {
  const { t } = useI18n()
  const hasSignal = !!(
    profile?.bio?.trim() ||
    profile?.languages?.trim() ||
    profile?.location?.trim() ||
    (profile?.skills && profile.skills.length > 0)
  )
  const score = useMemo<MatchScore | null>(
    () => (hasSignal && profile ? scoreMatch(profile, job) : null),
    [hasSignal, profile, job],
  )
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="size-3" />
          {t('review.matchTitle')}
        </p>
        {score && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${scoreColor(score.total)}`}
          >
            <Sparkles className="size-3" />
            {score.total}%
          </span>
        )}
      </div>
      {!score ? (
        <p className="text-xs text-muted-foreground">{t('review.matchNone')}</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground mb-2">{t('review.matchDesc')}</p>
          <div className="space-y-1.5">
            {SCORE_DIMS.map(dim => {
              const raw = score[dim.key] as number
              const pct = Math.min(100, Math.round((raw / dim.max) * 100))
              return (
                <div key={dim.key} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                    {t(`review.matchDim.${dim.key}`)}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-foreground w-12 text-right tabular-nums">
                    {raw}/{dim.max}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Shortlist + notes (migration 023 wired) ──────────── */
function ShortlistAndNotes({ app }: { app: Application }) {
  const { t } = useI18n()
  const update = useUpdateApplication()
  const [notes, setNotes] = useState(app.notes ?? '')
  // Keep local notes in sync when the drawer opens for a different application.
  useEffect(() => {
    setNotes(app.notes ?? '')
  }, [app.id, app.notes])
  const toggleShortlist = () => {
    update.mutate(
      { id: app.id, data: { shortlisted: !(app.shortlisted ?? false) } },
      {
        onSuccess: () => toast.success(t('review.shortlistSaved')),
        onError: (err) => toast.error(err instanceof Error ? err.message : t('review.saveError')),
      },
    )
  }
  const saveNotes = () => {
    update.mutate(
      { id: app.id, data: { notes } },
      {
        onSuccess: () => toast.success(t('review.notesSaved')),
        onError: (err) => toast.error(err instanceof Error ? err.message : t('review.saveError')),
      },
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">{t('review.shortlist')}</p>
            <Switch
              checked={app.shortlisted ?? false}
              disabled={update.isPending}
              onCheckedChange={toggleShortlist}
              aria-label={t('review.shortlist')}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{t('review.shortlistHint')}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">{t('review.notes')}</p>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('review.notesPlaceholder')}
          aria-label={t('review.notes')}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">{t('review.notesHint')}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={saveNotes}
            disabled={update.isPending || notes === (app.notes ?? '')}
          >
            {t('review.saveNotes')}
          </Button>
        </div>
      </div>
    </div>
  )
}
export function CandidateReviewPanel({ app, job }: { app: Application; job: Job }) {
  const { t } = useI18n()
  const { data: profile, isLoading } = useProfileById(app.candidateId)
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
          <User className="size-3" />
          {t('review.profile')}
        </p>
        <ProfileSnapshot profile={profile ?? null} loading={isLoading} />
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <FileText className="size-3" />
          {t('review.cv')}
        </p>
        <p className="text-[11px] text-muted-foreground mb-2">{t('review.cvDesc')}</p>
        <CvPreview app={app} profile={profile ?? null} />
      </div>
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <MatchScoreSection profile={profile ?? null} job={job} />
      </div>
      <div className="rounded-lg border border-dashed border-border p-3">
        <ShortlistAndNotes app={app} />
      </div>
    </div>
  )
}
