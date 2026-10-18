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
import { Children, useRef, type ReactNode } from 'react'
import { captureUTMParams, trackEvent } from '@/lib/marketing'
import { setOnboardingIntent } from '@/lib/intent'

/* The open jobs and company names the home page shows (live feed, company
   ribbon, industry and city counts). Read over the public REST API (see
   lib/publicRest) so supabase-js isn't loaded at start-up; prerendered into the
   HTML by the loader, then refreshed in the browser. Only the columns used. */
const HOME_JOB_COLUMNS = 'id,title,company_id,status,moderation_status,location_type,salary_min,salary_max,currency,languages_required,industry,created_at'
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
/** Small-caps chapter label: tells the visitor which conversation (professionals / employers) the next section belongs to. */
function Eyebrow({ children, tone = 'light', center = false }: { children: React.ReactNode; tone?: 'light' | 'dark'; center?: boolean }) {
  return <p className={`mb-3 text-xs font-medium uppercase tracking-[0.18em] ${tone === 'dark' ? 'text-white/60' : 'text-primary'} ${center ? 'text-center' : ''}`}>{children}</p>
}

/** Live numbers under the hero buttons, so the promise is backed by real data the moment the page loads. */
function HeroStats() {
  const { t } = useI18n()
  const { data: jobs } = useHomeJobs()
  const open = (jobs ?? []).filter(isOpen)
  if (open.length === 0) return null
  const items = [
    { n: open.length, label: t('landing.feedStatRoles') },
    { n: new Set(open.map((j) => j.companyId)).size, label: t('landing.feedStatCompanies') },
    { n: CITIES.length, label: t('landing.heroStatCities') },
  ]
  return (
    <dl className="mt-6 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 text-white/80 sm:mt-5 sm:gap-x-8">
      {items.map((x) => <div key={x.label} className="flex items-baseline gap-1.5"><dd className="order-1 text-xl font-medium tracking-tight text-white sm:text-2xl">{x.n}</dd><dt className="order-2 text-xs sm:text-sm">{x.label}</dt></div>)}
    </dl>
  )
}

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
   Phones: a slide row that advances every 3 s (see useSlideRow); wider screens: all three at once. */
const compactMoney = (v: number, locale: string) =>
  new Intl.NumberFormat(locale === 'es' ? 'es-CO' : locale === 'pt' ? 'pt-BR' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v).replace(/\s/g, '')
/* ── Phone slide row: a horizontal snap scroller that advances by itself ──
   Used on phones (<640px) for the live job feed and the industries row: one slide
   at a time, a new slide every `intervalMs`, looping back to the first. It only
   advances while on screen, pauses for 8 s after a touch and while focused or the
   tab is hidden, and never moves by itself under prefers-reduced-motion (swiping
   and the dots still work). Tablet and desktop lay the same items out as a grid. */
