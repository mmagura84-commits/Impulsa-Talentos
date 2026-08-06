import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarCheck,
  Clock,
  Code2,
  DollarSign,
  FileText,
  Globe,
  Headphones,
  HeartPulse,
  Landmark,
  Languages,
  MapPin,
  Megaphone,
  Menu,
  X,
  Sparkles,
  Search,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { useAllJobs } from '@/hooks/useJobs'
import { useAllCompanies } from '@/hooks/useCompanies'
import { BrandMark } from '@/components/BrandMark'
import { LanguageToggle } from '@/components/LanguageToggle'
import { PublicHeader } from '@/components/PublicHeader'
import type { Job, Company } from '@/types'
import { INDUSTRIES, INDUSTRY_FAMILIES } from '@/lib/industries'
import { candidatesPhoto } from '@/lib/media'
import { useRef, type ReactNode } from 'react'
import { captureUTMParams, trackEvent } from '@/lib/marketing'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Impulsa Talentos — Bilingual Jobs in Colombia' },
      { name: 'description', content: 'Bilingual careers for Colombia\'s top talent. English + Spanish jobs with global employers — tech, CX, healthcare, and finance.' },
    ],
  }),
  component: LandingPage,
})

/* ── Small helpers ─────────────────────────────────────────── */
function isOpen(j: Job) {
  return j.status === 'open' && j.moderationStatus !== 'pending'
}

function SectionReveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Top nav — LinkedIn-style slim header ─────────────────── */
function TopNav() {
  const { t } = useI18n()
  const { user, isLoading } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`sticky top-0 z-30 border-b transition-colors ${scrolled ? 'border-border bg-background/90 backdrop-blur-md' : 'border-transparent bg-transparent'}`}>
      <div className="mx-auto flex h-16 w-full max-w-[88rem] items-center justify-between gap-3 px-5 lg:px-10">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <BrandMark className="size-8 rounded-lg" title={t('brand.name')} />
          <span className={`hidden sm:block text-lg font-bold truncate ${scrolled ? 'text-foreground' : 'text-white'}`}>
            Impulsa Talentos
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm font-medium md:flex" aria-label="Main navigation">
          <Link to="/jobs" className={scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/85 hover:text-white'}>{t('nav.jobs')}</Link>
          <Link to="/companies" className={scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/85 hover:text-white'}>{t('landing.companiesTitle')}</Link>
          <Link to="/dashboard" className={scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/85 hover:text-white'}>{t('nav.forEmployers')}</Link>
          <Link to="/pricing" className={scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/85 hover:text-white'}>{t('pricing.title')}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle compact className={scrolled ? undefined : 'text-white hover:text-white'} />
          <button type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)} className={`inline-flex size-9 items-center justify-center rounded-md md:hidden ${scrolled ? 'text-foreground' : 'text-white'}`}>
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          {isLoading ? (
            <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
          ) : user ? (
            <Button asChild variant="ghost" size="sm" className={`gap-1.5 ${scrolled ? '' : 'text-white hover:bg-white/10 hover:text-white'}`}>
              <Link to="/dashboard">
                <Briefcase className="size-4" />
                {t('landing.dashboard')}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className={scrolled ? '' : 'border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white'}>
              <Link to="/dashboard">{t('landing.signIn')}</Link>
            </Button>
          )}
        </div>
      </div>
      {menuOpen && <div className={`border-t px-5 py-4 md:hidden ${scrolled ? 'border-border bg-background' : 'border-white/15 bg-slate-950/95 backdrop-blur-md'}`}>
        <nav className="flex flex-col gap-3 text-sm font-semibold" aria-label="Mobile navigation">
          <Link to="/jobs" onClick={() => setMenuOpen(false)} className={scrolled ? 'text-foreground' : 'text-white'}>{t('nav.jobs')}</Link>
          <Link to="/companies" onClick={() => setMenuOpen(false)} className={scrolled ? 'text-foreground' : 'text-white'}>{t('landing.companiesTitle')}</Link>
          <Link to="/dashboard" onClick={() => setMenuOpen(false)} className={scrolled ? 'text-foreground' : 'text-white'}>{t('nav.forEmployers')}</Link>
          <Link to="/pricing" onClick={() => setMenuOpen(false)} className={scrolled ? 'text-foreground' : 'text-white'}>{t('pricing.title')}</Link>
        </nav>
      </div>}
    </header>
  )
}

