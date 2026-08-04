import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useCreateReport } from '@/hooks/useJobReports'
import { useUpdateJob } from '@/hooks/useJobs'
import { useI18n } from '@/i18n/I18nProvider'

const REPORT_REASONS = [
  { key: 'scam', labelKey: 'jobDetail.reportReasonScam' },
  { key: 'inappropriate', labelKey: 'jobDetail.reportReasonInappropriate' },
  { key: 'inaccurate', labelKey: 'jobDetail.reportReasonInaccurate' },
  { key: 'other', labelKey: 'jobDetail.reportReasonOther' },
] as const

/**
 * "Report job" button on the job detail page. Opens a small dialog where
 * the visitor picks a reason and (optionally) adds details. Creates a row
 * in the `reports` table and flags the job as `moderationStatus: 'pending'`
 * so it drops out of public listings until an HQ admin reviews it.
 */
export function ReportJobButton({
  jobId,
  className,
}: {
  jobId: string
  className?: string
}) {
  const { t } = useI18n()
  const { user } = useAuth()
  const createReport = useCreateReport()
  const updateJob = useUpdateJob()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>('scam')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await createReport.mutateAsync({
        jobId,
        reporterId: user?.id ?? 'anonymous',
        reason,
        note: note.trim(),
      })
      // Flag the job for review — best-effort; never blocks the report flow.
      updateJob.mutate(
        { id: jobId, data: { moderationStatus: 'pending' } },
        {
          onError: err => {
            // eslint-disable-next-line no-console
            console.warn('[reportJob] flag-for-review failed', err)
          },
        },
      )
      toast.success(t('jobDetail.reportSuccess'), {
        description: t('jobDetail.reportSuccessDesc'),
      })
      setOpen(false)
      setNote('')
      setReason('scam')
    } catch (err) {
      toast.error(t('jobDetail.reportError'), {
        description: err instanceof Error ? err.message : '',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/5 ${className ?? ''}`}
        onClick={() => setOpen(true)}
        aria-label={t('jobDetail.report')}
      >
        <Flag className="size-3.5" />
        <span className="hidden sm:inline">{t('jobDetail.report')}</span>
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <h3 className="font-serif text-lg font-bold text-foreground flex items-center gap-2">
                <Flag className="size-4 text-destructive" />
                {t('jobDetail.reportTitle')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('jobDetail.reportDesc')}
              </p>
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {t('jobDetail.reportReason')}
                  </label>
                  <select
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {REPORT_REASONS.map(r => (
                      <option key={r.key} value={r.key}>
                        {t(r.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {t('jobDetail.reportNote')}
                  </label>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                    placeholder={t('jobDetail.reportNotePlaceholder')}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  {t('jobDetail.reportCancel')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="gap-1.5"
                >
                  {submitting ? (
                    <>
                      <span className="inline-block size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    <>
                      <Flag className="size-3.5" />
                      {t('jobDetail.reportSubmit')}
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
