import { createFileRoute, Link, useParams, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useProfileById } from '@/hooks/useProfile'
import { useSignedStorageUrl } from '@/hooks/useSignedStorageUrl'
import { useJob } from '@/hooks/useJobs'
import { useCompany, useCompanyById } from '@/hooks/useCompanies'
import {
  useApplications,
  useApplicationById,
  useUpdateApplicationStatus,
  useUpdateApplication,
} from '@/hooks/useApplications'
import { sendInterviewNotification } from '@/lib/notifyInterview'
import { JobAnalytics } from '@/components/manage/JobAnalytics'
import { useI18n } from '@/i18n/I18nProvider'
import {
  ArrowLeft,
  Users,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Eye,
  X,
  Briefcase,
  CalendarClock,
  ListChecks,
  Sparkles,
  AlertCircle,
  Building2,
  ChevronDown,
  ExternalLink,
} from 'lucide-react'
import type { Application } from '@/types'

export const Route = createFileRoute('/_app/employer/manage/$id')({
  component: ManageApplicationsPage,
})

/* ── Animation helper ─────────────────────────────────── */
function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
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
function splitList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(/[,;|]/).map(x => x.trim()).filter(Boolean)
}

function extractResumeUrl(coverLetter: string | null | undefined): string | null {
  if (!coverLetter) return null
  const m = coverLetter.match(/\[Resume\]\s+(\S+)/i)
  return m ? m[1] : null
}

function extractCoverNote(coverLetter: string | null | undefined): string {
  if (!coverLetter) return ''
  return coverLetter.replace(/\[Resume\]\s+\S+/i, '').trim()
}

const STATUS_FLOW: Application['status'][] = [
  'pending',
  'reviewed',
  'interview',
  'offered',
  'hired',
  'rejected',
]

function statusColor(s: Application['status']): string {
  const map: Record<Application['status'], string> = {
    pending: 'border-muted-foreground/30 text-muted-foreground bg-muted/30',
    reviewed: 'border-blue-500/30 text-blue-700 bg-blue-500/5',
    interview: 'border-amber-500/30 text-amber-700 bg-amber-500/5',
    offered: 'border-primary/30 text-primary bg-primary/5',
    hired: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
    rejected: 'border-destructive/30 text-destructive bg-destructive/5',
  }
  return map[s]
}

