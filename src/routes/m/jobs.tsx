import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Search, MapPin, Briefcase, Clock, AlertCircle, Heart, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useJobs } from '@/hooks/useJobs'
import { useCompanyById } from '@/hooks/useCompanies'
import { useMySavedJobs, useUnsaveJob } from '@/hooks/useSavedJobs'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useSaveJob, useSavedJobIds } from '@/hooks/useSavedJobs'
import { cn } from '@/lib/utils'
import type { Job } from '@/types'

export const Route = createFileRoute('/m/jobs')({
  head: () => ({ meta: [{ title: 'Jobs — Impulsa (mobile)' }] }),
  component: MobileJobs,
})

function MobileJobs() {
  const { t } = useI18n()
  const { data: jobs, isLoading, isError, error, refetch } = useJobs()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const candidateId = profile?.id
  const { data: savedJobs } = useMySavedJobs(candidateId)
  const savedIds = useSavedJobIds(candidateId)
  const unsave = useUnsaveJob()
  const save = useSaveJob()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!jobs) return []
    const s = search.toLowerCase()
    return jobs.filter(j =>
      !s || j.title.toLowerCase().includes(s) || j.description.toLowerCase().includes(s),
    )
  }, [jobs, search])

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('mobile.searchPlaceholder')}
            className="pl-9 h-11"
          />
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="text-center py-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-3">
            <AlertCircle className="size-6 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-foreground">{t('mobile.errorTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            {error instanceof Error ? error.message : ''}
          </p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
            {t('mobile.retry')}
          </Button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
            <Briefcase className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {jobs && jobs.length > 0 ? t('jobs.emptyFiltered') : t('jobs.emptyDb')}
          </p>
          {search && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setSearch('')}>
              {t('jobs.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <ul className="space-y-2.5">
          {filtered.map(job => (
            <li key={job.id}>
              <MobileJobCard
                job={job}
                saved={savedIds?.has(job.id) ?? false}
                onToggleSave={() => {
                  if (!candidateId) return
                  if (savedIds?.has(job.id)) {
                    unsave.mutate({ candidateId, jobId: job.id })
                  } else {
                    save.mutate({ candidateId, jobId: job.id })
                  }
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MobileJobCard({
  job,
  saved,
  onToggleSave,
}: {
  job: Job
  saved: boolean
  onToggleSave: () => void
}) {
  const { data: company } = useCompanyById(job.companyId)
  const { t } = useI18n()
  const skills = job.skillsRequired
    ? job.skillsRequired.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)
    : []
  const ccy = job.currency || 'COP'
  const salary =
    job.salaryMin && job.salaryMax
      ? `${job.salaryMin.toLocaleString()}-${job.salaryMax.toLocaleString()} ${ccy}`
      : t('jobs.salaryTBD')

  return (
    <Link
      to="/m/jobs/$id"
      params={{ id: job.id }}
      className="block rounded-xl border border-border bg-card p-4 active:bg-accent/30 active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-foreground line-clamp-2">
            {job.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="size-3" />
            {company?.name ?? t('jobDetail.confidential')}
          </p>
        </div>
        <button
          type="button"
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onToggleSave()
          }}
          className={cn(
            'shrink-0 h-9 w-9 rounded-full border flex items-center justify-center transition-colors',
            saved
              ? 'border-pink-500/40 bg-pink-500/10 text-pink-600'
              : 'border-border bg-card text-muted-foreground active:bg-accent',
          )}
          aria-label={saved ? t('savedJobs.unsave') : t('savedJobs.save')}
        >
          <Heart
            className={cn('size-4 transition-all', saved && 'fill-current scale-110')}
          />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3" /> {job.locationType}
        </span>
        {job.level && (
          <span className="inline-flex items-center gap-1">
            <Briefcase className="size-3" /> {job.level}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" /> {job.createdAt
            ? new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : ''}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-accent truncate">{salary}</p>
        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end">
            {skills.slice(0, 1).map(s => (
              <span
                key={s}
                className="inline-flex items-center rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
