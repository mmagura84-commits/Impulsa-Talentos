import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState, useMemo, useEffect, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useInfiniteJobs, JOBS_PAGE_SIZE, fetchJobsPage } from '@/hooks/useJobs'
import { useCompanyById, fetchAllCompanies } from '@/hooks/useCompanies'
import { INDUSTRIES } from '@/lib/industries'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { SocialShare } from '@/components/SocialShare'
import { SaveJobButton } from '@/components/SaveJobButton'
import {
  Search,
  MapPin,
  Clock,
  Briefcase,
  AlertCircle,
  X,
  BadgeCheck,
} from 'lucide-react'
import type { Job, Company } from '@/types'
import type { Locale } from '@/i18n/types'

export const Route = createFileRoute('/_app/jobs')({
  loader: async () => {
    try {
      // Fetch the first page of open jobs AND every company so the SSR/prerender
      // HTML shows real company names + /companies/<id> links instead of the
      // "Confidential" placeholder (React Query data isn't available at build time).
      const [page, companies] = await Promise.all([
        fetchJobsPage({}, 0, JOBS_PAGE_SIZE),
        fetchAllCompanies(),
      ])
      // Pass the COMPLETE public set (page.allJobs) rather than the page-1
      // slice so the SSR/prerender HTML emits a link to EVERY open job.
      // crawlLinks only prerenders URLs it can see — with only 24 of 26 jobs
      // linked, the 2 oldest job detail pages served SPA-shell HTML instead
      // of real job content (they're still valid URLs, just not prerendered).
      return { jobs: page.allJobs ?? page.jobs, companies }
    } catch (err) {
      console.error('[jobs loader]', err)
      return { jobs: [], companies: [] }
    }
  },
  head: () => ({
    meta: [
      { title: 'Bilingual Jobs in Colombia — Impulsa Talentos' },
      { name: 'description', content: 'Browse open bilingual jobs in Colombia with global employers. Find English and Spanish roles in tech, customer experience, healthcare, finance, and more.' },
    ],
  }),
  component: JobsPage,
})

/* ── Animation helper ──────────────────────────────────── */
function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Helpers ───────────────────────────────────────────── */
function formatSalary(job: Job, locale: Locale): string {
  if (!job.salaryMin && !job.salaryMax) return '—'
  const min = job.salaryMin ? job.salaryMin.toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const max = job.salaryMax ? job.salaryMax.toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const ccy = job.currency || 'COP'
  return `${ccy} ${min} - ${max}`
}

function formatPosted(iso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (!iso) return t('time.recent')
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return t('time.today')
  if (days === 1) return t('time.yesterday')
  if (days < 7) return t('time.daysAgo', { n: days })
  if (days < 30) return t('time.weeksAgo', { n: Math.floor(days / 7) })
  return t('time.monthsAgo', { n: Math.floor(days / 30) })
}

