import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useI18n } from '@/i18n/I18nProvider'
import { useCreateJob, useUpdateJob } from '@/hooks/useJobs'
import { useTeamMembers } from '@/hooks/useTeamMembers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Copy,
  Pause,
  Archive,
  CalendarClock,
  UserCircle2,
  Lock,
  Loader2,
} from 'lucide-react'
import type { Job } from '@/types'

/**
 * Employer job-management panel (final P0).
 *
 * Data-surface policy (verified against main 0f8c8db5):
 *  • Clone   — REAL: useCreateJob duplicates every copyable field as a new
 *              draft job (title gets a " (copy)" suffix). No new columns.
 *  • Pause   — NO surface: jobs.status is 'open'|'closed'|'draft' and no
 *              paused column exists → honest disabled toggle + caption.
 *  • Archive — NO surface: no archived status/column → honest disabled
 *              button + caption.
 *  • Dates   — created_at exists (shown); published_at / expires_at do NOT
 *              exist on jobs → disabled inputs + caption.
 *  • Assignments — team management (migration 019) is live, but jobs has no
 *              owner/assignee column → disabled select + caption.
 * Suggested follow-up migration 024 (see PR description): jobs.paused_at,
 * jobs.archived_at, jobs.published_at, jobs.expires_at, jobs.assignee_id.
 */
export function JobManagementPanel({ job }: { job: Job }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const createJob = useCreateJob()
  const [cloning, setCloning] = useState(false)

  const handleClone = async () => {
    if (cloning) return
    setCloning(true)
    try {
      const copyTitle = `${job.title} (${t('jobMgmt.cloneSuffix')})`
      const created = await createJob.mutateAsync({
        companyId: job.companyId,
        title: copyTitle,
        description: job.description,
        level: job.level,
        locationType: job.locationType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        currency: job.currency,
        skillsRequired: job.skillsRequired,
        languagesRequired: job.languagesRequired,
        status: 'draft',
        industry: job.industry,
      })
      toast.success(t('jobMgmt.cloneSuccess'), {
        description: t('jobMgmt.cloneSuccessDesc', { title: copyTitle }),
      })
      navigate({ to: '/employer/edit-job/$id', params: { id: created.id } })
    } catch (err) {
      toast.error(t('jobMgmt.cloneError'), {
        description: err instanceof Error ? err.message : '',
      })
    } finally {
      setCloning(false)
    }
  }

  const updateJob = useUpdateJob()
  const { data: teamMembers } = useTeamMembers(job.companyId)
  const [saving, setSaving] = useState(false)
  const [publishedDate, setPublishedDate] = useState(() => (job.publishedAt ? job.publishedAt.slice(0, 10) : ''))
  const [expiresDate, setExpiresDate] = useState(() => (job.expiresAt ? job.expiresAt.slice(0, 10) : ''))
  // Keep the date fields in sync when the panel opens for a different job.
  useEffect(() => {
    setPublishedDate(job.publishedAt ? job.publishedAt.slice(0, 10) : '')
    setExpiresDate(job.expiresAt ? job.expiresAt.slice(0, 10) : '')
  }, [job.id, job.publishedAt, job.expiresAt])
  const save = (data: Partial<Job>) => {
    if (saving) return
    setSaving(true)
    updateJob.mutate(
      { id: job.id, data },
      {
        onSuccess: () => toast.success(t('jobMgmt.saved')),
        onError: (err) => toast.error(err instanceof Error ? err.message : t('jobMgmt.saveError')),
        onSettled: () => setSaving(false),
      },
    )
  }
  const saveDate = (field: 'publishedAt' | 'expiresAt', value: string) => {
    const iso = value ? new Date(value + 'T00:00:00').toISOString() : null
    const current = field === 'publishedAt' ? job.publishedAt : job.expiresAt
    if (iso === (current ?? null)) return
    save({ [field]: iso } as Partial<Job>)
  }
  const createdDate = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : t('jobMgmt.notProvided')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          {t('jobMgmt.title')}
        </CardTitle>
        <CardDescription>{t('jobMgmt.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Clone (live) ─────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t('jobMgmt.clone')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('jobMgmt.cloneDesc')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={handleClone}
            disabled={cloning || createJob.isPending}
          >
            {cloning || createJob.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {cloning || createJob.isPending ? t('jobMgmt.clonePending') : t('jobMgmt.clone')}
          </Button>
        </div>

        {/* ── Pause (migration 024 wired) ─────────────────── */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Pause className="size-3.5 text-primary" />
                {t('jobMgmt.pause')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('jobMgmt.pauseDesc')}</p>
            </div>
            <Switch
              checked={!!job.pausedAt}
              disabled={saving}
              onCheckedChange={(on) => save({ pausedAt: on ? new Date().toISOString() : null })}
              aria-label={t('jobMgmt.pause')}
            />
          </div>
        </div>
        {/* ── Archive (migration 024 wired) ───────────────── */}
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Archive className="size-3.5 text-primary" />
                {t('jobMgmt.archive')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t('jobMgmt.archiveDesc')}</p>
            </div>
            {job.archivedAt ? (
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                {t('jobMgmt.archivedOn', {
                  date: new Date(job.archivedAt).toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                })}
              </span>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={() => save({ archivedAt: new Date().toISOString() })}
                disabled={saving}
              >
                <Archive className="size-3.5 mr-1" />
                {t('jobMgmt.archive')}
              </Button>
            )}
          </div>
        </div>
        {/* ── Dates (migration 024 wired) ────────────────── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('jobMgmt.dates')}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="size-3" />
              {t('jobMgmt.created')}
            </dt>
            <dd className="text-xs font-medium text-foreground">{createdDate}</dd>
            <dt className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="size-3" />
              {t('jobMgmt.published')}
            </dt>
            <dd>
              <Input
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                onBlur={() => saveDate('publishedAt', publishedDate)}
                aria-label={t('jobMgmt.published')}
                className="h-8 text-xs max-w-[200px]"
              />
            </dd>
            <dt className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="size-3" />
              {t('jobMgmt.expires')}
            </dt>
            <dd>
              <Input
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                onBlur={() => saveDate('expiresAt', expiresDate)}
                aria-label={t('jobMgmt.expires')}
                className="h-8 text-xs max-w-[200px]"
              />
            </dd>
          </dl>
        </div>
        {/* ── Assignment (migration 024 wired) ────────────── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <UserCircle2 className="size-4 text-primary" />
            {t('jobMgmt.assignment')}
          </p>
          <p className="text-xs text-muted-foreground">{t('jobMgmt.assignedDesc')}</p>
          <select
            value={job.assigneeId ?? ''}
            onChange={(e) => save({ assigneeId: e.target.value || null })}
            disabled={saving || !teamMembers?.length}
            aria-label={t('jobMgmt.assignedTo')}
            className="h-9 w-full max-w-[240px] rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t('jobMgmt.assignedToPlaceholder')}</option>
            {teamMembers?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.inviteEmail || m.userId.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  )
}
