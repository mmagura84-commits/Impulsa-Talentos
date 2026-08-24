import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router'
import { Building2, MapPin, Briefcase } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { useAllCompanies } from '@/hooks/useCompanies'
import { useAllJobs } from '@/hooks/useJobs'
import type { Company, Job } from '@/types'
export const Route = createFileRoute('/m/companies')({
  head: () => ({ meta: [{ title: 'Companies — Impulsa Talentos' }, { name: 'theme-color', content: '#1f3a8a' }] }),
  component: MobileCompanies,
})

function isOpen(j: Job) {
  return j.status === 'open' && j.moderationStatus !== 'pending'
}

function MobileCompanies() {
  const matchRoute = useMatchRoute()
  // When the child detail route (/m/companies/$id) is active, render only
  // the detail component.
  if (matchRoute({ to: '/m/companies/$id' })) {
    return (
      <div className="px-4 pt-4 pb-2">
        <Outlet />
      </div>
    )
  }
  // List content lives in a separate component so ALL hooks are
  // unconditional per component (React #310 rules-of-hooks).
  return <MobileCompaniesList />
}

function MobileCompaniesList() {
  const { t } = useI18n()
  const { data: allCompanies } = useAllCompanies()
  const { data: allJobs } = useAllJobs()
  const openJobs = (allJobs ?? []).filter(isOpen)
  const openCounts = new Map<string, number>()
  for (const job of openJobs) openCounts.set(job.companyId, (openCounts.get(job.companyId) ?? 0) + 1)
  const companies = [...(allCompanies ?? [])].sort(
    (a, b) => (openCounts.get(b.id) ?? 0) - (openCounts.get(a.id) ?? 0) || a.name.localeCompare(b.name),
  )
  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></div>
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">{t('companies.count', { n: companies.length })}</span>
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{t('companies.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t('companies.subtitle')}</p>
      </div>
      <div className="px-5 pb-8">
        {companies.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">{t('companies.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(company => (
              <Link key={company.id} to="/m/companies/$id" params={{ id: company.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">{company.name.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{company.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />{company.location || company.industry}
                  </p>
                </div>
                {(openCounts.get(company.id) ?? 0) > 0 && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary flex items-center gap-1">
                    <Briefcase className="size-3" />{t('companies.openRoles', { n: openCounts.get(company.id) ?? 0 })}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
