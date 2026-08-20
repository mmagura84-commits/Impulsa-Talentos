import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useJob, fetchJob } from '@/hooks/useJobs'
import { useCompanyById, fetchCompanyById } from '@/hooks/useCompanies'
import { useMyApplications } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { SocialShare } from '@/components/SocialShare'
import { SaveJobButton } from '@/components/SaveJobButton'
import { ReportJobButton } from '@/components/ReportJobButton'
import { MarkdownPreview } from '@/components/MarkdownPreview'
import {
  MapPin,
  Clock,
  Briefcase,
  Globe,
  DollarSign,
  ArrowLeft,
  Send,
  Building2,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import type { Job } from '@/types'
import type { Locale } from '@/i18n/types'

export const Route = createFileRoute('/_app/jobs/$id')({
  loader: async ({ params }) => {
    try {
      const job = await fetchJob(params.id)
      const company = job?.companyId ? await fetchCompanyById(job.companyId) : null
      return { job, company }
    } catch (err) {
      console.error('[jobs/$id loader]', err)
      return { job: null, company: null }
    }
  },
  head: (ctx) => {
    const job = ctx.loaderData?.job
    const company = ctx.loaderData?.company
    return {
      meta: [
        { title: job ? `${job.title} — ${company?.name ?? 'Impulsa Talentos'} | Impulsa Talentos` : 'Job — Impulsa Talentos' },
        { name: 'description', content: job?.description ? job.description.slice(0, 150) : 'Job listing on Impulsa Talentos — bilingual jobs in Colombia.' },
      ],
    }
  },
  component: JobDetailPage,
})

/* ── Animation helper ─── */
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

function splitList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(/[,;|]/).map(x => x.trim()).filter(Boolean)
}

/* ── Apply button ──────────────────────────────────────── */
function ApplyButton({ jobId, candidateProfileId }: { jobId: string; candidateProfileId: string | null }) {
  const navigate = useNavigate()
  const { data: myApps } = useMyApplications(candidateProfileId ?? undefined)
  const { t } = useI18n()
  const alreadyApplied = !!myApps?.some(a => a.jobId === jobId)

  if (alreadyApplied) {
    const lastApp = myApps?.find(a => a.jobId === jobId)
    return (
      <Button
        size="lg"
        variant="secondary"
        disabled
        onClick={() => {
          if (!lastApp) return
          navigate({
            to: '/apply/$id/confirm',
            params: { id: jobId },
            search: { appId: lastApp.id },
          })
        }}
        className="gap-2 shrink-0 bg-emerald-600 text-white hover:bg-emerald-600 disabled:opacity-100!"
      >
        <CheckCircle2 className="size-4" />
        {t('jobDetail.applied')}
      </Button>
    )
  }

  return (
    <Button
      size="lg"
      onClick={() => {
        if (!candidateProfileId) {
          toast.error(t('jobDetail.applyErrorProfile'), {
            description: t('jobDetail.applyErrorProfileDesc'),
          })
          return
        }
        navigate({ to: '/apply/$id', params: { id: jobId } })
      }}
      className="gap-2 font-medium shrink-0"
    >
      <Send className="size-4" />
      {t('jobDetail.applyCta')}
    </Button>
  )
}

