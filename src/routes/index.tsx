import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { useQuery } from '@tanstack/react-query'
import { publicSelect } from '@/lib/publicRest'
import { PublicHeader } from '@/components/PublicHeader'
import type { Job, Company } from '@/types'
import { INDUSTRIES, INDUSTRY_FAMILIES } from '@/lib/industries'
import { candidatesPhoto } from '@/lib/media'
import { useRef, type ReactNode } from 'react'
import { captureUTMParams, trackEvent } from '@/lib/marketing'
import { setOnboardingIntent } from '@/lib/intent'

/* The open jobs and company names the home page shows (live feed, company
   ribbon, industry and city counts). Read over the public REST API (see
   lib/publicRest) so supabase-js isn't loaded at start-up; prerendered into the
   HTML by the loader, then refreshed in the browser. Only the columns used. */
const HOME_JOB_COLUMNS = 'id,title,company_id,status,moderation_status,location_type,salary_min,salary_max,currency,languages_required,industry'
const fetchHomeJobs = () => publicSelect<Job>('jobs', `select=${HOME_JOB_COLUMNS}&status=eq.open&order=created_at.desc&limit=60`).then((rows) => rows.filter(isOpen))
const fetchHomeCompanies = () => publicSelect<Company>('companies', 'select=id,name,logo_url&order=created_at.desc')
async function loadHomeData(): Promise<{ jobs?: Job[]; companies?: Company[] }> {
  // In-app navigation back to "/" uses whatever the browser already has.
  if (typeof window !== 'undefined') return {}
  try {
    const [jobs, companies] = await Promise.all([fetchHomeJobs(), fetchHomeCompanies()])
    return { jobs, companies }
  } catch (err) {
    console.error('[home loader]', err)
    return {}
  }
}
function useHomeJobs(initial?: Job[]) {
  return useQuery({ queryKey: ['home', 'jobs'], queryFn: fetchHomeJobs, initialData: initial, initialDataUpdatedAt: initial ? 0 : undefined })
}
function useHomeCompanies(initial?: Company[]) {
  return useQuery({ queryKey: ['home', 'companies'], queryFn: fetchHomeCompanies, initialData: initial, initialDataUpdatedAt: initial ? 0 : undefined })
}

export const Route = createFileRoute('/')({
  loader: loadHomeData,
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

/* Scroll reveal that never hides content in the prerendered page: everything
   is visible before (and without) JavaScript. Once the app runs, sections that
   are still below the screen are hidden and fade in as they scroll into view;
   sections already on screen are left alone (no flash). Opacity only — the
   design rules allow fades, never slides. */
function SectionReveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'static' | 'waiting' | 'shown'>('static')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setState('waiting')
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setState('shown'); io.disconnect() }
    }, { rootMargin: '0px 0px -80px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      style={state === 'static' ? undefined : { transitionDelay: `${delay}s` }}
      className={`${className ?? ''} ${state === 'static' ? '' : 'transition-opacity duration-[330ms]'} ${state === 'waiting' ? 'opacity-0' : ''}`.trim()}
    >
      {children}
    </div>
  )
}

/* ── Top nav — LinkedIn-style slim header ─────────────────── */

/* ── Hero CTAs — candidate-only (per product direction) ──────
   Over the photo the pair is a white filled button (the one primary action) and
   a frosted secondary, at most two per screen, text only. White rather than the
   indigo: indigo on a dark photo has too little edge contrast to read as a button. */
function LandingCTAs() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const onPhotoPrimary = 'bg-white text-[#171a20] hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-black/40'
  // Signed-out buttons render in the prerendered HTML (and while the session is
  // being restored), so the hero is complete before any JavaScript runs.
  if (user) {
    return (
      <Button asChild size="lg" className={`w-full sm:w-52 ${onPhotoPrimary}`}>
        <Link to="/dashboard">{t('landing.ctaGoDashboard')}</Link>
      </Button>
    )
  }
  const goEmployer = () => { setOnboardingIntent('employer'); navigate({ to: '/employer', search: { signup: 1 } as never }) }
  return (
    <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row">
      <Button asChild size="lg" className={`sm:w-52 ${onPhotoPrimary}`}>
        <Link to="/jobs">{t('landing.ctaSearch')}</Link>
      </Button>
      <Button asChild size="lg" className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 focus-visible:ring-white focus-visible:ring-offset-black/40 sm:w-44">
        <a href="/employer?signup=1" data-early-intent="employer" onClick={(e) => { e.preventDefault(); goEmployer() }}>{t('landing.ctaHire')}</a>
      </Button>
    </div>
  )
}