function useSlideRow<T extends HTMLElement>(count: number, intervalMs: number) {
  const reduce = usePrefersReducedMotion()
  const ref = useRef<T | null>(null)
  const [active, setActive] = useState(0)
  const pausedUntil = useRef(0)
  const focused = useRef(false)
  const offsetOf = (el: T, i: number) => {
    const c = el.children[i] as HTMLElement | undefined
    const f = el.children[0] as HTMLElement | undefined
    return c && f ? c.offsetLeft - f.offsetLeft : 0
  }
  const indexNow = (el: T) => {
    let best = 0
    let dist = Infinity
    for (let i = 0; i < count; i++) {
      const d = Math.abs(el.scrollLeft - offsetOf(el, i))
      if (d < dist) { dist = d; best = i }
    }
    return best
  }
  const goTo = (i: number) => {
    const el = ref.current
    if (!el) return
    pausedUntil.current = Date.now() + 8000
    setActive(i)
    el.scrollTo({ left: offsetOf(el, i), behavior: reduce ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => setActive(indexNow(el))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])
  useEffect(() => {
    if (reduce || count < 2) return
    const id = window.setInterval(() => {
      const el = ref.current
      if (!el || !window.matchMedia('(max-width: 639px)').matches || focused.current || document.hidden || Date.now() < pausedUntil.current) return
      const r = el.getBoundingClientRect()
      if (!(r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15)) return
      const next = (indexNow(el) + 1) % count
      setActive(next)
      el.scrollTo({ left: offsetOf(el, next), behavior: 'smooth' })
    }, intervalMs)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, count, intervalMs])
  const handlers = {
    onTouchStart: () => { pausedUntil.current = Date.now() + 8000 },
    onPointerDown: () => { pausedUntil.current = Date.now() + 8000 },
    onFocusCapture: () => { focused.current = true },
    onBlurCapture: () => { focused.current = false },
  }
  return { ref, active, goTo, handlers }
}
function SlideDots({ count, active, goTo, label }: { count: number; active: number; goTo: (i: number) => void; label: (i: number) => string }) {
  if (count < 2) return null
  return (
    <div className="mt-3 flex justify-center sm:hidden">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" onClick={() => goTo(i)} aria-label={label(i)} aria-current={i === active ? 'true' : undefined} className="flex size-6 min-h-0 min-w-0 items-center justify-center rounded-full">
          <span className={`block size-2 rounded-full transition-colors ${i === active ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
        </button>
      ))}
    </div>
  )
}
const SLIDE_INTERVAL_MS = 3000

/** Unsplash CDN photo by id (all vetted for the category they illustrate). */
const ux = (id: string, w = 1000) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=75`
/** Several different photos per industry family; a job's id picks one so cards in a row differ. */
const JOB_PHOTO_POOLS: Record<string, string[]> = {
  'tech-engineering': [ux('1629904853893-c2c8981a1dc5'), ux('1629904853716-f0bc54eea481'), ux('1603201667230-bd139210db18')],
  'finance-business': [ux('1551135049-8a33b5883817'), ux('1573496130141-209d200cebd8'), ux('1460925895917-afdab827c52f')],
  'customer-hospitality': [ux('1626863905121-3b0c0ed7b94c'), ux('1714079761488-e0c9b9ac4138'), ux('1766066014237-00645c74e9c6')],
  'operations-industrial': [ux('1586528116022-aeda1613c63d'), ux('1644079446600-219068676743'), ux('1664382953403-fc1ac77073a0')],
  'healthcare-public': ['/images/industry-healthcare.webp', ux('1758691462743-f9fc9e430d39'), ux('1576267423048-15c0040fec78')],
}
const JOB_PHOTO_DEFAULT = [ux('1573167507387-6b4b98cb7c13'), ux('1573164574572-cb89e39749b4')]
function jobPhoto(industry: string | undefined, id: string): string {
  const family = INDUSTRY_FAMILIES.find((f) => industry && f.members.includes(industry))
  const pool = JOB_PHOTO_POOLS[family?.slug ?? ''] ?? JOB_PHOTO_DEFAULT
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return pool[h % pool.length]
}
/** Edge-to-edge landscape (3:2) photo: no padding, no bars. Text always sits below it, never over faces. */
function Photo({ src, alt = '', className = '', srcSet, sizes, zoom = true, cover = false }: { src: string; alt?: string; className?: string; srcSet?: string; sizes?: string; zoom?: boolean; cover?: boolean }) {
  return (
    <div className={`${className.includes('absolute') ? '' : 'relative'} overflow-hidden bg-[#171a20] ${cover ? '' : 'aspect-[3/2]'} ${className}`}>
      <img src={src} srcSet={srcSet} sizes={sizes} alt={alt} loading="lazy" decoding="async" className={`absolute inset-0 size-full object-cover object-center ${zoom ? 'transition-transform duration-700 ease-out group-hover:scale-[1.03]' : ''}`} />
    </div>
  )
}
function daysSince(iso?: string): number | null {
  const ms = iso ? Date.now() - new Date(iso).getTime() : NaN
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86_400_000)) : null
}

function JobFeedPreview() {
  const { t, locale } = useI18n()
  const { data: jobs } = useHomeJobs()
  const { data: companies } = useHomeCompanies()
  const companyMap = new Map((companies ?? []).map((c: Company) => [c.id, c]))
  const open = (jobs ?? []).filter(isOpen)
  const featured = open.slice(0, 3)
  const stats = [
    { n: open.length, label: t('landing.feedStatRoles') },
    { n: new Set(open.map((j) => j.companyId)).size, label: t('landing.feedStatCompanies') },
    { n: new Set(open.map((j) => j.industry).filter(Boolean)).size, label: t('landing.feedStatIndustries') },
  ].filter((x) => x.n > 0)
  const slides = useSlideRow<HTMLUListElement>(featured.length, SLIDE_INTERVAL_MS)
  const card = (job: Job) => {
    const company = companyMap.get(job.companyId)
    const salary =
      job.salaryMin && job.salaryMax
        ? job.currency === 'USD'
          ? `$${compactMoney(job.salaryMin, locale)}–$${compactMoney(job.salaryMax, locale)}`
          : `${job.currency} ${compactMoney(job.salaryMin, locale)}–${compactMoney(job.salaryMax, locale)}`
        : t('jobs.salaryTBD')
    const age = daysSince(job.createdAt)
    const langs = (job.languagesRequired ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    return (
      <li key={job.id} className="w-full min-w-0 shrink-0 snap-center sm:w-auto">
        <Link to="/jobs/$id" params={{ id: job.id }} className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary">
          <div className="relative">
            <Photo src={jobPhoto(job.industry, job.id)} />
            {age !== null && age <= 7 && <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-white">{t('landing.feedNew')}</span>}
            {age !== null && <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-0.5 text-xs text-white backdrop-blur">{age === 0 ? t('landing.feedPostedToday') : t('landing.feedPostedDays', { n: age })}</span>}
          </div>
          <div className="relative flex flex-1 flex-col gap-3 p-5 pt-0">
            <div className="-mt-5 flex items-end gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card text-sm font-medium text-primary ring-2 ring-card">{company?.logoUrl ? <img src={company.logoUrl} alt={`${company.name} logo`} className="size-full object-cover" /> : (company?.name ?? 'J').charAt(0).toUpperCase()}</div>
              <p className="min-w-0 truncate pb-0.5 text-sm text-muted-foreground">{company?.name ?? 'Impulsa Talentos partner'}</p>
            </div>
            <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-medium leading-snug text-foreground group-hover:text-primary">{job.title}</h3>
            <p className="text-xl font-medium tracking-tight text-foreground">{salary}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden />{formatLocationType(job.locationType, t)}</span>
              {langs.map((l) => <span key={l} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{formatLanguageList(l, t)}</span>)}
            </div>
            <span className="mt-auto pt-1 text-sm font-medium text-primary">{t('landing.feedViewRole')} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-0.5">→</span></span>
          </div>
        </Link>
      </li>
    )
  }
  return (
    <div data-testid="hero-live-feed" className="w-full" aria-label={t('landing.feedTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground">
            <span aria-hidden className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>
            {t('landing.feedLive')}
          </p>
          <h2 className="mt-3 text-2xl font-medium tracking-tight text-foreground sm:text-[2rem]">{t('landing.feedLiveLabel')}</h2>
        </div>
        <Link to="/jobs" className="inline-flex min-h-8 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t('landing.feedViewAll')} →</Link>
      </div>
      {stats.length > 0 && (
        <dl className="mt-5 grid grid-cols-3 gap-3 sm:max-w-xl">
          {stats.map((x) => <div key={x.label} className="flex flex-col rounded-xl bg-card px-4 py-3"><dt className="order-2 text-xs text-muted-foreground sm:text-sm">{x.label}</dt><dd className="text-2xl font-medium tracking-tight text-primary">{x.n}</dd></div>)}
        </dl>
      )}
      {featured.length === 0
        ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="h-64 rounded-2xl bg-card" /><div className="hidden h-64 rounded-2xl bg-card sm:block" /><div className="hidden h-64 rounded-2xl bg-card sm:block" /></div>
        : <div {...slides.handlers} role="group" aria-roledescription="carousel" aria-label={t('landing.feedTitle')}>
            <ul ref={slides.ref} className="mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible">{featured.map(card)}</ul>
            <SlideDots count={featured.length} active={slides.active} goTo={slides.goTo} label={(i) => `${i + 1} / ${featured.length}`} />
          </div>}
      <div className="mt-8 flex flex-col items-center gap-4 text-center">
        <p className="max-w-2xl text-base text-foreground sm:text-lg">{t('landing.trustedByLine')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link to="/jobs">{t('landing.feedBrowse')} <ArrowRight className="size-4" aria-hidden /></Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/for-employers">{t('landing.feedHiring')}</Link></Button>
        </div>
      </div>
    </div>
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
    <section aria-label={t('landing.trustedBy', { n: companies.length })} className="marquee relative flex min-h-[2.6rem] items-center overflow-hidden bg-primary py-1 sm:py-1.5">
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
  medellin: '/images/city-medellin.webp',
  bogota: ux('1661641172357-73091e102023', 1000),
  cartagena: ux('1570197820006-3e46f5ee01bb', 1000),
  cali: '/images/city-cali.webp',
  barranquilla: '/images/city-barranquilla.webp',
  cucuta: ux('1672851612832-0784f930d982', 1000),
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
const CITY_IMAGE_ALT_KEY: Record<string, string> = {
  medellin: 'landing.cityMedellinAlt',
  bogota: 'landing.cityBogotaAlt',
  cartagena: 'landing.cityCartagenaAlt',
  cali: 'landing.cityCaliAlt',
  barranquilla: 'landing.cityBarranquillaAlt',
  cucuta: 'landing.cityCucutaAlt',
}
const PHOTO_CREDITS = [
  ['Unsplash contributors', 'Unsplash License', 'https://unsplash.com', 'https://unsplash.com/license'],
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
const PHONE_AUTO_ADVANCE = false
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
      // Phones: no self-advance (moving content is hard to read); swipe or tap a dot.
      if (!PHONE_AUTO_ADVANCE || reduce || now < pausedUntil.current) { last = now; return }
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
          <Eyebrow center>{t('landing.laneProfessionals')}</Eyebrow>
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
              <div className="group overflow-hidden rounded-xl bg-[#171a20]">
                <Photo src={CITY_PHOTOS[city.key]} alt={t(CITY_IMAGE_ALT_KEY[city.key])} />
                <div className="p-5 lg:p-4 xl:p-5">
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
   prefers-reduced-motion it never moves by itself and shows its scrollbar.
   Phones use the shared slide row (useSlideRow) with dots under it. */
function IndustrySlides({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const reduce = usePrefersReducedMotion()
  const count = Children.toArray(children).length
  const slides = useSlideRow<HTMLDivElement>(count, SLIDE_INTERVAL_MS)
  const hovering = useRef(false)
  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => {
      const el = slides.ref.current
      // Phones are driven by useSlideRow; this timer is for tablet and desktop.
      if (!el || window.matchMedia('(max-width: 639px)').matches || hovering.current || document.hidden) return
      const r = el.getBoundingClientRect()
      if (!(r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15)) return
      const first = el.firstElementChild as HTMLElement | null
      if (!first) return
      const step = first.offsetWidth
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      el.scrollTo({ left: atEnd ? 0 : Math.round(el.scrollLeft / step) * step + step, behavior: 'smooth' })
    }, SLIDE_INTERVAL_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce])
  return (
    <div
      {...slides.handlers}
      onPointerDownCapture={() => { hovering.current = true; window.setTimeout(() => { hovering.current = false }, 8000) }}
      onMouseEnter={() => { hovering.current = true }}
      onMouseLeave={() => { hovering.current = false }}
      onFocusCapture={() => { hovering.current = true; slides.handlers.onFocusCapture() }}
      onBlurCapture={() => { hovering.current = false; slides.handlers.onBlurCapture() }}
    >
      <div
        ref={slides.ref}
        aria-roledescription="carousel"
        aria-label={t('industries.sectionTitle')}
        className={`-mx-2 mt-8 flex snap-x snap-mandatory overflow-x-auto sm:mt-10 ${reduce ? 'pb-2' : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'}`}
      >
        {children}
      </div>
      <SlideDots count={count} active={slides.active} goTo={slides.goTo} label={(i) => `${i + 1} / ${count}`} />
    </div>
  )
}
/* Photo for each industry family card (images read better than icons). */
const FAMILY_PHOTOS: Record<string, string> = {
  'tech-engineering': ux('1629904853716-f0bc54eea481', 1000),
  'finance-business': ux('1551135049-8a33b5883817', 1000),
  'customer-hospitality': ux('1626863905121-3b0c0ed7b94c', 1000),
  'operations-industrial': ux('1586528116022-aeda1613c63d', 1000),
  'healthcare-public': '/images/industry-healthcare.webp',
}
function FamilyCard({ family }: { family: typeof INDUSTRY_FAMILIES[number] }) {
  const { t } = useI18n(); const { data: jobs } = useHomeJobs(); const counts = new Map<string, number>();
  for (const j of (jobs ?? []).filter(j => isOpen(j) && j.industry)) counts.set(j.industry!, (counts.get(j.industry!) ?? 0) + 1);
  const total = family.members.reduce((n, m) => n + (counts.get(m) ?? 0), 0)
  const subjects = family.members.filter(m => (counts.get(m) ?? 0) > 0)
  /* Fixed-height, full-bleed photo panel: every card is the same size, the photo
     always fills it, and the title + subjects sit on a bottom gradient. */
  return <div className="group overflow-hidden rounded-2xl bg-[#171a20]">
    <div className="relative">
      <Photo src={FAMILY_PHOTOS[family.slug] ?? ux('1573167507387-6b4b98cb7c13')} />
      {total > 0 && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#171a20] backdrop-blur">{t('industries.open', { n: total })}</span>}
    </div>
    <div className="flex flex-col p-5 sm:p-6">
      <h3 className="text-2xl font-medium leading-tight text-white sm:text-[1.75rem]">{t(`industries.family.${family.slug}`)}</h3>
      <div className="mt-4 flex min-h-[6.5rem] flex-wrap content-start gap-2 sm:min-h-[7.5rem]">
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
      <section className="relative isolate -mt-16 flex flex-col overflow-hidden bg-[#171a20] sm:min-h-[84svh]" onMouseEnter={() => { pausedRef.current = true }} onMouseLeave={() => { pausedRef.current = document.hidden }} onFocusCapture={() => { pausedRef.current = true }} onBlurCapture={() => { pausedRef.current = document.hidden }}>
        {/* Phones: the whole 3:2 photo sits in a 3:2 frame below the nav and the text follows on solid dark. Tablet and up: full-bleed, edge-to-edge hero. */}
        <div className="absolute inset-x-0 top-0 z-0 h-[calc(66.667vw+4rem)] sm:inset-0 sm:h-auto" aria-hidden="true">
          {[prevSlide, slide].filter((i): i is number => i !== null).map((i) => (
            <div key={i} className={`absolute inset-0 ${i === slide && prevSlide !== null ? 'hero-fade-in' : ''}`}>
              <img src={INDUSTRY_HERO_PHOTOS[HERO_SLIDES[i]]} alt={i === slide ? t(INDUSTRY_HERO_ALT_KEYS[HERO_SLIDES[i]]) : ''} loading={i === INITIAL_HERO_SLIDE ? 'eager' : 'lazy'} fetchPriority={i === INITIAL_HERO_SLIDE ? 'high' : 'auto'} decoding="async" className="absolute inset-x-0 bottom-0 top-16 h-[calc(100%-4rem)] w-full object-cover object-center sm:inset-0 sm:h-full" />
            </div>
          ))}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/20 sm:from-black/65 sm:via-transparent sm:to-black/55" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 flex-col items-center justify-start px-5 pb-16 pt-[calc(66.667vw+5.5rem)] text-center sm:px-6 sm:justify-between sm:pb-24 sm:pt-32 lg:px-10">
          <div className="flex flex-col items-center">
          <h1 className="max-w-5xl text-[2.25rem] font-medium leading-[1.05] tracking-tight text-white sm:text-[3.75rem] lg:text-[4.5rem]">{t('landing.heroTitle1')}<span className="block">{t('landing.heroTitle2')}</span></h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{t('landing.heroSub')}</p>
          </div>
          <div className="mt-8 flex w-full flex-col items-center sm:mt-0 sm:w-auto"><div className="w-full sm:w-auto"><LandingCTAs /></div><HeroStats /></div>
        </div>
        <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center">{HERO_SLIDES.map((key,i)=><button key={key} type="button" onClick={()=>showSlide(i)} aria-label={key.replace(/-/g, ' ')} aria-current={i === slide ? 'true' : undefined} className="group flex size-6 min-h-0 min-w-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><span className={`block size-2 rounded-full transition-colors ${i===slide?'bg-white':'bg-white/40 group-hover:bg-white/70'}`} /></button>)}</div>
        <p className="absolute bottom-1 left-3 z-10 hidden max-w-[70%] text-[10px] leading-tight text-white/70 sm:left-6 sm:block">Original industry imagery · Generated for Impulsa Talentos</p>
      </section>
      <CompanyRibbon companies={companies} />
      {/* The live job feed sits in its own flat band under the ribbon at every width. */}
      <section className="bg-secondary px-5 py-10 sm:py-14"><div className="mx-auto max-w-6xl"><JobFeedPreview /></div></section>
      {/* ── How it works — candidate journey ────────────────── */}
      <section className="bg-[#171a20] text-white"><div className="mx-auto w-full max-w-[88rem] px-5 py-14 sm:px-6 sm:py-24 lg:px-10">
        <SectionReveal>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <Eyebrow tone="dark">{t('landing.laneProfessionals')}</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tight text-white sm:text-[2.75rem] sm:leading-[1.08]">{t('landing.howTitle')}</h2>
              <p className="mt-3 text-base text-white/70 sm:text-lg">{t('landing.howSub')}</p>
            </div>
            <Button asChild size="lg" className="hidden bg-white px-7 text-[#171a20] hover:bg-white/90 sm:inline-flex"><Link to="/dashboard">{t('landing.ctaCreate')}</Link></Button>
          </div>
        </SectionReveal>
        {/* A numbered rail runs through the three steps, so the section reads as one journey. */}
        <ol className="mt-10 grid gap-10 sm:mt-14 sm:grid-cols-3 sm:gap-6">
          {[
            { step: '01', img: ux('1557804506-669a67965ba0', 800), alt: t('landing.how1ImgAlt'), title: t('landing.how1Title'), desc: t('landing.how1Desc') },
            { step: '02', img: ux('1573164574572-cb89e39749b4', 800), alt: t('landing.how2ImgAlt'), title: t('landing.how2Title'), desc: t('landing.how2Desc') },
            { step: '03', img: ux('1622675363311-3e1904dc1885', 800), alt: t('landing.how3ImgAlt'), title: t('landing.how3Title'), desc: t('landing.how3Desc') },
          ].map((st, i, all) => (
            <li key={st.step}>
              <SectionReveal delay={i * 0.1}>
                <div className="flex items-center gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/30 text-sm font-medium tracking-wide text-white">{st.step}</span>
                  <span aria-hidden="true" className={`h-px flex-1 bg-gradient-to-r from-white/35 to-white/5 ${i === all.length - 1 ? 'hidden' : 'sm:-mr-6'}`} />
                </div>
                <div className="group mt-5 overflow-hidden rounded-2xl bg-[#0f1115]">
                  <Photo src={st.img} alt={st.alt} />
                  <div className="p-5 sm:p-6">
                    <h3 className="text-2xl font-medium leading-tight text-white">{st.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-white/75">{st.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            </li>
          ))}
        </ol>
        <Button asChild size="lg" className="mt-10 w-full bg-white px-7 text-[#171a20] hover:bg-white/90 sm:hidden"><Link to="/dashboard">{t('landing.ctaCreate')}</Link></Button>
      </div></section>

      <section className="bg-card"><div className="w-full px-5 py-12 sm:px-6 sm:py-28 lg:px-10"><SectionReveal><div className="flex flex-wrap items-end justify-between gap-4"><div><Eyebrow>{t('landing.laneProfessionals')}</Eyebrow><h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-tight">{t('industries.sectionTitle')}</h2><p className="mt-3 text-muted-foreground">{t('industries.sectionSub')}</p></div><Button asChild variant="outline" size="sm"><Link to="/jobs">{t('industries.viewAll')} <ArrowRight className="size-3.5" /></Link></Button></div></SectionReveal><SectionReveal><IndustrySlides>{INDUSTRY_FAMILIES.map((family) => <div key={family.slug} className="shrink-0 basis-[88%] snap-start px-2 sm:basis-1/2 lg:basis-1/3"><FamilyCard family={family} /></div>)}<div className="shrink-0 basis-[88%] snap-start px-2 sm:basis-1/2 lg:basis-1/3"><Link to="/dashboard" className="group block overflow-hidden rounded-2xl bg-[#171a20] text-white"><Photo src={ux('1742112125567-3e8967bad60f')} /><div className="p-5 sm:p-6"><h3 className="text-2xl font-medium leading-tight sm:text-[1.75rem]">{t('industries.ctaTitle')}</h3><p className="mt-2 text-sm text-white/85">{t('industries.ctaDesc')}</p><span className="mt-3 inline-block text-sm font-medium text-white underline underline-offset-4">{t('industries.ctaAction')} <ArrowRight className="inline size-3.5" /></span></div></Link></div></IndustrySlides></SectionReveal></div></section>
      <CityShowcase />

      {/* ── Why bilingual talent ────────────────────────────── */}
      <section className="bg-card">
        <div className="w-full px-5 py-12 sm:px-6 sm:py-28 lg:px-10">
          <SectionReveal>
            <div className="mx-auto max-w-2xl text-center">
              <Eyebrow center>{t('landing.laneEmployers')}</Eyebrow>
              <h2 className="text-3xl font-medium tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.1]">
                {t('landing.whyTitle')}
              </h2>
              <p className="mt-3 text-muted-foreground">{t('landing.whySub')}</p>
            </div>
          </SectionReveal>
          <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {[
              { img: ux('1664382953481-141e97ad9825', 800), title: t('landing.why1Title'), desc: t('landing.why1Desc') },
              { img: ux('1573496130141-209d200cebd8', 800), title: t('landing.why2Title'), desc: t('landing.why2Desc') },
              { img: '/images/sm/professional-medellin-v2.webp', title: t('landing.why3Title'), desc: t('landing.why3Desc') },
              { img: ux('1742440711276-679934f5b988', 800), title: t('landing.why4Title'), desc: t('landing.why4Desc') },
            ].map((feat, i) => (
              <SectionReveal key={feat.title} delay={i * 0.08}>
                <div className="group overflow-hidden rounded-2xl bg-[#171a20]">
                  <Photo src={feat.img} />
                  <div className="p-5">
                    <h3 className="text-lg font-medium leading-tight text-white sm:text-xl">{feat.title}</h3>
                    <p className="mt-2 text-base leading-relaxed text-white/85 sm:text-sm">{feat.desc}</p>
                  </div>
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Employer pitch: the "for employers" chapter closes with a clear ask ── */}
      <section className="bg-[#171a20] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:gap-14 sm:py-28 lg:grid-cols-2">
          <SectionReveal>
            <div className="overflow-hidden rounded-2xl bg-[#0f1115]">
              <Photo src={TALENT_WORK_PHOTO} srcSet={TALENT_WORK_SRCSET} sizes="(min-width: 1024px) 560px, 100vw" alt={candidatesPhoto.alt} zoom={false} />
            </div>
          </SectionReveal>
          <SectionReveal delay={0.1}>
            <Eyebrow tone="dark">{t('landing.laneEmployers')}</Eyebrow>
            <h2 className="text-3xl font-medium tracking-tight text-white sm:text-[2.5rem] sm:leading-[1.1]">{t('landing.talentTitle')}</h2>
            <p className="mt-4 leading-relaxed text-white/80">{t('landing.talentSub')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" className="w-full bg-white px-7 text-[#171a20] hover:bg-white/90 sm:w-auto"><a href="/employer?signup=1" data-early-intent="employer" onClick={() => { setOnboardingIntent('employer'); trackEvent('employer_post_start') }}>{t('landing.employerCtaAction')}</a></Button>
              <Button asChild variant="outline" size="lg" className="w-full border-white/50 bg-transparent px-7 text-white hover:bg-white hover:text-[#171a20] sm:w-auto"><Link to="/companies">{t('landing.companiesViewAll')}</Link></Button>
            </div>
            <details className="mt-6 text-sm text-white/60 sm:text-xs">
              <summary className="inline-flex min-h-11 cursor-pointer select-none items-center sm:min-h-0">{t('landing.photoCreditLabel')}</summary>
              <p className="mt-2">{candidatesPhoto.credit} · {t('landing.talentPhotoLicense')}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm sm:gap-x-3 sm:gap-y-1 sm:text-[11px] text-white/60" aria-label={t('landing.photoCreditLabel')}>
              {PHOTO_CREDITS.map(([author, license, file, licenseUrl]) => <span key={author}><a href={file} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{author}</a> (<a href={licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{license}</a>)</span>)}
            </div>
            </details>
          </SectionReveal>
        </div>
      </section>
      {/* ── Footer CTA ──────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[#171a20]">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <Photo src={CTA_BAND_PHOTO} srcSet={CTA_BAND_SRCSET} sizes="100vw" zoom={false} cover className="absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/75" />
        </div>
        <div className="mx-auto max-w-4xl px-5 py-16 text-center sm:py-36">
          <SectionReveal>
            <h2 className="text-4xl font-medium tracking-tight text-white sm:text-[3.5rem] sm:leading-[1.05]">
              {t('landing.footerTitle')}
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-white px-7 text-[#171a20] hover:bg-white/90">
                <Link to="/dashboard">{t('landing.footerPrimary')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white/60 bg-white/10 px-7 text-white backdrop-blur hover:bg-white hover:text-[#171a20]">
                <a href="/employer?signup=1" data-early-intent="employer" onClick={() => { setOnboardingIntent('employer'); trackEvent('employer_post_start') }}>{t('landing.footerSecondary')}</a>
              </Button>
              <Link to="/contact" className="w-full text-sm text-white/80 underline-offset-4 hover:text-white hover:underline sm:w-auto">{t('contact.title')}</Link>
            </div>
          </SectionReveal>
        </div>
      </section>

    </main>
  )
}
