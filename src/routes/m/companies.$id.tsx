import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, BadgeCheck, Briefcase, Building2, ExternalLink, Factory, MapPin, Users } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { useAllCompanies } from '@/hooks/useCompanies'
import { useAllJobs } from '@/hooks/useJobs'
import type { Company, Job } from '@/types'
export const Route = createFileRoute('/m/companies/$id')({
  head: () => ({ meta: [{ title: 'Company — Impulsa Talentos' }, { name: 'theme-color', content: '#1f3a8a' }] }),
  component: MobileCompanyDetail,
})

function isOpen(j: Job) {
  return j.status === 'open' && j.moderationStatus !== 'pending'
}

function MobileCompanyDetail() {
  const { t } = useI18n()
  const { id } = useParams({ from: '/m/companies/$id' })
  const { data: allCompanies } = useAllCompanies()
  const { data: allJobs } = useAllJobs()
  const company: Company | null = allCompanies?.find(c => c.id === id) ?? null
  if (!company) {
    return (
      <div className="px-5 py-16 text-center">
        <Building2 className="mx-auto size-10 text-muted-foreground" />
        <h2 className="mt-4 font-serif text-2xl font-bold text-foreground">{t('companies.notFound')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('companies.notFoundDesc')}</p>
        <Link to="/m/companies" className="mt-4 inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground">{t('companies.back')}</Link>
      </div>
    )
  }
  const openJobs = (allJobs ?? []).filter(j => j.companyId === company.id && isOpen(j))
  return (
    <div className="px-5 pt-5 pb-8">
      <Link to="/m/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('companies.back')}
      </Link>
      <div className="mt-4 flex items-start gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
          <Building2 className="size-7" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-2xl font-bold text-foreground">{company.name}</h1>
            {company.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <BadgeCheck className="size-3.5" /> {t('verification.verified')}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {company.location && <span className="flex items-center gap-1"><MapPin className="size-3.5 text-accent" />{company.location}</span>}
            {company.industry && <span className="flex items-center gap-1"><Factory className="size-3.5 text-accent" />{company.industry}</span>}
            {company.size && <span className="flex items-center gap-1"><Users className="size-3.5 text-accent" />{company.size}</span>}
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="size-3.5" /> {company.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><Briefcase className="size-4" /></div>
        <p className="text-sm font-semibold">{t('companies.openRoles', { n: openJobs.length })}</p>
      </div>
      {company.description && (
        <div className="mt-5 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h2 className="text-base font-semibold">{t('companies.about', { name: company.name })}</h2></div>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{company.description}</p>
        </div>
      )}
      <div className="mt-5 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Briefcase className="size-5 text-primary" />{t('companies.openPositions')}{openJobs.length > 0 ? ` (${openJobs.length})` : ''}</h2>
        {openJobs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('companies.noOpen')}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {openJobs.slice(0, 6).map(job => (
              <Link key={job.id} to="/m/jobs/$id" params={{ id: job.id }} className="block rounded-lg border border-border p-3 active:bg-accent/30">
                <p className="text-sm font-semibold text-foreground">{job.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{company.location}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
