import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, MapPin, Briefcase, Globe, DollarSign, Clock, Heart, Send, Building2, AlertCircle, XCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useJob } from '@/hooks/useJobs'
import { useCompanyById } from '@/hooks/useCompanies'
import { useApply, useMyApplications } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { formatSalaryValue } from '@/lib/formatSalary'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { useSaveJob, useSavedJobIds, useUnsaveJob } from '@/hooks/useSavedJobs'
import { sendApplicationNotifications } from '@/lib/notifyApplication'
import { MarkdownPreview } from '@/components/MarkdownPreview'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const Route = createFileRoute('/m/jobs/$id')({
  head: () => ({ meta: [{ title: 'Job — Impulsa (mobile)' }] }),
  component: MobileJobDetail,
})

function splitList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(/[,;|]/).map(x => x.trim()).filter(Boolean)
}

function MobileJobDetail() {
  const { id } = useParams({ from: '/m/jobs/$id' })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: job, isLoading, isError, error } = useJob(id)
  const { data: company } = useCompanyById(job?.companyId)
  const { data: myApps } = useMyApplications(profile?.id)
  const apply = useApply()
  const { t, locale } = useI18n()
  const savedIds = useSavedJobIds(profile?.id)
  const save = useSaveJob()
  const unsave = useUnsaveJob()
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)

  const saved = savedIds?.has(id) ?? false
  const alreadyApplied = myApps?.some(a => a.jobId === id) ?? applied
  const skills = job ? splitList(job.skillsRequired) : []

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        <div className="h-7 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="px-4 pt-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-3">
          <XCircle className="size-6 text-destructive" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          {isError ? t('mobile.errorTitle') : t('jobDetail.notFoundTitle')}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {isError
            ? (error instanceof Error ? error.message : '')
            : t('jobDetail.notFoundDesc')}
        </p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to="/m/jobs">{t('mobile.nav.jobs')}</Link>
        </Button>
      </div>
    )
  }

  const ccy = job.currency || 'COP'
  const salary =
    job.salaryMin && job.salaryMax
      ? `${formatSalaryValue(job.salaryMin, locale)}-${formatSalaryValue(job.salaryMax, locale)} ${ccy}`
      : t('jobs.salaryTBD')

  const handleApply = async () => {
    if (!profile?.id) {
      if (typeof window !== 'undefined') window.location.href = '/m/profile?apply=' + id
      return
    }
    setApplying(true)
    try {
      const created = await apply.mutateAsync({
        jobId: id,
        candidateId: profile.id,
        coverLetter: '',
        resumeUrl: profile.cvUrl || undefined,
      })
      setApplied(true)
      toast.success(t('jobDetail.applySuccess'), { duration: 2400 })

      // Fire-and-forget employer notification (same as desktop apply flow)
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      void sendApplicationNotifications({
        app: created,
        job,
        candidateProfile: profile,
        locale,
        dashboardUrl: `${origin}/dashboard`,
        jobsUrl: `${origin}/jobs`,
        reviewUrl: `${origin}/manage/${job.id}`,
        resumeUrl: profile.cvUrl || null,
        coverNote: '',
      })
    } catch (err) {
      console.warn('apply failed', err)
    } finally {
      setApplying(false)
    }
  }

  const handleToggleSave = () => {
    if (!profile?.id) return
    if (saved) {
      unsave.mutate({ candidateId: profile.id, jobId: id })
    } else {
      save.mutate({ candidateId: profile.id, jobId: id })
    }
  }

  return (
    <div className="pb-32">
      {/* Sticky back bar */}
      <div className="sticky top-14 z-20 bg-background/85 backdrop-blur-md border-b border-border/60 -mt-4">
        <div className="flex items-center gap-2 h-11 px-4">
          <button
            type="button"
            onClick={() => navigate({ to: '/m/jobs' })}
            className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"
            aria-label={t('jobDetail.back')}
          >
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-sm font-semibold truncate">
            {company?.name ?? t('jobDetail.confidential')}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4">
        <h1 className="font-serif text-2xl font-bold text-foreground leading-tight">
          {job.title}
        </h1>
        <p className="mt-1 text-sm font-medium text-foreground/80 flex items-center gap-1.5">
          <Building2 className="size-4 text-primary" />
          {company?.name ?? t('jobDetail.confidential')}
        </p>
        {company?.location && (
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <MapPin className="size-3" /> {company.location}
          </p>
        )}

        {/* Meta chips */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <MetaChip icon={MapPin} label={t('jobDetail.modality')} value={formatLocationType(job.locationType, t)} />
          {job.level && <MetaChip icon={Briefcase} label={t('jobDetail.level')} value={job.level} />}
          <MetaChip icon={DollarSign} label={t('jobDetail.salary')} value={salary} />
          {job.languagesRequired && (
            <MetaChip icon={Globe} label={t('jobDetail.languages')} value={formatLanguageList(job.languagesRequired, t)} />
          )}
        </div>

        {/* Description */}
        <section className="mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            {t('jobDetail.description')}
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <MarkdownPreview source={job.description} />
          </div>
        </section>

        {/* Skills */}
        {skills.length > 0 && (
          <section className="mt-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {t('postJob.job.skills')}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {skills.map(skill => (
                <span
                  key={skill}
                  className="inline-flex items-center rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* About the company */}
        {company && (
          <section className="mt-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {t('jobDetail.about', { company: company.name })}
            </h2>
            <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm text-muted-foreground">
              {company.description ? (
                <p className="leading-relaxed">{company.description}</p>
              ) : (
                <p className="italic">—</p>
              )}
              <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                {company.industry && (
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {t('jobDetail.industry')}: {company.industry}
                  </span>
                )}
                {company.size && (
                  <span className="rounded-full bg-muted px-2 py-0.5">
                    {t('jobDetail.size')}: {company.size}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div
        className="fixed bottom-16 inset-x-0 z-20 bg-background/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center gap-2 px-4 py-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleToggleSave}
            disabled={!profile?.id}
            className={cn(
              'h-12 w-12 shrink-0 rounded-full border flex items-center justify-center transition-colors',
              saved
                ? 'border-pink-500/40 bg-pink-500/10 text-pink-600'
                : 'border-border bg-card text-muted-foreground active:bg-accent',
            )}
            aria-label={saved ? t('savedJobs.unsave') : t('savedJobs.save')}
          >
            <Heart className={cn('size-5', saved && 'fill-current')} />
          </button>
          {alreadyApplied ? (
            <Button
              size="lg"
              variant="secondary"
              disabled
              className="flex-1 h-12 font-semibold gap-2"
            >
              <CheckCircle2 className="size-4" />
              {t('jobDetail.applied')}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleApply}
              disabled={applying || job.status !== 'open'}
              className="flex-1 h-12 font-semibold gap-2"
            >
              {applying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {applying ? t('jobDetail.applying') : t('jobDetail.applyCta')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </p>
      <p className="mt-0.5 text-xs font-semibold text-foreground truncate">
        {value}
      </p>
    </div>
  )
}
