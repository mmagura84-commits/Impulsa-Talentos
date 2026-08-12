import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Flag,
  Clock,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUpdateJob } from '@/hooks/useJobs'
import { useAllReports } from '@/hooks/useJobReports'
import { useI18n } from '@/i18n/I18nProvider'
import type { Company, Job, JobReport } from '@/types'

const REASON_LABELS: Record<string, string> = {
  scam: 'hq.moderation.reasonScam',
  inappropriate: 'hq.moderation.reasonInappropriate',
  inaccurate: 'hq.moderation.reasonInaccurate',
  other: 'hq.moderation.reasonOther',
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(
      locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' },
    )
  } catch {
    return iso
  }
}

/** One pending/rejected job row with approve/reject actions. */
function ModerationJobRow({
  job,
  companyName,
}: {
  job: Job
  companyName: string
}) {
  const { locale, t } = useI18n()
  const updateJob = useUpdateJob()
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const approve = async () => {
    setBusy(true)
    try {
      await updateJob.mutateAsync({
        id: job.id,
        data: { moderationStatus: 'approved', moderationReason: '' },
      })
      toast.success(t('hq.moderation.approved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await updateJob.mutateAsync({
        id: job.id,
        data: {
          moderationStatus: 'rejected',
          moderationReason: reason.trim() || undefined,
        },
      })
      toast.success(t('hq.moderation.rejected'))
      setRejecting(false)
      setReason('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/jobs/$id"
            params={{ id: job.id }}
            className="text-sm font-medium text-foreground hover:text-primary hover:underline"
          >
            {job.title}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            {companyName} · {t('hq.moderation.posted', { date: formatDate(job.createdAt, locale) })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/5"
            onClick={approve}
            disabled={busy}
          >
            <CheckCircle2 className="size-3.5" />
            {t('hq.moderation.approve')}
          </Button>
          {!rejecting ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5"
              onClick={() => setRejecting(true)}
              disabled={busy}
            >
              <XCircle className="size-3.5" />
              {t('hq.moderation.reject')}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t('hq.moderation.reasonPlaceholder')}
                className="h-8 w-44 rounded-md border border-input bg-background px-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                autoFocus
              />
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={reject}
                disabled={busy}
              >
                {t('hq.moderation.confirmReject')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => {
                  setRejecting(false)
                  setReason('')
                }}
                disabled={busy}
              >
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </div>
      </div>
      {job.moderationReason && (
        <p className="text-xs text-muted-foreground">
          {t('hq.moderation.reason', { reason: job.moderationReason })}
        </p>
      )}
    </div>
  )
}

/** One report row with quick approve/reject of the underlying job. */
function ReportRow({
  report,
  jobTitle,
  companyName,
}: {
  report: JobReport
  jobTitle: string
  companyName: string
}) {
  const { locale, t } = useI18n()
  const updateJob = useUpdateJob()
  const job = report.jobId
  const approve = async () => {
    try {
      await updateJob.mutateAsync({
        id: job,
        data: { moderationStatus: 'approved', moderationReason: '' },
      })
      toast.success(t('hq.moderation.approved'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  const reject = async () => {
    try {
      await updateJob.mutateAsync({
        id: job,
        data: {
          moderationStatus: 'rejected',
          moderationReason: t('hq.moderation.reportedReason', {
            reason: t(REASON_LABELS[report.reason] ?? REASON_LABELS.other),
          }),
        },
      })
      toast.success(t('hq.moderation.rejected'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          <Flag className="mr-1.5 inline size-3.5 text-destructive" />
          {jobTitle || report.jobId}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t(REASON_LABELS[report.reason] ?? REASON_LABELS.other)}
          {report.note ? ` — ${report.note}` : ''}
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          {companyName} · {t('hq.moderation.by')} {report.reporterId.slice(0, 8)} ·{' '}
          {formatDate(report.createdAt, locale)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-emerald-700 hover:bg-emerald-500/5"
          onClick={approve}
        >
          <CheckCircle2 className="mr-1 size-3.5" />
          {t('hq.moderation.approve')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-destructive hover:bg-destructive/5"
          onClick={reject}
        >
          <XCircle className="mr-1 size-3.5" />
          {t('hq.moderation.reject')}
        </Button>
      </div>
    </div>
  )
}

/**
 * HQ moderation tab — the pending-review queue plus the report inbox.
 */
export function ModerationTab({
  jobs,
  companies,
}: {
  jobs: Job[]
  companies: Company[]
}) {
  const { t } = useI18n()
  const { data: reportsData } = useAllReports()
  const reports = reportsData ?? []

  const pending = jobs.filter(j => j.moderationStatus === 'pending')
  const rejected = jobs.filter(j => j.moderationStatus === 'rejected')
  const companyName = (id: string) =>
    companies.find(c => c.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="space-y-8">
      {/* ── Pending review queue ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Clock className="size-4 text-amber-600" />
          <h3 className="font-serif text-lg font-bold text-foreground">
            {t('hq.moderation.pendingTitle')}
          </h3>
          <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            {pending.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('hq.moderation.pendingDesc')}
        </p>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <ShieldCheck className="size-6 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              {t('hq.moderation.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(job => (
              <ModerationJobRow
                key={job.id}
                job={job}
                companyName={companyName(job.companyId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Reports inbox ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="size-4 text-destructive" />
          <h3 className="font-serif text-lg font-bold text-foreground">
            {t('hq.moderation.reportsTitle')}
          </h3>
          <span className="rounded-full bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            {reports.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('hq.moderation.reportsDesc')}
        </p>
        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {t('hq.moderation.noReports')}
          </div>
        ) : (
          <div className="space-y-2.5">
            {reports.map(r => (
              <ReportRow
                key={r.id}
                report={r}
                jobTitle={jobs.find(j => j.id === r.jobId)?.title ?? ''}
                companyName={companyName(
                  jobs.find(j => j.id === r.jobId)?.companyId ?? '',
                )}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Rejected (recoverable) ── */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <XCircle className="size-4 text-destructive" />
          <h3 className="font-serif text-lg font-bold text-foreground">
            {t('hq.moderation.rejectedTitle')}
          </h3>
          <span className="rounded-full bg-destructive/10 border border-destructive/30 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            {rejected.length}
          </span>
        </div>
        {rejected.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            {t('hq.moderation.noRejected')}
          </p>
        ) : (
          <div className="space-y-3">
            {rejected.map(job => (
              <div key={job.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{job.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {companyName(job.companyId)}
                    {job.moderationReason
                      ? ` · ${t('hq.moderation.reason', { reason: job.moderationReason })}`
                      : ''}
                  </p>
                </div>
                <RejectUndoButton jobId={job.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RejectUndoButton({ jobId }: { jobId: string }) {
  const { t } = useI18n()
  const updateJob = useUpdateJob()
  const restore = async () => {
    try {
      await updateJob.mutateAsync({
        id: jobId,
        data: { moderationStatus: 'approved', moderationReason: '' },
      })
      toast.success(t('hq.moderation.restored'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5"
      onClick={restore}
    >
      <RotateCcw className="size-3.5" />
      {t('hq.moderation.restore')}
    </Button>
  )
}
