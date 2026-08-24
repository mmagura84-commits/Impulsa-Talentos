import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  Building2,
  Globe,
  Heart,
  HeartPulse,
  Languages,
  Landmark,
  Sparkles,
  MapPin,
  Code2,
  Headphones,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuth } from '@/hooks/useAuth'
import { useAllJobs } from '@/hooks/useJobs'
import { useAllCompanies } from '@/hooks/useCompanies'
import { heroPhoto, cityscapePhoto } from '@/lib/media'
import { INDUSTRIES, INDUSTRY_FAMILIES } from '@/lib/industries'
import type { Company, Job } from '@/types'
export const Route = createFileRoute('/m/')({
  head: () => ({
    meta: [
      { title: 'Impulsa Talentos — Mobile' },
      { name: 'description', content: 'Bilingual jobs in your pocket.' },
      { name: 'theme-color', content: '#1f3a8a' },
    ],
  }),
  component: MobileLanding,
})

function isOpen(j: Job) {
  return j.status === 'open' && j.moderationStatus !== 'pending'
}

const CITY_META: { key: string; nameKey: string; tagKey: string; photo: string }[] = [
  { key: 'medellin', nameKey: 'landing.cityMedellin', tagKey: 'landing.cityMedellinTag', photo: '/images/professional-medellin-v2.webp' },
  { key: 'bogota', nameKey: 'landing.cityBogota', tagKey: 'landing.cityBogotaTag', photo: '/images/professional-bogota-v2.webp' },
  { key: 'cartagena', nameKey: 'landing.cityCartagena', tagKey: 'landing.cityCartagenaTag', photo: '/images/professional-cartagena-v2.webp' },
  { key: 'cali', nameKey: 'landing.cityCali', tagKey: 'landing.cityCaliTag', photo: '/images/professional-cali-v2.webp' },
  { key: 'barranquilla', nameKey: 'landing.cityBarranquilla', tagKey: 'landing.cityBarranquillaTag', photo: '/images/professional-barranquilla-v2.webp' },
]