/* ── Live job board — the newest open roles, three at a time ──
   A flat band: a heading with a live dot and one link, then up to three
   white 12px cards (logo tile, title, company and place, pay, languages).
   No rotation and no motion; the roles update when the data does. */
const compactMoney = (v: number, locale: string) =>
  new Intl.NumberFormat(locale === 'es' ? 'es-CO' : locale === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v).replace(/\s/g, '')
function JobFeedPreview() {
  const { t, locale } = useI18n()
  const { data: jobs } = useHomeJobs()
  const { data: companies } = useHomeCompanies()
  const companyMap = new Map((companies ?? []).map((c: Company) => [c.id, c]))
  const featured = (jobs ?? []).filter(isOpen).slice(0, 3)
  const card = (job: Job) => {
    const company = companyMap.get(job.companyId)
    const salary =
      job.salaryMin && job.salaryMax
        ? job.currency === 'USD'
          ? `$${compactMoney(job.salaryMin, locale)}–$${compactMoney(job.salaryMax, locale)}`
          : `${job.currency} ${compactMoney(job.salaryMin, locale)}–${compactMoney(job.salaryMax, locale)}`
        : t('jobs.salaryTBD')
    return (
      <li key={job.id} className="min-w-0">
        <Link to="/jobs/$id" params={{ id: job.id }} className="group flex h-full flex-col gap-4 rounded-xl bg-card p-5 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary text-sm font-medium text-primary">{company?.logoUrl ? <img src={company.logoUrl} alt={`${company.name} logo`} className="size-full object-cover" /> : (company?.name ?? 'J').charAt(0).toUpperCase()}</div>
            <p className="min-w-0 truncate text-sm text-muted-foreground">{company?.name ?? 'Impulsa Talentos partner'}</p>
          </div>
          <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-medium leading-snug text-foreground group-hover:text-primary">{job.title}</h3>
          <div className="mt-auto flex flex-col gap-1.5 text-sm">
            <p className="flex min-w-0 items-center gap-1.5 text-muted-foreground"><MapPin className="size-4 shrink-0" /><span className="truncate">{formatLocationType(job.locationType, t)}</span></p>
            <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium text-foreground">{salary}</span><span className="truncate text-muted-foreground">{formatLanguageList(job.languagesRequired, t)}</span></p>
          </div>
        </Link>
      </li>
    )
  }
  return (
    <div data-testid="hero-live-feed" className="w-full" aria-label={t('landing.feedTitle')}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-2 text-lg font-medium text-foreground sm:text-2xl"><span aria-hidden className="inline-flex size-2 shrink-0 rounded-full bg-primary" />{t('landing.feedLiveLabel')}</h2>
        <Link to="/jobs" className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('landing.feedViewAll')} →</Link>
      </div>
      {featured.length === 0
        ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="h-40 rounded-xl bg-card" /><div className="hidden h-40 rounded-xl bg-card sm:block" /><div className="hidden h-40 rounded-xl bg-card sm:block" /></div>
        : <ul className="mt-5 grid gap-4 sm:grid-cols-3">{featured.map(card)}</ul>}
    </div>
  )
}
/* ── Stats bar — LIVE numbers from Supabase ────────────────── */
function StatsBar() {
  const { t } = useI18n()

  return (
    <section className="bg-card">
      <div className="mx-auto max-w-6xl px-5 py-10 text-center">
        <p className="text-lg font-medium text-foreground">{t('landing.trustedByLine')}</p>
      </div>
    </section>
  )
}

/* ── Trusted-by ribbon — company names on a solid indigo band, scrolling slowly ──
   Brand colors only: Impulsa indigo with white labels. The track holds the list
   twice for a seamless loop; links render once (first half), the copy is
   aria-hidden so there are no repeated tab stops. Pauses on hover/focus, and is a
   still, wrapped row under prefers-reduced-motion. */
