import { createFileRoute, Link } from '@tanstack/react-router'
import { PublicHeader } from '@/components/PublicHeader'
import { motion, useInView } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, Briefcase, Building2, MapPin } from 'lucide-react'
import { useAllCompanies, fetchAllCompanies } from '@/hooks/useCompanies'
import { useAllJobs, fetchAllJobs } from '@/hooks/useJobs'
import { useI18n } from '@/i18n/I18nProvider'
import type { Company, Job } from '@/types'

export const Route = createFileRoute('/companies/')({
  loader: async () => {
    try {
      const [companies, jobs] = await Promise.all([fetchAllCompanies(), fetchAllJobs()])
      return { companies, jobs }
    } catch (err) {
      console.error('[companies loader]', err)
      return { companies: [], jobs: [] }
    }
  },
  head: () => ({
    meta: [
      { title: 'Companies Hiring — Impulsa Talentos' },
      { name: 'description', content: 'Browse companies hiring bilingual talent in Colombia — tech, CX, healthcare, finance, and marketing teams looking for English + Spanish professionals.' },
    ],
  }),
  component: CompaniesIndexPage,
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

function CompanyCard({ company, openCount }: { company: Company; openCount: number }) {
  const { t } = useI18n()
  return (
    <Link
      to="/companies/$id"
      params={{ id: company.id }}
      className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={`${company.name} logo`} className="size-full rounded-lg object-cover" />
          ) : (
            company.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 font-semibold text-foreground transition-colors group-hover:text-primary">
            <span className="truncate">{company.name}</span>
            {company.verified && (
              <BadgeCheck className="size-4 shrink-0 text-emerald-600" />
            )}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{company.industry}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 truncate">
          <MapPin className="size-3.5 shrink-0 text-primary" />
          <span className="truncate">{company.location || 'Remote'}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
          <Briefcase className="size-3" />
          {t('companies.openRoles', { n: openCount })}
        </span>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {t('companies.viewCompany')}
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  )
}

function CompaniesIndexPage() {
  const { t } = useI18n()
  const loaderData = Route.useLoaderData()
  const { data: allCompanies, isLoading } = useAllCompanies()
  const { data: allJobs } = useAllJobs()
  const companiesAll = allCompanies ?? loaderData?.companies ?? []
  const jobsAll = allJobs ?? loaderData?.jobs ?? []

  const openJobs = (jobsAll ?? []).filter((j: Job) => j.status === 'open' && j.moderationStatus !== 'pending')
  const openCounts = new Map<string, number>()
  for (const job of openJobs) {
    openCounts.set(job.companyId, (openCounts.get(job.companyId) ?? 0) + 1)
  }
  const companies = [...(companiesAll ?? [])].sort(
    (a, b) => (openCounts.get(b.id) ?? 0) - (openCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name),
  )

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader transparentOnTop={false} />
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        {/* Back link */}
        <FadeIn>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t('companies.back')}
          </Link>
        </FadeIn>

        {/* Header */}
        <FadeIn delay={0.05}>
          <div className="mt-5 mb-10 max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                {t('companies.count', { n: companies.length })}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('companies.title')}
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed">{t('companies.subtitle')}</p>
          </div>
        </FadeIn>

        {/* Company grid */}
        {isLoading && (loaderData?.companies?.length ?? 0) === 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (loaderData?.companies?.length ?? 0) === 0 && companies.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">{t('companies.empty')}</p>
          </div>
        )}

        {((loaderData?.companies?.length ?? 0) > 0 || !isLoading) && companies.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company, i) => (
              <FadeIn key={company.id} delay={(i % 3) * 0.06}>
                <CompanyCard company={company} openCount={openCounts.get(company.id) ?? 0} />
              </FadeIn>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
