import { createFileRoute, Link } from '@tanstack/react-router'
import { PublicHeader } from '@/components/PublicHeader'
import { useRef, useState, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAllCompanies, useCompanyById, fetchCompanyById } from '@/hooks/useCompanies'
import { useAllJobs } from '@/hooks/useJobs'
import { useCompanyReviews, useCreateReview } from '@/hooks/useCompanyReviews'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import {
  Building2,
  MapPin,
  Globe,
  Users,
  Briefcase,
  ArrowLeft,
  ExternalLink,
  Factory,
  TrendingUp,
  Star,
  MessageSquare,
  Send,
  BadgeCheck,
} from 'lucide-react'
import type { Company, Job, CompanyReview } from '@/types'

export const Route = createFileRoute('/companies/$id')({
  // Server-side loader: fetches the company during SSR/prerender so crawlers
  // and direct visits receive real content (name, description) instead of the
  // landing-page fallback. Runs at build time for prerendered pages and on the
  // client during navigation (data is then re-fetched by the query hooks).
  loader: async ({ params }) => {
    try {
      const company = await fetchCompanyById(params.id)
      return { company }
    } catch (err) {
      console.error('[companies/$id loader]', err)
      return { company: null }
    }
  },
  head: (ctx) => {
    const company = ctx.loaderData?.company
    return {
      meta: [
        {
          title: company
            ? `${company.name} — Careers | Impulsa Talentos`
            : 'Company — Impulsa Talentos',
        },
        {
          name: 'description',
          content: company?.description
            ? company.description.slice(0, 160)
            : 'Company profile on Impulsa Talentos — bilingual talent recruitment platform.',
        },
      ],
    }
  },
  component: CompanyProfilePage,
})

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