function CompanyRibbon({ companies }: { companies: Company[] }) {
  const { t } = useI18n()
  const reduce = usePrefersReducedMotion()
  if (companies.length === 0) return null
  const set = (link: boolean) => companies.map((c) => (
    <span key={(link ? 'a' : 'b') + c.id} aria-hidden={!link} className="flex shrink-0 items-center gap-6 px-4 text-sm font-medium text-white sm:gap-8 sm:px-5">
      {link
        ? <Link to="/companies/$id" params={{ id: c.id }} className="min-h-0 min-w-0 rounded-md px-1 text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{c.name}</Link>
        : <span>{c.name}</span>}
      <span aria-hidden="true" className="size-1.5 rounded-full bg-white/50" />
    </span>
  ))
  return (
    <section aria-label={t('landing.trustedBy', { n: companies.length })} className="marquee relative overflow-hidden bg-primary py-1 sm:py-1.5">
      {reduce ? (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-y-2 px-5">{set(true)}</div>
      ) : (
        <div className="marquee-track flex w-max items-center whitespace-nowrap">{set(true)}{set(false)}</div>
      )}
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
// Background of the last section, under an 85% wash: a 500 px (phones) or
// 960 px thumbnail is plenty.
const CTA_BAND_AT = (w: number) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Bogot%C3%A1%2C_Santa_Fe%2C_2023-06_CN-02.jpg/${w}px-Bogot%C3%A1%2C_Santa_Fe%2C_2023-06_CN-02.jpg`
const CTA_BAND_PHOTO = CTA_BAND_AT(960) // 169 KB (the 1920 px original: 600 KB)
const CTA_BAND_SRCSET = `${CTA_BAND_AT(500)} 500w, ${CTA_BAND_AT(960)} 960w` // phones: 53 KB
// Professional team image: Unsplash License, stable asset URL. Sized per screen
// (Unsplash resizes on request): 480 px for phones, 800 px for wider screens.
const unsplashAt = (w: number) => candidatesPhoto.src.replace(/([?&])w=\d+/, `$1w=${w}`).replace(/([?&])q=\d+/, '$1q=70')
const TALENT_WORK_PHOTO = unsplashAt(800)
const TALENT_WORK_SRCSET = `${unsplashAt(480)} 480w, ${unsplashAt(800)} 800w`
const CITY_PHOTOS: Record<string, string> = {
  medellin: '/images/industry-technology.webp',
  bogota: '/images/industry-finance.webp',
  cartagena: '/images/industry-customer-hospitality.webp',
  cali: '/images/industry-sales-marketing.webp',
  barranquilla: '/images/industry-operations-logistics.webp',
  cucuta: '/images/industry-education-training.webp',
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
// Focal points preserve the office mass and contextual greenery in the wide 3:2 source crops.
const CITY_IMAGE_POSITION: Record<string, string> = {
  medellin: '50% 50%',
  bogota: '50% 50%',
  cartagena: '50% 50%',
  cali: '50% 50%',
  barranquilla: '50% 50%',
  cucuta: '50% 50%',
}
const CITY_IMAGE_ALT_KEY: Record<string, string> = {
  medellin: 'landing.cityMedellinAlt',
  bogota: 'landing.cityBogotaAlt',
  cartagena: 'landing.cityCartagenaAlt',
  cali: 'landing.cityCaliAlt',
  barranquilla: 'landing.cityBarranquillaAlt',
  cucuta: 'landing.cityCucutaAlt',
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
  { key: 'cucuta', re: /c[uú]cuta/i },
]
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/* ── Phone slideshow: one full-width slide at a time ──────────────────────
   Drives a horizontal snap scroller on phones (<640px): advances every
   `intervalMs` while the strip is on screen, pauses for 8 s after a touch,
   and reports the slide in view. One light timer instead of scroll events,
   which proved unreliable on some engines once snapping kicks in. */
function usePhoneSlideshow(count: number, intervalMs: number) {
  const reduce = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(0)
  const pausedUntil = useRef(0)
  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    setActive(i)
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    let last = Date.now()
    const id = window.setInterval(() => {
      const el = ref.current
      if (!el || !window.matchMedia('(max-width: 639px)').matches) return
      const w = Math.max(1, el.clientWidth)
      const current = Math.min(count - 1, Math.round(el.scrollLeft / w))
      setActive(current)
      const now = Date.now()
      if (reduce || now < pausedUntil.current) { last = now; return }
      const r = el.getBoundingClientRect()
      const visible = r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25
      if (!visible) { last = now; return }
      if (now - last < intervalMs) return
      last = now
      const next = (current + 1) % count
      setActive(next)
      el.scrollTo({ left: next * w, behavior: 'smooth' })
    }, 250)
    return () => window.clearInterval(id)
  }, [reduce, count, intervalMs])
  const pause = () => { pausedUntil.current = Date.now() + 8000 }
  return { ref, active, goTo, pause }
}

/* ── City showcase — Colombia's talent markets with live counts ── */
function CityShowcase() {
  const { t } = useI18n()
  const { data: allJobs } = useHomeJobs()
  const openJobs = (allJobs ?? []).filter(isOpen)

  // Phones: a one-city-at-a-time slideshow (swipe or tap a dot; advances by
  // itself while on screen, pauses after a touch). Tablet/desktop: a grid.
  const { ref: scrollerRef, active, goTo, pause } = usePhoneSlideshow(CITIES.length, 4500)

  return (
    <section className="section-tint py-12 sm:py-20">
      <div className="mx-auto max-w-6xl px-5"><SectionReveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">
            {t('landing.citiesTitle')}
          </h2>
          <p className="mt-3 text-muted-foreground">{t('landing.citiesSub')}</p>
        </div>
      </SectionReveal></div>
      {/* Full width from tablet up; a slideshow on phones. */}
      <SectionReveal><div className="px-5 sm:px-6 lg:px-10">
      <div
        ref={scrollerRef}
        onTouchStart={pause}
        onPointerDown={pause}
        aria-roledescription="carousel"
        aria-label={t('landing.citiesTitle')}
        className="mt-8 -mx-5 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mt-10 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-6"
      >
        {CITIES.map((city, i) => {
          const count = openJobs.filter((j) => city.re.test(j.locationType)).length
          const name = t(`landing.city${capitalize(city.key)}`)
          return (
            <div key={city.key} className="w-full shrink-0 snap-center px-5 sm:w-auto sm:px-0" aria-roledescription="slide" aria-label={`${i + 1} / ${CITIES.length}: ${name}`}>
              <div className="group relative h-64 overflow-hidden rounded-xl sm:h-56 lg:h-72 xl:h-80">
                <img
                  src={CITY_PHOTOS[city.key]}
                  alt={t(CITY_IMAGE_ALT_KEY[city.key])}
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: CITY_IMAGE_POSITION[city.key] }}
                  className="absolute inset-0 size-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-x-0 bottom-0 p-5 lg:p-4 xl:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 lg:flex-col lg:items-start lg:gap-1.5">
                    <h3 className="text-lg font-medium text-white xl:text-xl">{name}</h3>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${count > 0 ? 'bg-white/20 text-white' : 'bg-black/40 text-white'}`}>
                      {count > 0 ? t('landing.cityOpen', { n: count }) : t('landing.cityComingSoon')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug text-white lg:hidden 2xl:block">
                    {t(`landing.city${capitalize(city.key)}Tag`)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex justify-center sm:hidden">
        {CITIES.map((city, i) => (
          <button
            key={city.key}
            type="button"
            onClick={() => { pause(); goTo(i) }}
            aria-label={t(`landing.city${capitalize(city.key)}`)}
            aria-current={i === active ? 'true' : undefined}
            className="flex size-6 min-h-0 min-w-0 items-center justify-center rounded-full"
          >
            <span className={`block size-2 rounded-full transition-colors ${i === active ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
          </button>
        ))}
      </div>
      </div></SectionReveal>
    </section>
  )
}
/* Industries: one row that advances by itself, one card every 3 seconds, and
   loops back to the start. Pauses on hover, focus and touch; with
   prefers-reduced-motion it never moves by itself and shows its scrollbar. */
function IndustrySlides({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const reduce = usePrefersReducedMotion()
  const ref = useRef<HTMLDivElement | null>(null)
  const pausedUntil = useRef(0)
  const hovering = useRef(false)
  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => {
      const el = ref.current
      if (!el || hovering.current || Date.now() < pausedUntil.current || document.hidden) return
      const r = el.getBoundingClientRect()
      if (!(r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15)) return
      const first = el.firstElementChild as HTMLElement | null
      if (!first) return
      const step = first.offsetWidth
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: atEnd ? 0 : Math.round(el.scrollLeft / step) * step + step, behavior: 'smooth' })
    }, 3000)
    return () => window.clearInterval(id)
  }, [reduce])
  const pause = () => { pausedUntil.current = Date.now() + 8000 }
  return (
    <div
      ref={ref}
      onTouchStart={pause}
      onPointerDown={pause}
      onMouseEnter={() => { hovering.current = true }}
      onMouseLeave={() => { hovering.current = false }}
      onFocusCapture={() => { hovering.current = true }}
      onBlurCapture={() => { hovering.current = false }}
      aria-roledescription="carousel"
      aria-label={t('industries.sectionTitle')}
      className={`-mx-2 mt-8 flex snap-x snap-mandatory overflow-x-auto sm:mt-10 ${reduce ? 'pb-2' : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}`}
    >
      {children}
    </div>
  )
}
/* Photo for each industry family card (images read better than icons). */
const FAMILY_PHOTOS: Record<string, string> = {
  'tech-engineering': '/images/industry-technology.webp',
  'finance-business': '/images/industry-finance.webp',
  'customer-hospitality': '/images/industry-customer-hospitality.webp',
  'operations-industrial': '/images/industry-operations-logistics.webp',
  'healthcare-public': '/images/industry-healthcare.webp',
}
function FamilyCard({ family }: { family: typeof INDUSTRY_FAMILIES[number] }) {
  const { t } = useI18n(); const { data: jobs } = useHomeJobs(); const counts = new Map<string, number>();
  for (const j of (jobs ?? []).filter(j => isOpen(j) && j.industry)) counts.set(j.industry!, (counts.get(j.industry!) ?? 0) + 1);
  const total = family.members.reduce((n, m) => n + (counts.get(m) ?? 0), 0)
  const subjects = family.members.filter(m => (counts.get(m) ?? 0) > 0)
  /* Fixed-height, full-bleed photo panel: every card is the same size, the photo
     always fills it, and the title + subjects sit on a bottom gradient. */
  return <div className="group relative h-[30rem] overflow-hidden rounded-2xl bg-[#171a20] sm:h-[34rem]">
    <img src={FAMILY_PHOTOS[family.slug] ?? '/images/hero-professional-coworking.webp'} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
    {total > 0 && <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#171a20] backdrop-blur">{t('industries.open', { n: total })}</span>}
    <div className="absolute inset-x-0 bottom-0 flex flex-col p-6 sm:p-7">
      <h3 className="text-2xl font-medium leading-tight text-white sm:text-[1.75rem]">{t(`industries.family.${family.slug}`)}</h3>
      <div className="mt-4 flex min-h-[8.75rem] flex-wrap content-start gap-2">
        {subjects.map(m => { const slug = INDUSTRIES.find(x => x.canonical === m)?.slug; return <Link key={m} to="/jobs" search={{ industry: slug }} className="inline-flex min-h-0 min-w-0 items-center gap-1.5 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-sm text-white backdrop-blur transition-colors hover:bg-white hover:text-[#171a20]">{t(`industries.${slug}`)} <b className="font-medium opacity-80">{counts.get(m)}</b></Link> })}
        {total === 0 && <p className="text-sm text-white/80">{t('industries.comingSoon')}</p>}
      </div>
    </div>
  </div>
}

function LandingPage() {
  const { t } = useI18n()
  const [slide, setSlide] = useState(INITIAL_HERO_SLIDE)
  const slideRef = useRef(INITIAL_HERO_SLIDE)
  const fadeTimer = useRef(0)
  // The previous photo stays underneath until the new one has faded in.
  const showSlide = (next: number) => {
    if (next === slideRef.current) return
    setPrevSlide(slideRef.current)
    slideRef.current = next
    setSlide(next)
    window.clearTimeout(fadeTimer.current)
    fadeTimer.current = window.setTimeout(() => setPrevSlide(null), CROSSFADE_S * 1000 + 100)
  }
  const [prevSlide, setPrevSlide] = useState<number | null>(null)
  const pausedRef = useRef(false)
  useEffect(() => {
    captureUTMParams()
    trackEvent('page_view')
  }, [])
  const reduceMotion = usePrefersReducedMotion()
  useEffect(() => {
    // Auto-advance pauses on hover/focus and while the tab is hidden, and does not
    // run at all under prefers-reduced-motion (the dots still switch photos).
    if (reduceMotion) return
    const id = window.setInterval(() => { if (!pausedRef.current) showSlide((slideRef.current + 1) % HERO_SLIDES.length) }, SLIDE_MS)
    return () => { window.clearInterval(id); window.clearTimeout(fadeTimer.current) }
  }, [reduceMotion])
  useEffect(() => {
    const onVis = () => { pausedRef.current = document.hidden }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  useEffect(() => {
    const next = INDUSTRY_HERO_PHOTOS[HERO_SLIDES[(slide + 1) % HERO_SLIDES.length]]
    const img = new Image(); img.src = next
  }, [slide])

  const home = Route.useLoaderData()
  const { data: allJobs } = useHomeJobs(home.jobs)
  const { data: allCompanies } = useHomeCompanies(home.companies)

  const openJobs = (allJobs ?? []).filter(isOpen)
  const companyOpenCounts = new Map<string, number>()
  for (const job of openJobs) {
    companyOpenCounts.set(job.companyId, (companyOpenCounts.get(job.companyId) ?? 0) + 1)
  }
  const companies = [...(allCompanies ?? [])].sort(
    (a, b) => (companyOpenCounts.get(b.id) ?? 0) - (companyOpenCounts.get(a.id) ?? 0),
  )

  return (
    <main id="main" className="flex min-h-dvh flex-col bg-background">
      <PublicHeader transparentOnTop />

      {/* Full-viewport photo hero (docs/design/TESLA-DESIGN.md §4): the header floats
          over the photo, one flat dark overlay keeps the white text readable, a
          single headline and at most two buttons, circle dots to switch photos.
          -mt-16: the hero extends up behind the transparent sticky header (h-16). */}
      <section className="relative isolate -mt-16 flex min-h-[100svh] flex-col overflow-hidden" onMouseEnter={() => { pausedRef.current = true }} onMouseLeave={() => { pausedRef.current = document.hidden }} onFocusCapture={() => { pausedRef.current = true }} onBlurCapture={() => { pausedRef.current = document.hidden }}>
        <div className="absolute inset-0 z-0" aria-hidden="true">
          {[prevSlide, slide].filter((i): i is number => i !== null).map((i) => <img key={i} src={INDUSTRY_HERO_PHOTOS[HERO_SLIDES[i]]} alt={i === slide ? t(INDUSTRY_HERO_ALT_KEYS[HERO_SLIDES[i]]) : ''} loading={i === INITIAL_HERO_SLIDE ? 'eager' : 'lazy'} fetchPriority={i === INITIAL_HERO_SLIDE ? 'high' : 'auto'} decoding="async" className={`absolute inset-0 size-full object-cover object-center ${i === slide && prevSlide !== null ? 'hero-fade-in' : ''}`} />)}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/65" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col items-center justify-center px-5 pb-24 pt-32 text-center sm:px-6 lg:px-10">
          <h1 className="max-w-5xl text-[2.25rem] font-medium leading-[1.05] tracking-tight text-white sm:text-[3.75rem] lg:text-[4.5rem]">{t('landing.heroTitle1')}<span className="block">{t('landing.heroTitle2')}</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{t('landing.heroSub')}</p>
          <div className="mt-8 w-full sm:w-auto"><LandingCTAs /></div>
        </div>
        <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center">{HERO_SLIDES.map((key,i)=><button key={key} type="button" onClick={()=>showSlide(i)} aria-label={key.replace(/-/g, ' ')} aria-current={i === slide ? 'true' : undefined} className="group flex size-6 min-h-0 min-w-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><span className={`block size-2 rounded-full transition-colors ${i===slide?'bg-white':'bg-white/40 group-hover:bg-white/70'}`} /></button>)}</div>
        <p className="absolute bottom-1 left-3 z-10 hidden max-w-[70%] text-[10px] leading-tight text-white/70 sm:left-6 sm:block">Original industry imagery · Generated for Impulsa Talentos</p>
      </section>
      <CompanyRibbon companies={companies} />
      {/* The live job feed sits in its own flat band under the ribbon at every width. */}
      <section className="bg-secondary px-5 py-10 sm:py-14"><div className="mx-auto max-w-6xl"><JobFeedPreview /></div></section>
      <StatsBar />
      {/* ── How it works — candidate journey ────────────────── */}
      <section className="section-tint"><div className="w-full px-5 py-16 sm:px-6 sm:py-28 lg:px-10">
        <SectionReveal>
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">
              {t('landing.howTitle')}
            </h2>
            <p className="mt-3 text-muted-foreground">{t('landing.howSub')}</p>
          </div>
        </SectionReveal>
        <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-3 sm:gap-5">
          {[
            { step: '01', img: '/images/sm/industry-creative-media.webp', pos: '50% 50%', alt: t('landing.how1ImgAlt'), title: t('landing.how1Title'), desc: t('landing.how1Desc') },
            { step: '02', img: '/images/sm/employer-hero-office.webp', pos: '50% 50%', alt: t('landing.how2ImgAlt'), title: t('landing.how2Title'), desc: t('landing.how2Desc') },
            { step: '03', img: '/images/sm/hero-professional-coworking.webp', pos: '50% 50%', alt: t('landing.how3ImgAlt'), title: t('landing.how3Title'), desc: t('landing.how3Desc') },
          ].map((s, i) => (
            <SectionReveal key={s.step} delay={i * 0.1}>
              <div className="group relative h-[24rem] overflow-hidden rounded-2xl bg-[#171a20] sm:h-[30rem]">
                <img src={s.img} alt={s.alt} loading="lazy" decoding="async" style={{ objectPosition: s.pos }} className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5" />
                <span className="absolute left-6 top-5 text-5xl font-medium tracking-tight text-white/90 sm:text-6xl">{s.step}</span>
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                  <h3 className="text-2xl font-medium leading-tight text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/85 sm:text-base">{s.desc}</p>
                </div>
              </div>
            </SectionReveal>
          ))}
        </div>
      </div></section>

      <section className="bg-card"><div className="w-full px-5 py-16 sm:px-6 sm:py-28 lg:px-10"><SectionReveal><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-tight">{t('industries.sectionTitle')}</h2><p className="mt-3 text-muted-foreground">{t('industries.sectionSub')}</p></div><Button asChild variant="outline" size="sm"><Link to="/jobs">{t('industries.viewAll')} <ArrowRight className="size-3.5" /></Link></Button></div></SectionReveal><SectionReveal><IndustrySlides>{INDUSTRY_FAMILIES.map((family) => <div key={family.slug} className="shrink-0 basis-full snap-start px-2 sm:basis-1/2 lg:basis-1/3"><FamilyCard family={family} /></div>)}<div className="shrink-0 basis-full snap-start px-2 sm:basis-1/2 lg:basis-1/3"><Link to="/dashboard" className="group relative flex h-[30rem] flex-col justify-end overflow-hidden rounded-2xl p-6 text-white sm:h-[34rem] sm:p-7"><img src="/images/industry-engineering-construction.webp" alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" /><div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" /><h3 className="relative text-2xl font-medium leading-tight sm:text-[1.75rem]">{t('industries.ctaTitle')}</h3><p className="relative mt-2 text-sm text-white/85">{t('industries.ctaDesc')}</p><span className="relative pt-3 text-sm font-medium text-white underline underline-offset-4">{t('industries.ctaAction')} <ArrowRight className="inline size-3.5" /></span></Link></div></IndustrySlides></SectionReveal></div></section>
      <CityShowcase />

      {/* ── Why bilingual talent ────────────────────────────── */}
      <section className="bg-card">
        <div className="w-full px-5 py-16 sm:px-6 sm:py-28 lg:px-10">
          <SectionReveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">
                {t('landing.whyTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">{t('landing.whySub')}</p>
            </div>
          </SectionReveal>
          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {[
              { img: '/images/sm/industry-education-training.webp', title: t('landing.why1Title'), desc: t('landing.why1Desc') },
              { img: '/images/sm/industry-legal-public-sector.webp', title: t('landing.why2Title'), desc: t('landing.why2Desc') },
              { img: '/images/sm/professional-medellin-v2.webp', title: t('landing.why3Title'), desc: t('landing.why3Desc') },
              { img: '/images/sm/professional-cucuta-v2.webp', title: t('landing.why4Title'), desc: t('landing.why4Desc') },
            ].map((feat, i) => (
              <SectionReveal key={feat.title} delay={i * 0.08}>
                <div className="group relative h-72 overflow-hidden rounded-2xl bg-[#171a20] sm:h-[26rem]">
                  <img src={feat.img} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="text-xl font-medium leading-tight text-white">{feat.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/85">{feat.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Colombian talent at work ───────────────────────── */}
      <section className="section-tint">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-16 sm:gap-14 sm:py-28 lg:grid-cols-2">
          <SectionReveal>
            <div className="overflow-hidden rounded-2xl bg-secondary">
              <img src={TALENT_WORK_PHOTO} srcSet={TALENT_WORK_SRCSET} sizes="(min-width: 1024px) 560px, 100vw" alt={candidatesPhoto.alt} loading="lazy" decoding="async" className="h-64 w-full object-cover sm:h-[32rem]" />
            </div>
          </SectionReveal>
          <SectionReveal delay={0.1}>
            <p className="text-sm font-medium text-primary">{t('landing.talentEyebrow')}</p>
            <h2 className="mt-3 text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">{t('landing.talentTitle')}</h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t('landing.talentSub')}</p>
            <details className="mt-4 text-xs text-muted-foreground/70">
              <summary className="cursor-pointer select-none">{t('landing.photoCreditLabel')}</summary>
              <p className="mt-2">{candidatesPhoto.credit} · {t('landing.talentPhotoLicense')}</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-[11px] text-muted-foreground/60" aria-label={t('landing.photoCreditLabel')}>
              {PHOTO_CREDITS.map(([author, license, file, licenseUrl]) => <span key={author}><a href={file} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{author}</a> (<a href={licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{license}</a>)</span>)}
            </div>
            </details>
          </SectionReveal>
        </div>
      </section>
      {/* ── Employer acquisition CTA ─────────────────────────── */}
      <section className="bg-primary text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-24">
          <div><p className="text-sm font-medium text-white">{t('landing.employerCtaEyebrow')}</p><h2 className="mt-2 text-3xl font-medium tracking-tight text-white sm:text-[2.5rem] sm:leading-[1.1]">{t('landing.employerCtaTitle')}</h2><p className="mt-2 max-w-xl text-white/85">{t('landing.employerCtaDesc')}</p></div>
          <Button asChild size="lg" className="w-full shrink-0 bg-white text-[#171a20] hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-primary sm:w-auto"><a href="/employer?signup=1" data-early-intent="employer" onClick={() => { setOnboardingIntent('employer'); trackEvent('employer_post_start') }}>{t('landing.employerCtaAction')}</a></Button>
        </div>
      </section>
      {/* ── Footer CTA ──────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[#171a20]">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <img src={CTA_BAND_PHOTO} srcSet={CTA_BAND_SRCSET} sizes="100vw" alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/75" />
        </div>
        <div className="mx-auto max-w-4xl px-5 py-24 text-center sm:py-36">
          <SectionReveal>
            <h2 className="text-4xl font-medium tracking-tight text-white sm:text-[3.5rem] sm:leading-[1.05]">
              {t('landing.footerTitle')}
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-white px-7 text-[#171a20] hover:bg-white/90">
                <Link to="/dashboard">{t('landing.footerPrimary')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/60 bg-white/10 px-7 text-white backdrop-blur hover:bg-white hover:text-[#171a20]">
                <Link to="/jobs">{t('landing.footerSecondary')}</Link>
              </Button>
              <Link to="/contact" className="w-full text-sm text-white/80 underline-offset-4 hover:text-white hover:underline sm:w-auto">{t('contact.title')}</Link>
            </div>
          </SectionReveal>
        </div>
      </section>

    </main>
  )
}