/* ── Application row + drawer ──────────────────────────── */
function ApplicationRow({ app, jobId }: { app: Application; jobId: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const resumePointer = extractResumeUrl(app.coverLetter)
  const resumeUrl = useSignedStorageUrl(resumePointer)
  const coverNote = extractCoverNote(app.coverLetter)
  const initial = coverNote ? coverNote.charAt(0).toUpperCase() : 'C'

  return (
    <>
      <div className="group flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-accent/30 hover:border-accent/50 transition-all duration-150">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {coverNote || t('manage.candidate')}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarClock className="size-3" />
              {new Date(app.createdAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
              {resumeUrl ? (
                <>
                  {' · '}
                  <FileText className="size-3" />
                  {t('manage.resumeAttached')}
                </>
              ) : null}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(app.status)}`}
          >
            {t(`dashboard.status.${app.status}`)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setOpen(true)}
            aria-label={t('manage.view')}
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
      </div>

      <ApplicationDrawer
        app={app}
        open={open}
        onClose={() => setOpen(false)}
        jobId={jobId}
      />
    </>
  )
}

/* ── Interview scheduling panel (Gap 11) ──────────────── */
function InterviewScheduler({ app, jobId }: { app: Application; jobId: string }) {
  const { t, locale } = useI18n()
  const updateApplication = useUpdateApplication()
  // Fresh copy so the panel appears as soon as status becomes "interview".
  const { data: freshApp } = useApplicationById(app.id)
  const current = freshApp ?? app
  const { data: job } = useJob(jobId)
  const { data: company } = useCompanyById(job?.companyId)
  const { data: profile } = useProfileById(app.candidateId)
  const [link, setLink] = useState(current.interviewLink ?? '')
  const [date, setDate] = useState(current.interviewDate ?? '')
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const { data: employerProfile } = useProfile(user?.id)
  useEffect(() => {
    if (!link && employerProfile?.meetingLink) setLink(employerProfile.meetingLink)
  }, [employerProfile?.meetingLink, link])

  useEffect(() => {
    setLink(current.interviewLink ?? '')
    setDate(current.interviewDate ?? '')
  }, [current.interviewLink, current.interviewDate])

  if (current.status !== 'interview') return null

  const canSave = link.trim().length > 0 || date.length > 0

  const save = async () => {
    setSaving(true)
    try {
      await updateApplication.mutateAsync({
        id: app.id,
        data: {
          interviewLink: link.trim() || undefined,
          interviewDate: date || undefined,
        },
      })
      let notifyError: string | undefined
      if (job) {
        const sent = await sendInterviewNotification({
          app: {
            ...current,
            interviewLink: link.trim() || undefined,
            interviewDate: date || undefined,
          },
          job,
          companyName: company?.name ?? '',
          candidateProfile: profile ?? null,
          locale,
          dashboardUrl: `${window.location.origin}/dashboard`,
        })
        notifyError = sent.ok ? undefined : sent.error
      }
      toast.success(t('manage.interview.saved'), {
        description: notifyError,
        duration: 3500,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
        <CalendarClock className="size-4 text-primary" />
        {t('manage.interview.title')}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{t('manage.interview.desc')}</p>
      <div className="space-y-3 mt-3">
        <div className="space-y-1.5">
          <Label htmlFor="interview-link">{t('manage.interview.linkLabel')}</Label>
          <Input
            id="interview-link"
            type="url"
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder={t('manage.interview.linkPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="interview-date">{t('manage.interview.dateLabel')}</Label>
          <Input
            id="interview-date"
            type="datetime-local"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={save} disabled={saving || !canSave} className="gap-1.5">
          <CalendarClock className="size-3.5" />
          {saving ? t('common.loading') : t('manage.interview.save')}
        </Button>
      </div>
    </div>
  )
}

/* ── Side drawer with full application details + status update ── */
function ApplicationDrawer({
  app,
  open,
  onClose,
  jobId,
}: {
  app: Application
  open: boolean
  onClose: () => void
  jobId: string
}) {
  const { t } = useI18n()
  const updateStatus = useUpdateApplicationStatus()
  const [pending, setPending] = useState<Application['status'] | null>(null)

  const resumeUrl = extractResumeUrl(app.coverLetter)
  const coverNote = extractCoverNote(app.coverLetter)
  const initial = coverNote ? coverNote.charAt(0).toUpperCase() : 'C'

  const handleStatusChange = async (next: Application['status']) => {
    setPending(next)
    try {
      await updateStatus.mutateAsync({ id: app.id, status: next })
      toast.success(t('manage.statusUpdated'), {
        description: t(`dashboard.status.${next}`),
        duration: 1800,
      })
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t('manage.statusError'),
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[28rem] bg-card border-l border-border shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
              <p className="font-serif text-base font-bold text-foreground flex items-center gap-2">
                <Users className="size-4 text-primary" />
                {t('manage.applicationDetails')}
              </p>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={t('manage.close')}
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Candidate header */}
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 shrink-0 ring-2 ring-border">
                  <AvatarFallback className="text-base bg-primary/10 text-primary font-medium">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">
                    {coverNote ? coverNote.split('\n')[0].slice(0, 60) : t('manage.candidate')}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {t('apply.success.confirmationId')}: {app.id}
                  </p>
                </div>
              </div>

              {/* Status pill */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" />
                {new Date(app.createdAt).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(app.status)}`}
                >
                  {t(`dashboard.status.${app.status}`)}
                </span>
              </div>

              {/* Cover note */}
              {coverNote ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <FileText className="size-3" /> {t('manage.coverNote')}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {coverNote}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    {t('manage.noCoverNote')}
                  </p>
                </div>
              )}

              {/* Resume */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <FileText className="size-3" /> {t('apply.review.resume')}
                </p>
                {resumeUrl ? (
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Eye className="size-3.5" />
                    {t('manage.openResume')}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t('apply.review.notAttached')}
                  </p>
                )}
              </div>

              {/* Status update */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="size-3" /> {t('manage.updateStatus')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_FLOW.map(s => {
                    const active = s === app.status
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => !active && handleStatusChange(s)}
                        disabled={updateStatus.isPending && pending === s}
                        className={`text-left rounded-lg border px-3 py-2 transition-all text-xs font-medium ${
                          active
                            ? statusColor(s) + ' cursor-default'
                            : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30 cursor-pointer disabled:opacity-50'
                        }`}
                      >
                        {updateStatus.isPending && pending === s ? (
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                            {t(`dashboard.status.${s}`)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            {active && <span className="size-1.5 rounded-full bg-current" />}
                            {t(`dashboard.status.${s}`)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
              <InterviewScheduler app={app} jobId={jobId} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* ── Page ──────────────────────────────────────────────── */
function ManageApplicationsPage() {
  const { id } = useParams({ from: '/_app/employer/manage/$id' })
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: company } = useCompany(user?.id)
  const { data: job, isLoading: jobLoading, isError, error } = useJob(id)
  const { data: applications, isLoading: appsLoading } = useApplications(id)
  const { t } = useI18n()
  const navigate = useNavigate()

  const isOwner = !!job && !!company && job.companyId === company.id

  /* ── Loading skeleton ───────────────────────────────── */
  if (jobLoading || appsLoading) {
    return (
      <AuthGate>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="h-4 w-32 rounded bg-muted animate-pulse mb-6" />
          <div className="h-8 w-3/4 rounded bg-muted animate-pulse mb-2" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse mb-8" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </AuthGate>
    )
  }

  if (isError || !job) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            {t('editJob.notFound')}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {error instanceof Error ? error.message : ''}
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/dashboard">{t('editJob.backToDashboard')}</Link>
          </Button>
        </div>
      </AuthGate>
    )
  }

  if (!isOwner) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            {t('dashboard.notYourJob')}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t('dashboard.ownerOnlyEdit')}
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/dashboard">{t('editJob.backToDashboard')}</Link>
          </Button>
        </div>
      </AuthGate>
    )
  }

  const apps = applications ?? []
  const statusCounts = STATUS_FLOW.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {},
  )
  for (const a of apps) statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1

  return (
    <AuthGate>
      <div className="p-6 max-w-4xl mx-auto">
        <FadeIn>
          <div className="mb-8">
            <button
              onClick={() => navigate({ to: '/dashboard' })}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 cursor-pointer"
            >
              <ArrowLeft className="size-4" />
              {t('editJob.backToDashboard')}
            </button>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="size-7 text-primary" />
              {t('manage.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t('manage.subtitle', { title: job.title })}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Building2 className="size-3" /> {company?.name}
            </p>
          </div>
        </FadeIn>

        {/* Stats row */}
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t('manage.total')}
                </p>
                <p className="text-2xl font-bold text-foreground font-serif">
                  {apps.length}
                </p>
              </CardContent>
            </Card>
            {(['pending', 'reviewed', 'interview'] as const).map(s => (
              <Card key={s}>
                <CardContent className="pt-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t(`dashboard.status.${s}`)}
                  </p>
                  <p className="text-2xl font-bold text-foreground font-serif">
                    {statusCounts[s] ?? 0}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </FadeIn>

        {/* Analytics (Gap 10) */}
        <FadeIn delay={0.08}>
          <JobAnalytics job={job} applications={apps} />
        </FadeIn>
        {/* List */}
        <FadeIn delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="size-4 text-primary" />
                {t('manage.list')}
              </CardTitle>
              <CardDescription>
                {apps.length === 0
                  ? t('manage.empty')
                  : t('manage.listDesc', { count: apps.length, plural: apps.length === 1 ? '' : 's' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {apps.length === 0 ? (
                <div className="text-center py-10">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                    <Briefcase className="size-6 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t('manage.emptyDesc')}
                  </p>
                </div>
              ) : (
                apps.map(app => (
                  <ApplicationRow key={app.id} app={app} jobId={id} />
                ))
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </AuthGate>
  )
}