/* ── Job card with company lookup ──────────────────────── */
function JobListItem({
  job,
  index,
  companyOverride,
}: {
  job: Job
  index: number
  /** Company resolved by the route loader — used during SSR/prerender so the
   *  static HTML shows the real company name + /companies/<id> link before
   *  React Query has hydrated on the client. */
  companyOverride?: Company | null
}) {
  const { locale, t } = useI18n()
  const { data: company } = useCompanyById(job.companyId)
  const resolvedCompany = company ?? companyOverride ?? null
  const companyName = resolvedCompany?.name ?? t('jobDetail.confidential')
  const skills = job.skillsRequired
    ? job.skillsRequired.split(',').map(s => s.trim()).filter(Boolean)
    : []

  const navigate = useNavigate()
  // Keep nested controls independent while preserving a large, clickable card surface.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const goToJob = () => navigate({ to: '/jobs/$id', params: { id: job.id } })
  const onCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      goToJob()
    }
  }

  return (
    <FadeIn delay={index * 0.04}>
      <div
        role="link"
        tabIndex={0}
        onClick={goToJob}
        onKeyDown={onCardKeyDown}
        aria-label={job.title}
        className="block group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border-border">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-2 flex-1">
                <Link to="/jobs/$id" params={{ id: job.id }} onClick={stop} className="relative z-10 after:absolute after:inset-0 focus-visible:outline-none focus-visible:underline">
                  {job.title}
                </Link>
              </CardTitle>
              <div onClick={stop} className="shrink-0 -mt-1 -mr-1">
                <SaveJobButton jobId={job.id} />
              </div>
            </div>
            <p className="text-sm font-medium text-foreground/80 flex items-center gap-1.5 flex-wrap">
              {resolvedCompany?.id ? (
                <Link to="/companies/$id" params={{ id: resolvedCompany.id }} className="hover:text-primary hover:underline" onClick={stop}>
                  {companyName}
                </Link>
              ) : companyName}
              {resolvedCompany?.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-1.5 py-px text-[10px] font-medium text-emerald-700">
                  <BadgeCheck className="size-3" />
                  {t('verification.verified')}
                </span>
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {formatLocationType(job.locationType, t)}
              </span>
              {job.level && (
                <span className="flex items-center gap-1">
                  <Briefcase className="size-3" /> {job.level}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {formatPosted(job.createdAt, t)}
              </span>
            </div>
            <p className="text-sm font-semibold text-accent">{formatSalary(job, locale)}</p>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.slice(0, 4).map(skill => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted/50"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
            <div className="pt-2 border-t border-border/60" onClick={stop}>
              <SocialShare
                variant="compact"
                title={`${job.title} — ${companyName}`}
                description={job.description.split('\n')[0]?.slice(0, 160) || undefined}
                url={`${typeof window !== 'undefined' ? window.location.origin : ''}/jobs/${job.id}`}
              />
            </div>
          </CardContent>
        </Card>
        </div>
        </FadeIn>
  )
}

/* ── Page ──────────────────────────────────────────────── */
function JobsPage() {
  const matchRoute = useMatchRoute()

  // When a child detail route (/jobs/$id) is active, render ONLY the
  // detail component — don't show the list heading, filters, or search.
  // The <Outlet /> is required because the route tree generator makes
  // jobs.$id a child of jobs (file: jobs.$id.tsx → parent: jobs).
  if (matchRoute({ to: '/jobs/$id' })) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Outlet />
      </div>
    )
  }
  // List content lives in a separate component so ALL hooks (useState,
  // useEffect, useInfiniteJobs, useLoaderData, useMemo) are unconditional
  // per component — the conditional child-route branch above would otherwise
  // change the hook count between renders (React #310).
  return <JobsListView />
}

function JobsListView() {
  const { locale, t } = useI18n()
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [salaryFilter, setSalaryFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  useEffect(() => {
    setIndustryFilter(new URLSearchParams(window.location.search).get('industry') ?? '')
  }, [])

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteJobs({ level: levelFilter || undefined })
  const loaderData = Route.useLoaderData()

  // The first page carries the authoritative public set for truthful totals;
  // use it for client-side filters while retaining page metadata for loading.
  // `fetchJobsPage` provides the complete public set with each page, so the
  // client already has every card needed to render filters and totals. Avoid
  // a misleading Load more affordance for a dataset that is already loaded.
  const allJobs = data?.pages[0]?.allJobs ?? loaderData?.jobs ?? []
  const loadedJobs = allJobs

  // Company lookup resolved by the route loader — lets SSR/prerender HTML show
  // real company names + links before React Query hydrates client-side.
  const loaderCompaniesById = new Map<string, Company>(
    (loaderData?.companies ?? []).map((c) => [c.id, c]),
  )

  const filtered = useMemo(() => {
    if (!loadedJobs) return []
    let result = loadedJobs
    // Text search — title and description
    if (search.trim()) {
      const s = search.trim().toLowerCase()
      result = result.filter(j =>
        j.title.toLowerCase().includes(s) ||
        (j.description ?? '').toLowerCase().includes(s)
      )
    }
    if (locationFilter) {
      result = result.filter(j => formatLocationType(j.locationType, t).toLowerCase().includes(locationFilter.toLowerCase()))
    }
    if (languageFilter) {
      result = result.filter(j => formatLanguageList(j.languagesRequired, t).toLowerCase().includes(languageFilter.toLowerCase()))
    }
    if (industryFilter) {
      const canonical = INDUSTRIES.find(x => x.slug === industryFilter)?.canonical
      if (canonical) result = result.filter(j => j.industry === canonical)
    }
    if (salaryFilter) {
      const min = Number(salaryFilter)
      if (!isNaN(min)) {
        result = result.filter(j => (j.salaryMax || 0) >= min)
      }
    }
    return result
  }, [loadedJobs, search, locationFilter, languageFilter, salaryFilter, industryFilter, t])

  const levels = useMemo(() => {
    if (!loadedJobs) return []
    return [...new Set(loadedJobs.map(j => j.level).filter(Boolean))]
  }, [loadedJobs])

  const locations = useMemo(() => {
    if (!loadedJobs) return []
    return [...new Set(loadedJobs.map(j => formatLocationType(j.locationType, t)).filter(Boolean))]
  }, [loadedJobs])

  const languages = useMemo(() => {
    if (!loadedJobs) return []
    const all = new Set<string>()
    loadedJobs.forEach(j => {
      formatLanguageList(j.languagesRequired, t).split(/[,;|]/).map(s => s.trim()).filter(Boolean).forEach(l => all.add(l))
    })
    return [...all].sort()
  }, [loadedJobs])

  const filteredTotal = useMemo(() => {
    let result = allJobs
    const s = search.trim().toLowerCase()
    if (s) result = result.filter(j => j.title.toLowerCase().includes(s) || (j.description ?? '').toLowerCase().includes(s))
    if (locationFilter) result = result.filter(j => formatLocationType(j.locationType, t).toLowerCase().includes(locationFilter.toLowerCase()))
    if (languageFilter) result = result.filter(j => formatLanguageList(j.languagesRequired, t).toLowerCase().includes(languageFilter.toLowerCase()))
    if (industryFilter) {
      const canonical = INDUSTRIES.find(x => x.slug === industryFilter)?.canonical
      if (canonical) result = result.filter(j => j.industry === canonical)
    }
    if (salaryFilter) {
      const min = Number(salaryFilter)
      if (!isNaN(min)) result = result.filter(j => (j.salaryMax || 0) >= min)
    }
    return result.length
  }, [allJobs, search, locationFilter, languageFilter, salaryFilter, industryFilter])
  const activeFilterCount = [levelFilter, locationFilter, languageFilter, salaryFilter, industryFilter, search.trim()].filter(Boolean).length
  // `allJobs` is the complete server-visible set, so pagination is only
  // available while the rendered set is smaller than its authoritative total.
  const authoritativeTotal = data?.pages[0]?.total ?? allJobs.length
  const hasRemainingJobs = loadedJobs.length < authoritativeTotal
  const remainingJobs = hasRemainingJobs ? authoritativeTotal - loadedJobs.length : 0
  const displayedTotal = filteredTotal

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <FadeIn>
        <div className="mb-8">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">{t('jobs.title')}</h1>
          <p className="mt-1 text-muted-foreground">
            {isLoading
              ? t('jobs.subtitleLoading')
              : t('jobs.subtitleCount', {
                  count: displayedTotal,
                  plural: filtered.length !== 1 ? (locale === 'es' ? 's' : 's') : '',
                })}
          </p>
        </div>
      </FadeIn>

      {/* Search + filter bar */}
      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3 mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('jobs.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              disabled={isLoading}
            >
              <option value="">{t('jobs.allLevels')}</option>
              {levels.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              disabled={isLoading}
            >
              <option value="">{t('jobs.allLocations')}</option>
              {locations.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              value={languageFilter}
              onChange={e => setLanguageFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              disabled={isLoading}
            >
              <option value="">{t('jobs.allLanguages')}</option>
              {languages.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <select
              value={salaryFilter}
              onChange={e => setSalaryFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              disabled={isLoading}
            >
              <option value="">{t('jobs.filterAnySalary')}</option>
              {[5000000, 8000000, 12000000, 16000000, 20000000].map(v => (
                <option key={v} value={v}>COP {v.toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US')}+</option>
              ))}
            </select>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(''); setLevelFilter(''); setLocationFilter(''); setLanguageFilter(''); setSalaryFilter(''); setIndustryFilter('') }}
                className="h-9 text-xs gap-1"
              >
                <X className="size-3" />
                {t('jobs.clearFilters')} ({activeFilterCount})
              </Button>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Loading state */}
      {isLoading && (loaderData?.jobs?.length ?? 0) === 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-lg border border-border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-center py-16">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <p className="text-foreground font-medium">{t('jobs.errorTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : ''}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {/* Job card grid */}
      {((loaderData?.jobs?.length ?? 0) > 0 || !isLoading) && !isError && filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job, i) => (
            <JobListItem key={job.id} job={job} index={i} companyOverride={loaderCompaniesById.get(job.companyId)} />
          ))}
        </div>
      )}

      {/* Load more (server-side pagination) */}
      {!isLoading && !isError && hasNextPage && remainingJobs > 0 && (
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="gap-2"
          >
            {isFetchingNextPage ? (
              <>
                <span className="inline-block size-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                {t('jobs.loadMore')}
                <span className="text-xs text-muted-foreground">({Math.min(JOBS_PAGE_SIZE, remainingJobs)})</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">
            {loadedJobs.length > 0
              ? t('jobs.emptyFiltered')
              : t('jobs.emptyDb')}
          </p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => { setSearch(''); setLevelFilter('') }}
          >
            {t('jobs.clearFilters')}
          </Button>
        </div>
      )}
    </div>
  )
}