/* ── Page ──────────────────────────────────────────────── */
function JobDetailPage() {
  const { id } = useParams({ from: '/_app/jobs/$id' })
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { locale, t } = useI18n()

  const loaderData = Route.useLoaderData()
  const { data: jobQuery, isLoading, isError, error, refetch } = useJob(id)
  const job = jobQuery ?? loaderData?.job ?? null
  const { data: company } = useCompanyById(job?.companyId)

  if (isLoading && !loaderData?.job) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-4 w-32 rounded bg-muted animate-pulse mb-6" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-5 w-1/2 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
          <div className="h-40 rounded-lg bg-muted animate-pulse mt-6" />
          <div className="h-32 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    )
  }

  if (isError && !loaderData?.job) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <AlertCircle className="size-7 text-destructive" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-foreground">{t('jobDetail.errorTitle')}</h2>
        <p className="mt-2 text-muted-foreground">
          {error instanceof Error ? error.message : ''}
        </p>
        <Button variant="outline" className="mt-6" onClick={() => refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="size-7 text-destructive" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-foreground">{t('jobDetail.notFoundTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('jobDetail.notFoundDesc')}</p>
        <Button variant="outline" className="mt-6" asChild>
          <Link to="/jobs">{t('jobDetail.viewAll')}</Link>
        </Button>
      </div>
    )
  }

  const skills = splitList(job.skillsRequired)
  const responsibilities = splitList(job.description).filter(l => l.startsWith('-') || l.startsWith('•'))
  const descriptionText = job.description
  const companyName = company?.name ?? t('jobDetail.confidential')
  const candidateProfileId = profile?.id ?? null

  return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Back link */}
        <FadeIn>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="size-4" />
            {t('jobDetail.back')}
          </Link>
        </FadeIn>

        {/* Header */}
        <FadeIn delay={0.05}>
          <div className="mb-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">{job.title}</h1>
                <p className="mt-1.5 text-lg font-medium text-foreground/80 flex items-center gap-1.5">
                  <Building2 className="size-4 text-primary" />
                  {company?.id ? (
                    <Link to="/companies/$id" params={{ id: company.id }} className="hover:text-primary hover:underline">
                      {companyName}
                    </Link>
                  ) : companyName}
                </p>
                {company?.location && (
                  <p className="text-sm text-muted-foreground mt-1">{company.location}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <SaveJobButton jobId={job.id} variant="chip" />
                <ReportJobButton jobId={job.id} />
                <ApplyButton jobId={job.id} candidateProfileId={candidateProfileId} />
              </div>
            </div>

            {/* Meta bar */}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-accent" /> {formatLocationType(job.locationType, t)}
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="size-4 text-accent" /> {formatSalary(job, locale)}
              </span>
              {job.level && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="size-4 text-accent" /> {job.level}
                </span>
              )}
              {job.languagesRequired && (
                <span className="flex items-center gap-1.5">
                  <Globe className="size-4 text-accent" /> {formatLanguageList(job.languagesRequired, t)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-accent" /> {formatPosted(job.createdAt, t)}
              </span>
            </div>

            {/* Skills */}
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {skills.map(skill => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground bg-muted/50"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}

            {/* Closed banner */}
            {job.status !== 'open' && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <XCircle className="size-4" />
                {t('jobDetail.closedBanner')}
              </div>
            )}
          </div>
        </FadeIn>

        {/* Description */}
        <FadeIn delay={0.1}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{t('jobDetail.description')}</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownPreview source={descriptionText} />
            </CardContent>
          </Card>
        </FadeIn>

        {/* Responsibilities */}
        {responsibilities.length > 0 && (
          <FadeIn delay={0.15}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">{t('jobDetail.responsibilities')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {responsibilities.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{item.replace(/^[-•]\s*/, '')}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* About the company */}
        {company && (
          <FadeIn delay={0.2}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">{t('jobDetail.about', { company: companyName })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {company.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{company.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
                  {company.industry && <span>{t('jobDetail.industry')}: {company.industry}</span>}
                  {company.size && <span>{t('jobDetail.size')}: {company.size}</span>}
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {company.website}
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        {/* Bottom CTA */}
        <FadeIn delay={0.25}>
          <div className="flex flex-col sm:flex-row items-center gap-4 p-6 rounded-xl border border-border bg-card">
            <div className="flex-1">
              <p className="font-semibold text-foreground">{t('jobDetail.bottomTitle')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {user ? t('jobDetail.bottomAuthed') : t('jobDetail.bottomAuth')}
              </p>
            </div>
            <ApplyButton jobId={job.id} candidateProfileId={candidateProfileId} />
          </div>
        </FadeIn>

        {/* Social share / refer */}
        <FadeIn delay={0.3}>
          <div className="mt-6">
            <SocialShare
              variant="inline"
              title={`${job.title} — ${companyName}`}
              description={descriptionText.split('\n')[0]?.slice(0, 200) || undefined}
              referralMode
              referralHandle={user?.displayName ?? t('social.aFriend')}
            />
          </div>
        </FadeIn>
      </div>
  )
}