function MobileLanding() {
  const { t } = useI18n()
  const { isAuthenticated, login } = useAuth()
  const { data: allJobs } = useAllJobs()
  const { data: allCompanies } = useAllCompanies()
  const openJobs = (allJobs ?? []).filter(isOpen)
  // Company ribbon — same sort as desktop (by open-role count desc).
  const companyOpenCounts = new Map<string, number>()
  for (const job of openJobs) companyOpenCounts.set(job.companyId, (companyOpenCounts.get(job.companyId) ?? 0) + 1)
  const companies = [...(allCompanies ?? [])].sort(
    (a, b) => (companyOpenCounts.get(b.id) ?? 0) - (companyOpenCounts.get(a.id) ?? 0),
  )
  // Per-industry counts for the industri es grid.
  const industryCounts = new Map<string, number>()
  for (const j of openJobs) if (j.industry) industryCounts.set(j.industry, (industryCounts.get(j.industry) ?? 0) + 1)
  // Per-city open counts.
  const cityCounts = new Map<string, number>()
  for (const city of CITY_META) {
    const re =
      city.key === 'medellin' ? /medell/i : city.key === 'bogota' ? /bogot/i : city.key === 'cartagena' ? /cartagena/i : city.key === 'cali' ? /\bcali\b/i : /barranquilla/i
    cityCounts.set(city.key, openJobs.filter(j => re.test(j.locationType || '')).length)
  }
  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative px-5 pt-6 pb-10 overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-25" aria-hidden="true">
          <img src={cityscapePhoto.src} alt="" className="size-full object-cover" loading="eager" fetchPriority="high" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/95 to-background" />
        </div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-accent" /> {t('landing.badge')}
          </span>
          <h1 className="mt-4 font-serif text-[2.2rem] leading-[1.05] font-bold tracking-tight text-foreground">
            {t('landing.heroTitle1')}
            <span className="block text-accent">{t('landing.heroTitle2')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{t('landing.heroSub')}</p>
          <div className="mt-5 flex flex-col gap-2.5">
            <Button asChild size="lg" className="h-12 w-full text-base font-semibold">
              <Link to="/m/jobs">{t('mobile.hero.cta')} <ArrowRight className="size-4" /></Link>
            </Button>
            {!isAuthenticated && (
              <Button onClick={login} size="lg" variant="outline" className="h-12 w-full text-base font-semibold">
                {t('mobile.authRequiredCta')}
              </Button>
            )}
          </div>
        </motion.div>
      </section>

      {/* ── Value props ───────────────────────────────────── */}
      <section className="px-5 space-y-3 pb-8">
        <ValueRow icon={Briefcase} title={t('landing.candidates.s3.title')} desc={t('landing.candidates.s3.desc')} />
        <ValueRow icon={Heart} title={t('savedJobs.title')} desc={t('savedJobs.desc')} />
        <ValueRow icon={Building2} title={t('landing.employers.s3.title')} desc={t('landing.employers.s3.desc')} />
        <ValueRow icon={Globe} title={t('landing.hero.aiMatching')} desc={t('landing.hero.subtitle')} />
      </section>

      {/* ── Company ribbon (parity w/ desktop, vertical static) ── */}
      {companies.length > 0 && (
        <section aria-label={t('landing.trustedBy', { n: companies.length })} className="bg-primary px-5 py-4">
          <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-white/70">{t('landing.trustedBy', { n: companies.length })}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {companies.slice(0, 8).map(c => (
              <Link key={c.id} to="/m/companies/$id" params={{ id: c.id }} className="text-[13px] font-semibold text-white/90">
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Stats bar (parity w/ desktop) ─────────────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="grid grid-cols-2 gap-3 px-5 py-6">
          <StatCard icon={Languages} value="500+" label={t('landing.stats.talentToHire')} />
          <StatCard icon={Building2} value="200+" label={t('landing.stats.companies')} />
          <StatCard icon={Briefcase} value="85%" label={t('landing.stats.placementRate')} />
          <StatCard icon={Briefcase} value="4" label={t('landing.stats.sectors')} />
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section className="px-5 py-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('landing.howTitle')}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('landing.howSub')}</p>
        <div className="mt-5 space-y-3">
          <StepCard step="1" title={t('landing.how1Title')} desc={t('landing.how1Desc')} />
          <StepCard step="2" title={t('landing.how2Title')} desc={t('landing.how2Desc')} />
          <StepCard step="3" title={t('landing.how3Title')} desc={t('landing.how3Desc')} />
        </div>
      </section>

      {/* ── Industries ────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/40 px-5 py-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('industries.sectionTitle')}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{t('industries.sectionSub')}</p>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/m/jobs">{t('industries.viewAll')}</Link></Button>
        </div>
        <div className="mt-5 space-y-3">
          {INDUSTRY_FAMILIES.map(family => (
            <FamilyCard key={family.slug} family={family} counts={industryCounts} />
          ))}
          <Link to="/m/home" className="flex items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/[.03] p-4">
            <Sparkles className="size-5 text-primary shrink-0" />
            <div className="min-w-0"><p className="text-sm font-semibold">{t('industries.ctaTitle')}</p><p className="text-xs text-muted-foreground mt-0.5">{t('industries.ctaDesc')}</p></div>
          </Link>
        </div>
      </section>

      {/* ── Cities: Where the talent is ───────────────────── */}
      <section className="border-t border-border bg-background px-5 py-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('landing.citiesTitle')}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{t('landing.citiesSub')}</p>
        <div className="mt-5 space-y-3">
          {CITY_META.map(city => (
            <Link key={city.key} to="/m/jobs" className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <img src={city.photo} alt="" loading="lazy" className="size-12 rounded-lg object-cover shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="size-3.5 text-primary" />{t(city.nameKey)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(city.tagKey)}</p>
              </div>
              <span className="ml-auto text-xs font-semibold text-primary shrink-0">
                {(cityCounts.get(city.key) ?? 0) > 0 ? t('landing.cityOpen', { n: cityCounts.get(city.key) ?? 0 }) : t('landing.cityComingSoon')}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Employer CTA ──────────────────────────────────── */}
      <section className="border-t border-border bg-primary/[.04] px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">{t('landing.employerCtaEyebrow')}</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">{t('landing.employerCtaTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('landing.employerCtaDesc')}</p>
        <Button asChild size="lg" className="mt-5 w-full h-12"><Link to="/m/post">{t('landing.employerCtaAction')} <ArrowRight className="size-4" /></Link></Button>
      </section>

      {/* ── Footer CTA ────────────────────────────────────── */}
      <section className="border-t border-border px-5 py-8">
        <h2 className="text-center text-xl font-bold tracking-tight">{t('landing.footerTitle')}</h2>
        <Button asChild size="lg" className="mt-4 w-full h-12"><Link to="/m/jobs">{t('landing.footerPrimary')}</Link></Button>
        <Button asChild size="lg" variant="outline" className="mt-2 w-full h-12"><Link to="/m/jobs">{t('landing.footerSecondary')}</Link></Button>
      </section>
    </div>
  )
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <span className="absolute -top-1 right-3 text-5xl font-bold text-primary/10">{step}</span>
      <p className="text-xs font-bold uppercase tracking-widest text-primary">0{step}</p>
      <h3 className="mt-1 font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  )
}

function StatCard({ icon: Icon, value, label }: { icon: React.ElementType; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div>
      <div className="min-w-0"><p className="text-xl font-bold leading-none">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
    </div>
  )
}

function FamilyCard({ family, counts }: { family: { slug: string; icon: string; members: string[] }; counts: Map<string, number> }) {
  const { t } = useI18n()
  const total = family.members.reduce((n, m) => n + (counts.get(m) ?? 0), 0)
  const MapIcon = family.icon === 'Code2' ? Code2 : family.icon === 'Landmark' ? Landmark : family.icon === 'Headphones' ? Headphones : family.icon === 'Truck' ? Truck : HeartPulse
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapIcon className="size-5" /></div>
        {total > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{t('industries.open', { n: total })}</span>}
      </div>
      <h3 className="mt-3 font-semibold">{t(`industries.family.${family.slug}`)}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {family.members.filter(m => (counts.get(m) ?? 0) > 0).map(m => {
          const slug = INDUSTRIES.find(x => x.canonical === m)?.slug
          return slug ? <Link key={m} to="/m/jobs" search={{ industry: slug }} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{t(`industries.${slug}`)} <b className="text-primary">{counts.get(m)}</b></Link> : null
        })}
        {total === 0 && <p className="text-xs text-muted-foreground/70">{t('industries.comingSoon')}</p>}
      </div>
    </div>
  )
}

function ValueRow({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground">{title}</p><p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">{desc}</p></div>
    </div>
  )
}