function CompanyProfilePage() {
  const params = Route.useParams()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = Route.useNavigate()
  const { t } = useI18n()
  // Loader data (server-rendered during prerender) is the first-paint source of
  // truth; the query hook refreshes it in the browser after hydration.
  const loaderData = Route.useLoaderData()
  const { data: companyQuery, isLoading, isError } = useCompanyById(params.id)
  const company = companyQuery ?? loaderData?.company ?? null
  const { data: allJobs } = useAllJobs()
  const { data: reviews, isLoading: reviewsLoading } = useCompanyReviews(params.id)

  const openJobs = (allJobs ?? []).filter(j => j.companyId === params.id && j.status === 'open')

  if (isLoading && !loaderData?.company) {
    return (
      <div id="main" className="p-6 max-w-4xl mx-auto">
      <PublicHeader transparentOnTop={false} />
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-24 rounded bg-muted" />
          <div className="h-12 w-64 rounded bg-muted" />
          <div className="h-4 w-96 rounded bg-muted" />
          <div className="h-32 rounded-lg bg-muted mt-6" />
          <div className="h-48 rounded-lg bg-muted" />
        </div>
      </div>
    )
  }

  if ((isError && !loaderData?.company) || !company) {
    return (
      <div id="main" className="p-6 max-w-3xl mx-auto text-center py-20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <Building2 className="size-7 text-destructive" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-foreground">Company not found</h2>
        <p className="mt-2 text-muted-foreground">
          The company profile you're looking for doesn't exist or has been removed.
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <Link to="/jobs">{t('jobDetail.viewAll')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div id="main" className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <FadeIn>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
      </FadeIn>

      {/* Header */}
      <FadeIn delay={0.05}>
        <div className="mb-8">
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Logo placeholder */}
            <div className="flex items-center justify-center h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Building2 className="size-8 sm:size-10" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">{company.name}</h1>
                {company.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                    <BadgeCheck className="size-3.5" />
                    {t('verification.verified')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {company.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5 text-accent" />
                    {company.location}
                  </span>
                )}
                {company.industry && (
                  <span className="flex items-center gap-1">
                    <Factory className="size-3.5 text-accent" />
                    {company.industry}
                  </span>
                )}
                {company.size && (
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5 text-accent" />
                    {company.size}
                  </span>
                )}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="size-3.5" />
                    {company.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Stats */}
      {openJobs.length > 0 && (
        <FadeIn delay={0.08}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600">
                    <Briefcase className="size-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground font-serif">{openJobs.length}</p>
                    <p className="text-[11px] text-muted-foreground">Open positions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <StatPill value={allJobs?.filter(j => j.companyId === company.id && j.status !== 'draft').length ?? 0} label="Total posted" color="blue" />
            <StatPill value={allJobs?.filter(j => j.companyId === company.id && j.status === 'open').length ?? 0} label="Now hiring" color="emerald" />
          </div>
        </FadeIn>
      )}

      {/* About */}
      {company.description && (
        <FadeIn delay={0.1}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="size-5 text-primary" />
                About {company.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{company.description}</p>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Open positions */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="size-5 text-primary" />
                Open positions {openJobs.length > 0 && `(${openJobs.length})`}
              </CardTitle>
              <CardDescription>
                {openJobs.length > 0
                  ? `Current job openings at ${company.name} for bilingual professionals.`
                  : `${company.name} doesn't have any open positions right now. Check back soon.`}
              </CardDescription>
            </div>
            {openJobs.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/jobs">View all jobs</Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {openJobs.length === 0 ? (
              <div className="text-center py-8">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
                  <Briefcase className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No open positions at the moment.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/jobs">Browse other jobs</Link>
                </Button>
              </div>
            ) : (
              openJobs.slice(0, 6).map(job => (
                <JobRow key={job.id} job={job} companyName={company.name} />
              ))
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Company reviews */}
      <FadeIn delay={0.2}>
        <ReviewsSection companyId={company.id} reviews={reviews ?? []} isLoading={reviewsLoading} />
      </FadeIn>
    </div>
  )
}

function StatPill({ value, label, color }: { value: number; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/30 text-blue-700 bg-blue-500/5',
    emerald: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
  }
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-2xl font-bold text-foreground font-serif">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

function formatSalary(job: Job): string {
  if (!job.salaryMin && !job.salaryMax) return 'Salary to be agreed'
  const min = job.salaryMin ? job.salaryMin.toLocaleString('en-US') : '?'
  const max = job.salaryMax ? job.salaryMax.toLocaleString('en-US') : '?'
  const ccy = job.currency || 'COP'
  return `${ccy} ${min} - ${max}`
}

function timeAgo(iso: string): string {
  if (!iso) return 'Recent'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/* ── Reviews section ──────────────────────────────────── */
function ReviewsSection({ companyId, reviews, isLoading }: { companyId: string; reviews: CompanyReview[]; isLoading: boolean }) {
  const { t } = useI18n()
  const { user, isAuthenticated } = useAuth()
  const createReview = useCreateReview()
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  const handleSubmit = async () => {
    if (!title.trim() || !body.trim()) return
    try {
      await createReview.mutateAsync({
        companyId,
        reviewerId: user?.id ?? '',
        rating,
        title: title.trim(),
        body: body.trim(),
      })
      toast.success(t('reviews.success'))
      setShowForm(false)
      setTitle('')
      setBody('')
      setRating(5)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reviews.error'))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="size-5 text-primary" />
            {t('reviews.title')}
            {reviews.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {t('reviews.count', { count: reviews.length, plural: reviews.length !== 1 ? 's' : '' })}
              </span>
            )}
          </CardTitle>
          {avgRating && (
            <CardDescription className="flex items-center gap-1 mt-1">
              <span className="font-semibold text-foreground">{avgRating}</span>
              <span className="text-muted-foreground">{t('reviews.average')}</span>
              <span className="inline-flex gap-0.5 ml-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star
                    key={i}
                    className={`size-3 ${i <= Math.round(Number(avgRating)) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'}`}
                  />
                ))}
              </span>
            </CardDescription>
          )}
        </div>
        {isAuthenticated ? (
          !showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
              <Star className="size-3.5" />
              {t('reviews.add')}
            </Button>
          )
        ) : (
          <Button variant="outline" size="sm" onClick={() => useAuth().login()} className="gap-1.5">
            {t('reviews.signIn')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* Review form */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-1">
              <label className="text-xs font-medium text-muted-foreground mr-2">{t('reviews.rating')}:</label>
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  className="cursor-pointer"
                >
                  <Star
                    className={`size-5 transition-colors ${i <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30'}`}
                  />
                </button>
              ))}
            </div>
            <Input
              placeholder={t('reviews.titleField')}
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-9"
            />
            <textarea
              placeholder={t('reviews.bodyPlaceholder')}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground resize-y outline-none focus-visible:border-ring"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={createReview.isPending || !title.trim() || !body.trim()}
                className="gap-1.5"
              >
                {createReview.isPending ? (
                  <><span className="inline-block size-3 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> {t('reviews.submitting')}</>
                ) : (
                  <><Send className="size-3.5" /> {t('reviews.submit')}</>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t('reviews.cancel')}
              </Button>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && reviews.length === 0 && (
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
              <MessageSquare className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('reviews.empty')}</p>
          </div>
        )}
        <div className="space-y-3">
          {reviews.slice(0, 10).map(review => (
            <div key={review.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center justify-center h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {review.reviewerId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">{review.title}</p>
                    <p className="text-[11px] text-muted-foreground">{timeAgo(review.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="size-3 text-amber-500 fill-amber-500" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{review.body}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function JobRow({ job, companyName }: { job: Job; companyName: string }) {
  const { t } = useI18n()
  const skills = job.skillsRequired
    ? job.skillsRequired.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return (
    <Link
      to="/jobs/$id"
      params={{ id: job.id }}
      className="group block rounded-lg border border-border p-4 hover:bg-accent/30 hover:border-accent/50 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
            {job.title}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1"><MapPin className="size-3" />{formatLocationType(job.locationType, t)}</span>
            <span>·</span>
            <span>{formatSalary(job)}</span>
            <span>·</span>
            <span>{timeAgo(job.createdAt)}</span>
          </p>
        </div>
        <TrendingUp className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
      </div>
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {skills.slice(0, 4).map(skill => (
            <span
              key={skill}
              className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/40"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