/* ── Hero CTAs — candidate-only (per product direction) ────── */
function LandingCTAs() {
  const { t } = useI18n()
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user) {
    return (
      <Button asChild size="lg" className="h-12 gap-2 bg-white px-7 text-base font-semibold text-slate-900 shadow-lg hover:bg-white/90">
        <Link to="/dashboard">
          <Briefcase className="size-4" />
          {t('landing.ctaGoDashboard')}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    )
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
      <Button asChild size="lg" className="h-12 gap-2 bg-white px-7 text-base font-semibold text-slate-900 shadow-lg hover:bg-white/90">
        <Link to="/jobs">
          <Search className="size-4" />
          {t('landing.ctaSearch')}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button asChild variant="outline" size="lg" className="h-12 gap-2 border-white/40 bg-transparent px-7 text-base font-semibold text-white hover:bg-white/10 hover:text-white">
        <Link to="/for-employers"><Building2 className="size-4" />{t('landing.ctaHire')}</Link>
      </Button>
    </div>
  )
}

/* ── Live job feed — auto-rotating animated widget ─────────── */
function JobFeedPreview() {
  const { t } = useI18n()
  const { data: jobs } = useAllJobs()
  const { data: companies } = useAllCompanies()
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const companyMap = new Map((companies ?? []).map((c: Company) => [c.id, c]))
  const featured = (jobs ?? []).filter(isOpen)
  useEffect(() => {
    if (reduce || paused || featured.length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % featured.length), 3000)
    return () => window.clearInterval(id)
  }, [reduce, paused, featured.length])
  const card = (job: Job) => {
    const company = companyMap.get(job.companyId)
    const salary = job.currency === 'USD' ? `$${job.salaryMin.toLocaleString()}–$${job.salaryMax.toLocaleString()}` : `${job.currency} ${job.salaryMin.toLocaleString()}–${job.salaryMax.toLocaleString()}`
    return <Link to="/jobs/$id" params={{ id: job.id }} className="group flex items-start gap-3 p-4 transition-colors hover:bg-white/5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-sm font-bold text-accent">{company?.logoUrl ? <img src={company.logoUrl} alt={`${company.name} logo`} className="size-full rounded-lg object-cover" /> : (company?.name ?? 'J').charAt(0).toUpperCase()}</div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white group-hover:text-accent">{job.title}</p><p className="truncate text-xs text-white/60">{company?.name ?? 'Impulsa Talentos partner'}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60"><span className="inline-flex items-center gap-1"><MapPin className="size-3" />{formatLocationType(job.locationType, t)}</span><span className="font-medium text-white/80">{salary}</span><span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">{formatLanguageList(job.languagesRequired, t)}</span></div></div><ArrowRight className="size-4 shrink-0 self-center text-white/40 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  }
  return <div data-testid="hero-live-feed" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} className="w-full overflow-hidden rounded-2xl border border-white/15 bg-black/35 shadow-2xl backdrop-blur-md" aria-label={t('landing.feedTitle')}>
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-white"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>{t('landing.feedLiveLabel')}</div><Link to="/jobs" className="text-xs font-medium text-accent hover:underline">{t('landing.feedViewAll')} →</Link></div>
    {featured.length === 0 ? <div className="p-4"><div className="h-20 rounded-lg bg-white/10 animate-pulse" /></div> : reduce ? <div className="divide-y divide-white/10">{featured.slice(0, 3).map(card)}</div> : <div className="relative min-h-[100px]"><AnimatePresence initial={false} mode="wait"><motion.div key={featured[index]?.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>{card(featured[index])}</motion.div></AnimatePresence></div>}
  </div>
}
/* ── Stats bar — LIVE numbers from Supabase ────────────────── */
function StatsBar() {
  const { t } = useI18n()
  const { data: allJobs } = useAllJobs()
  const { data: allCompanies } = useAllCompanies()

  const openJobs = (allJobs ?? []).filter(isOpen)
  const stats = [
    { icon: Languages, label: t('landing.stats.candidates'), value: '500+' },
    { icon: Building2, label: t('landing.stats.companies'), value: '200+' },
    { icon: Briefcase, label: t('landing.stats.placementRate'), value: '85%' },
    { icon: Briefcase, label: t('landing.stats.sectors'), value: '4' },
  ]

  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-5 py-8 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
            className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-4"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <stat.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground leading-none">{stat.value}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* ── Landing page ─────────────────────────────────────────── */
/* ── Colombian city photography (Wikimedia Commons, free license) ── */
const HERO_SLIDES = ['technology', 'finance', 'customer-hospitality', 'operations-logistics', 'healthcare', 'sales-marketing', 'education-training', 'engineering-construction', 'creative-media', 'legal-public-sector'] as const
// Technology is the intentional first/LCP slide; the carousel retains its existing rotation.
const INITIAL_HERO_SLIDE = HERO_SLIDES.indexOf('technology')
const SLIDE_MS = 5500
const CROSSFADE_S = 0.9
const KEN_BURNS_S = 5
const HERO_EASE = [0.25, 0.1, 0.25, 1] as const
const KB: Record<string, { from: number; to: number; xFrom: string; xTo: string; yFrom: string; yTo: string }> = Object.fromEntries(
  HERO_SLIDES.map((key, i) => [key, { from: i % 2 ? 1.06 : 1, to: i % 2 ? 1 : 1.07, xFrom: '0%', xTo: i % 2 ? '1.5%' : '-1.5%', yFrom: '0%', yTo: '0%' }]),
)
const CTA_BAND_PHOTO =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Bogot%C3%A1%2C_Santa_Fe%2C_2023-06_CN-02.jpg/1920px-Bogot%C3%A1%2C_Santa_Fe%2C_2023-06_CN-02.jpg'
// Professional team image: Unsplash License, stable asset URL (Annie Spratt).
const TALENT_WORK_PHOTO = candidatesPhoto.src
const CITY_PHOTOS: Record<string, string> = {
  medellin: '/images/professional-medellin-v2.webp',
  bogota: '/images/professional-bogota-v2.webp',
  cartagena: '/images/professional-cartagena-v2.webp',
  cali: '/images/professional-cali-v2.webp',
  barranquilla: '/images/professional-barranquilla-v2.webp',
}
// Verified downtown Medellín skyline for the hero only; city cards retain professional crops.
const INDUSTRY_HERO_PHOTOS: Record<string, string> = {
  technology: '/images/industry-technology.webp',
  finance: '/images/industry-finance.webp',
  'customer-hospitality': '/images/industry-customer-hospitality.webp',
  'operations-logistics': '/images/industry-operations-logistics.webp',
  healthcare: '/images/industry-healthcare.webp',
  'sales-marketing': '/images/industry-sales-marketing.webp',
  'education-training': '/images/industry-education-training.webp',
  'engineering-construction': '/images/industry-engineering-construction.webp',
  'creative-media': '/images/industry-creative-media.webp',
  'legal-public-sector': '/images/industry-legal-public-sector.webp',
}
const INDUSTRY_HERO_ALT_KEYS: Record<string, string> = {
  technology: 'landing.heroIndustryTechnologyAlt', finance: 'landing.heroIndustryFinanceAlt', 'customer-hospitality': 'landing.heroIndustryCustomerAlt', 'operations-logistics': 'landing.heroIndustryOperationsAlt', healthcare: 'landing.heroIndustryHealthcareAlt', 'sales-marketing': 'landing.heroIndustrySalesAlt', 'education-training': 'landing.heroIndustryEducationAlt', 'engineering-construction': 'landing.heroIndustryEngineeringAlt', 'creative-media': 'landing.heroIndustryCreativeAlt', 'legal-public-sector': 'landing.heroIndustryLegalAlt',
}
const REFERENCE_PHOTOS = {
  developer: 'https://images.unsplash.com/photo-1606857521015-7f9fcf423740?auto=format&fit=crop&w=1280&q=80',
  team: 'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?auto=format&fit=crop&w=1280&q=80',
  healthcare: 'https://images.unsplash.com/photo-1758691462743-f9fc9e430d39?auto=format&fit=crop&w=1280&q=80',
  finance: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1280&q=80',
} as const
// Focal points preserve the office mass and contextual greenery in the wide 3:2 source crops.
const CITY_IMAGE_POSITION: Record<string, string> = {
  medellin: '68% 52%',
  bogota: '68% 45%',
  cartagena: '68% 50%',
  cali: '68% 50%',
  barranquilla: '68% 50%',
}
const CITY_IMAGE_ALT_KEY: Record<string, string> = {
  medellin: 'landing.cityMedellinAlt',
  bogota: 'landing.cityBogotaAlt',
  cartagena: 'landing.cityCartagenaAlt',
  cali: 'landing.cityCaliAlt',
  barranquilla: 'landing.cityBarranquillaAlt',
}
const PHOTO_CREDITS = [
  ['I.D. R.J.', 'CC BY-SA 2.0', 'https://commons.wikimedia.org/wiki/File:Medell%C3%ADn_skyline02.jpg', 'https://creativecommons.org/licenses/by-sa/2.0/'],
  ['Tijs Zwinkels', 'CC BY-SA 2.0', 'https://commons.wikimedia.org/wiki/File:Skyline_downtown_Bogota.jpg', 'https://creativecommons.org/licenses/by-sa/2.0/'],
  ['Jdmacarenoq', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Cartagena_-_Colombia.jpg', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ['Aleko / David Alejandro Rendón', 'CC BY-SA 3.0', 'https://commons.wikimedia.org/wiki/File:Santiago_de_Cali.jpg', 'https://creativecommons.org/licenses/by-sa/3.0/'],
  ['Hsolp', 'CC0', 'https://commons.wikimedia.org/wiki/File:Barranquilla_panoramica.jpg', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Steffen Schmitz', 'CC BY-SA 4.0', 'https://commons.wikimedia.org/wiki/File:Bogot%C3%A1,_Santa_Fe,_2023-06_CN-02.jpg', 'https://creativecommons.org/licenses/by-sa/4.0/'],
] as const
const CITIES: { key: string; re: RegExp }[] = [
  { key: 'medellin', re: /medell/i },
  { key: 'bogota', re: /bogot/i },
  { key: 'cartagena', re: /cartagena/i },
  { key: 'cali', re: /\bcali\b/i },
  { key: 'barranquilla', re: /barranquilla/i },
]
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/* ── City showcase — Colombia's talent markets with live counts ── */
function CityShowcase() {
  const { t } = useI18n()
  const { data: allJobs } = useAllJobs()
  const openJobs = (allJobs ?? []).filter(isOpen)
  return (
    <section className="border-y border-border bg-muted/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5"><SectionReveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('landing.citiesTitle')}
          </h2>
          <p className="mt-3 text-muted-foreground">{t('landing.citiesSub')}</p>
        </div>
      </SectionReveal>
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((city, i) => {
          const count = openJobs.filter((j) => city.re.test(j.locationType)).length
          const name = t(`landing.city${capitalize(city.key)}`)
          return (
            <SectionReveal key={city.key} delay={i * 0.08}>
              <div className="group relative h-64 overflow-hidden rounded-2xl border border-border shadow-lg shadow-primary/5">
                <img
                  src={CITY_PHOTOS[city.key]}
                  alt={t(CITY_IMAGE_ALT_KEY[city.key])}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: CITY_IMAGE_POSITION[city.key] }}
                  className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-bold text-white drop-shadow-sm">{name}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm ${count > 0 ? 'bg-white/15 text-white' : 'bg-black/35 text-white/85'}`}>
                      {count > 0 ? t('landing.cityOpen', { n: count }) : t('landing.cityComingSoon')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug text-white/85 drop-shadow-sm">
                    {t(`landing.city${capitalize(city.key)}Tag`)}
                  </p>
                </div>
              </div>
            </SectionReveal>
          )
        })}
      </div></div>
    </section>
  )
}
function FamilyCard({ family }: { family: typeof INDUSTRY_FAMILIES[number] }) {
  const { t } = useI18n(); const { data: jobs } = useAllJobs(); const counts = new Map<string, number>();
  for (const j of (jobs ?? []).filter(j => isOpen(j) && j.industry)) counts.set(j.industry!, (counts.get(j.industry!) ?? 0) + 1);
  const total = family.members.reduce((n, m) => n + (counts.get(m) ?? 0), 0); const Icon = family.icon === 'Code2' ? Code2 : family.icon === 'Landmark' ? Landmark : family.icon === 'Headphones' ? Headphones : family.icon === 'Truck' ? Truck : HeartPulse;
  return <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5"><div className="flex items-center justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div>{total > 0 && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{t('industries.open', { n: total })}</span>}</div><h3 className="mt-4 font-semibold text-foreground">{t(`industries.family.${family.slug}`)}</h3><div className="mt-3 flex flex-wrap gap-1.5">{family.members.filter(m => (counts.get(m) ?? 0) > 0).map(m => { const slug = INDUSTRIES.find(x => x.canonical === m)?.slug; return <Link key={m} to="/jobs" search={{ industry: slug }} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary">{t(`industries.${slug}`)} <b className="text-primary">{counts.get(m)}</b></Link> })}{total === 0 && <p className="text-xs text-muted-foreground/70">{t('industries.comingSoon')}</p>}</div></div>
}

function LandingPage() {
  const { t } = useI18n()
  const reduce = useReducedMotion()
  const [slide, setSlide] = useState(INITIAL_HERO_SLIDE)
  const pausedRef = useRef(false)
  useEffect(() => {
    captureUTMParams()
    trackEvent('page_view')
  }, [])
  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => { if (!pausedRef.current) setSlide((s) => (s + 1) % HERO_SLIDES.length) }, SLIDE_MS)
    return () => window.clearInterval(id)
  }, [reduce])
  useEffect(() => {
    const onVis = () => { pausedRef.current = document.hidden }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    const next = INDUSTRY_HERO_PHOTOS[HERO_SLIDES[(slide + 1) % HERO_SLIDES.length]]
    const img = new Image(); img.src = next
  }, [slide])
  const { data: allJobs } = useAllJobs()
  const { data: allCompanies } = useAllCompanies()

  const openJobs = (allJobs ?? []).filter(isOpen)
  const companyOpenCounts = new Map<string, number>()
  for (const job of openJobs) {
    companyOpenCounts.set(job.companyId, (companyOpenCounts.get(job.companyId) ?? 0) + 1)
  }
  const companies = [...(allCompanies ?? [])].sort(
    (a, b) => (companyOpenCounts.get(b.id) ?? 0) - (companyOpenCounts.get(a.id) ?? 0),
  )

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader transparentOnTop />

      {/* Premium dark hero — full-width split rails with deliberate overlap */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {!reduce ? <AnimatePresence initial={false} mode="sync"><motion.img key={slide} src={INDUSTRY_HERO_PHOTOS[HERO_SLIDES[slide]]} alt={t(INDUSTRY_HERO_ALT_KEYS[HERO_SLIDES[slide]])} loading={slide === 0 ? 'eager' : 'lazy'} fetchPriority={slide === 0 ? 'high' : 'auto'} decoding="async" initial={{ opacity: 0, scale: KB[HERO_SLIDES[slide]].from }} animate={{ opacity: 1, scale: KB[HERO_SLIDES[slide]].to }} exit={{ opacity: 0 }} transition={{ duration: CROSSFADE_S }} className="absolute inset-0 size-full object-cover object-center" /></AnimatePresence> : <img src={INDUSTRY_HERO_PHOTOS.technology} alt={t(INDUSTRY_HERO_ALT_KEYS.technology)} className="absolute inset-0 size-full object-cover object-center" />}
          <div className="absolute inset-0 bg-black/50" /><div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/20 to-black/75" /><div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 to-transparent" /><div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/75 to-transparent" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[88rem] px-6 pb-40 pt-20 sm:pb-44 sm:pt-24 lg:px-10 lg:pb-[22rem] lg:pt-28 xl:pb-[24rem] xl:pt-32">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 xl:gap-24">
            <div className="flex flex-col items-start text-left"><span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white/90 backdrop-blur-sm"><Sparkles className="size-4 text-accent" />{t('landing.badge')}</span><h1 className="mt-5 text-4xl font-bold tracking-tight leading-[1.04] text-white sm:text-5xl lg:text-6xl xl:text-[4.5rem]">{t('landing.heroTitle1')}<span className="block text-accent">{t('landing.heroTitle2')}</span></h1><p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg xl:text-xl">{t('landing.heroSub')}</p><div className="mt-8"><BlinkClientBoundary fallback={<div className="h-12 w-44 rounded-lg bg-white/20 animate-pulse" />}><LandingCTAs /></BlinkClientBoundary></div><div className="mt-10 hidden w-full border-t border-white/10 pt-6 lg:block"><p className="text-xs font-medium uppercase tracking-wider text-white/60">{t('landing.trustedBy', { n: companies.length })}</p><div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">{companies.map(c => <Link key={c.id} to="/companies/$id" params={{id:c.id}} className="text-sm font-semibold text-white/60 hover:text-white">{c.name}</Link>)}</div></div></div>
            <div className="relative flex w-full flex-col lg:-mb-20"><img src="/images/hero-professional-coworking.webp" alt={t('landing.heroSub')} loading="eager" decoding="async" className="absolute -inset-5 size-[calc(100%+2.5rem)] rounded-3xl object-cover opacity-35" /><div className="relative z-10"><JobFeedPreview /></div></div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-6 lg:hidden"><p className="text-xs font-medium uppercase tracking-wider text-white/60">{t('landing.trustedBy', { n: companies.length })}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{companies.map(c => <Link key={c.id} to="/companies/$id" params={{id:c.id}} className="text-sm font-semibold text-white/60">{c.name}</Link>)}</div></div>
        </div>{!reduce && <>
          <button type="button" onClick={() => setSlide((slide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)} aria-label={t('landing.heroPrevious')} className="absolute left-3 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span aria-hidden="true">‹</span></button>
          <button type="button" onClick={() => setSlide((slide + 1) % HERO_SLIDES.length)} aria-label={t('landing.heroNext')} className="absolute right-3 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><span aria-hidden="true">›</span></button>
          <div className="absolute inset-x-0 bottom-5 z-10 flex items-center justify-center gap-2">{HERO_SLIDES.map((key,i)=><button key={key} type="button" onClick={()=>setSlide(i)} aria-label={key.replaceAll('-', ' ')} aria-current={i === slide ? 'true' : undefined} className={`h-1.5 rounded-full ${i===slide?'w-7 bg-accent':'w-4 bg-white/30'}`} />)}</div>
        </>}
        <p className="absolute bottom-1 left-3 z-10 max-w-[70%] text-[9px] leading-tight text-white/55 sm:left-6">Original industry imagery · Generated for Impulsa Talentos</p>
      </section>
      <StatsBar />
      {/* ── How it works — candidate journey ────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <SectionReveal>
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('landing.howTitle')}
            </h2>
            <p className="mt-3 text-muted-foreground">{t('landing.howSub')}</p>
          </div>
        </SectionReveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { step: '01', icon: FileText, title: t('landing.how1Title'), desc: t('landing.how1Desc') },
            { step: '02', icon: Sparkles, title: t('landing.how2Title'), desc: t('landing.how2Desc') },
            { step: '03', icon: CalendarCheck, title: t('landing.how3Title'), desc: t('landing.how3Desc') },
          ].map((s, i) => (
            <SectionReveal key={s.step} delay={i * 0.1}>
              <div className="relative h-full rounded-xl border border-border bg-card p-6 transition-shadow hover:shadow-md">
                <span className="absolute top-5 right-5 text-3xl font-bold text-primary/20">{s.step}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </SectionReveal>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/40"><div className="mx-auto max-w-6xl px-5 py-16 sm:py-20"><SectionReveal><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t('industries.sectionTitle')}</h2><p className="mt-3 text-muted-foreground">{t('industries.sectionSub')}</p></div><Button asChild variant="outline" size="sm"><Link to="/jobs">{t('industries.viewAll')} <ArrowRight className="size-3.5" /></Link></Button></div></SectionReveal><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{INDUSTRY_FAMILIES.map((family, i) => <SectionReveal key={family.slug} delay={(i%3)*.08}><FamilyCard family={family} /></SectionReveal>)}<SectionReveal delay={.16}><Link to="/dashboard" className="group flex h-full flex-col rounded-xl border border-dashed border-primary/30 bg-primary/[.03] p-5"><Sparkles className="size-5 text-primary" /><h3 className="mt-4 font-semibold">{t('industries.ctaTitle')}</h3><p className="mt-1.5 text-sm text-muted-foreground">{t('industries.ctaDesc')}</p><span className="mt-auto pt-3 text-sm font-medium text-primary">{t('industries.ctaAction')} <ArrowRight className="inline size-3.5" /></span></Link></SectionReveal></div></div></section>
      <CityShowcase />
{/* ── Top companies hiring — real data ─────────────────── */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <SectionReveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('landing.companiesTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">{t('landing.companiesSub')}</p>
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/companies">
                {t('landing.companiesViewAll')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </SectionReveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {companies.map((company, i) => {
            const openCount = companyOpenCounts.get(company.id) ?? 0
            return (
              <SectionReveal key={company.id} delay={(i % 4) * 0.08}>
                <Link
                  to="/companies/$id"
                  params={{ id: company.id }}
                  className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                      {company.logoUrl ? (
                        <img src={company.logoUrl} alt={`${company.name} logo`} className="size-full rounded-lg object-cover" />
                      ) : (
                        company.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground group-hover:text-primary transition-colors">
                        {company.name}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">{company.industry}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 truncate">
                      <MapPin className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{company.location}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                      {t('landing.companiesOpen', { n: openCount })}
                    </span>
                  </div>
                </Link>
              </SectionReveal>
            )
          })}
        </div>
      </section>

      {/* ── Why bilingual talent ────────────────────────────── */}
      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <SectionReveal>
            <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['developer', 'Tech & Digital'], ['team', 'Customer Experience'], ['healthcare', 'Healthcare'], ['finance', 'Finance & BPO'],
              ].map(([key, label]) => <div key={key} className="overflow-hidden rounded-xl border border-border bg-card"><img src={REFERENCE_PHOTOS[key as keyof typeof REFERENCE_PHOTOS]} alt={label} loading="lazy" className="h-28 w-full object-cover" /><p className="px-3 py-2 text-sm font-semibold text-foreground">{label}</p></div>)}
            </div>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {t('landing.whyTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">{t('landing.whySub')}</p>
            </div>
          </SectionReveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Languages, title: t('landing.why1Title'), desc: t('landing.why1Desc') },
              { icon: DollarSign, title: t('landing.why2Title'), desc: t('landing.why2Desc') },
              { icon: Clock, title: t('landing.why3Title'), desc: t('landing.why3Desc') },
              { icon: Users, title: t('landing.why4Title'), desc: t('landing.why4Desc') },
            ].map((feat, i) => (
              <SectionReveal key={feat.title} delay={i * 0.08}>
                <div className="h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feat.icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{feat.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feat.desc}</p>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Colombian talent at work ───────────────────────── */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-16 sm:py-20 lg:grid-cols-2">
          <SectionReveal>
            <div className="overflow-hidden rounded-2xl border border-border shadow-lg shadow-primary/5">
              <img src={TALENT_WORK_PHOTO} alt={candidatesPhoto.alt} loading="lazy" decoding="async" className="h-72 w-full object-cover sm:h-96" />
            </div>
          </SectionReveal>
          <SectionReveal delay={0.1}>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">{t('landing.talentEyebrow')}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t('landing.talentTitle')}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t('landing.talentSub')}</p>
            <p className="mt-4 text-xs text-muted-foreground/70">{candidatesPhoto.credit} · {t('landing.talentPhotoLicense')}</p>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/60" aria-label={t('landing.photoCreditLabel')}>
              {PHOTO_CREDITS.map(([author, license, file, licenseUrl]) => <span key={author}><a href={file} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{author}</a> (<a href={licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{license}</a>)</span>)}
            </div>
          </SectionReveal>
        </div>
      </section>
      {/* ── Employer acquisition CTA ─────────────────────────── */}
      <section className="border-t border-border bg-primary/[.04]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:py-14">
          <div><p className="text-sm font-semibold uppercase tracking-wider text-primary">{t('landing.employerCtaEyebrow')}</p><h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t('landing.employerCtaTitle')}</h2><p className="mt-2 max-w-xl text-muted-foreground">{t('landing.employerCtaDesc')}</p></div>
          <Button asChild size="lg" className="shrink-0"><Link to="/for-employers" onClick={() => trackEvent('employer_post_start')}>{t('landing.employerCtaAction')} <ArrowRight className="ml-2 size-4" /></Link></Button>
        </div>
      </section>
      {/* ── Footer CTA ──────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <img src={CTA_BAND_PHOTO} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-center" />
          <div className="absolute inset-0 bg-background/75" />
          <div className="absolute -bottom-32 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        </div>
        <div className="mx-auto max-w-3xl px-5 py-16 text-center sm:py-20">
          <SectionReveal>
            <Globe className="mx-auto size-10 text-primary" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('landing.footerTitle')}
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 gap-2 px-7 text-base font-semibold">
                <Link to="/dashboard">
                  {t('landing.footerPrimary')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-7 text-base font-semibold">
                <Link to="/jobs">{t('landing.footerSecondary')}</Link>
              </Button>
              <Link to="/contact" className="w-full text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline sm:w-auto">{t('contact.title')}</Link>
            </div>
          </SectionReveal>
        </div>
      </section>

    </div>
  )
}
