import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { BriefcaseBusiness, Check, FileText, Globe2, Users, Zap } from 'lucide-react'
import { Reveal } from '@/components/Reveal'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/PublicHeader'
import { useI18n } from '@/i18n/I18nProvider'
import { useAllJobs } from '@/hooks/useJobs'
import { useAllCompanies } from '@/hooks/useCompanies'
import { setOnboardingIntent } from '@/lib/intent'

export const Route = createFileRoute('/for-employers')({
  component: ForEmployersPage,
  head: () => ({ meta: [{ title: 'For Employers — Hire Bilingual Talent | Impulsa Talentos' }, { name: 'description', content: "Find Colombia's best bilingual talent. Post jobs, review candidates, and hire globally." }] }),
})

const open = (j: { status: string; moderationStatus?: string }) => j.status === 'open' && j.moderationStatus !== 'pending'
function ForEmployersPage() {
  const { t } = useI18n()
  const { data: jobs } = useAllJobs()
  const { data: companies } = useAllCompanies()
  const navigate = useNavigate()
  const openJobs = (jobs ?? []).filter(open)
  const stats = [{ value: openJobs.length, label: t('employers.stats.jobs') }, { value: new Set(openJobs.map(j => j.companyId)).size, label: t('employers.stats.companies') }, { value: openJobs.length, label: t('employers.stats.roles') }]
  const steps = [{ icon: Users, title: t('employers.step1Title'), text: t('employers.step1Desc') }, { icon: FileText, title: t('employers.step2Title'), text: t('employers.step2Desc') }, { icon: Zap, title: t('employers.step3Title'), text: t('employers.step3Desc') }]
  const props = [{ icon: Globe2, text: t('employers.why1') }, { icon: BriefcaseBusiness, text: t('employers.why2') }, { icon: FileText, text: t('employers.why3') }, { icon: Check, text: t('employers.why4') }]
  const goToDashboard = () => { setOnboardingIntent('employer'); navigate({ to: '/employer', search: { signup: 1 } as never }) }
  return <div className="min-h-dvh bg-background"><PublicHeader /><main id="main">
    <section className="relative -mt-16 flex min-h-[100svh] items-center overflow-hidden bg-[#171a20] text-white"><img src="/images/employer/employer-hero-office.webp" alt={t('employers.heroImageAlt')} loading="eager" decoding="async" className="absolute inset-0 size-full object-cover object-right" /><div className="absolute inset-0 bg-black/55" aria-hidden="true" /><div className="relative mx-auto grid max-w-6xl items-center gap-10 w-full px-5 pb-20 pt-32 lg:grid-cols-[1.1fr_.9fr] lg:px-8"><div><p className="text-sm font-medium text-white">{t('employers.heroEyebrow')}</p><h1 className="mt-4 text-[2.25rem] font-medium leading-[1.05] tracking-tight sm:text-[3.5rem]">{t('employers.heroTitle')}</h1><p className="mt-5 max-w-xl text-base leading-relaxed text-white">{t('employers.heroDesc')}</p><Button size="lg" className="mt-8 bg-white text-[#171a20] hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-black/40" onClick={goToDashboard}>{t('employers.heroCta')}</Button></div><div className="rounded-xl bg-black/40 p-6 backdrop-blur-sm"><p className="text-sm font-medium text-white">{t('employers.snapshot')}</p><div className="mt-5 grid grid-cols-3 gap-3">{stats.map(s => <div key={s.label} className="rounded-lg bg-white/10 p-3 text-center"><p className="text-2xl font-medium text-white">{s.value}</p><p className="mt-1 text-xs text-white">{s.label}</p></div>)}</div><div className="mt-6 space-y-3">{(companies ?? []).slice(0, 3).map(c => <div key={c.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-3"><div className="flex size-9 items-center justify-center rounded-lg bg-white/15 font-medium text-white">{c.name.charAt(0)}</div><span className="text-sm font-medium text-white">{c.name}</span><span className="ml-auto text-xs text-white/80">{c.industry}</span></div>)}</div></div></div></section>
    <section className="relative overflow-hidden px-5 py-20 sm:py-28"><img src="/images/employer/employer-how-it-works-texture.webp" alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 size-full object-cover opacity-10" /><div className="relative mx-auto max-w-2xl text-center"><h2 className="text-3xl font-medium tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">{t('employers.howTitle')}</h2><p className="mt-3 text-muted-foreground">{t('employers.howDesc')}</p></div><div className="relative mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-3">{steps.map((s, i) => <Reveal key={s.title} delay={i * .1} className="rounded-xl bg-card p-6"><div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary"><s.icon className="size-5" /></div><p className="mt-5 text-sm font-medium text-muted-foreground">0{i + 1}</p><h3 className="mt-2 font-medium">{s.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p></Reveal>)}</div></section>
    <section className="bg-secondary"><div className="mx-auto max-w-6xl px-5 py-20 sm:py-28"><div className="max-w-2xl"><h2 className="text-3xl font-medium tracking-tight sm:text-[2.5rem] sm:leading-[1.1]">{t('employers.whyTitle')}</h2></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{props.map(p => <div key={p.text} className="rounded-xl bg-card p-5"><p.icon className="size-5 text-primary" /><p className="mt-4 text-sm font-medium leading-relaxed">{p.text}</p></div>)}</div></div></section>
    <section className="relative overflow-hidden px-5 py-20 sm:py-24"><img src="/images/employer/employer-cta-medellin-dusk.webp" alt={t('employers.ctaImageAlt')} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover object-right" /><div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" /><div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-xl p-8 text-white sm:flex-row sm:items-center sm:p-12"><div><h2 className="text-3xl font-medium tracking-tight sm:text-[2.5rem]">{t('employers.pricingTitle')}</h2><p className="mt-2 text-white">{t('employers.pricingDesc')}</p></div><Button asChild size="lg" className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 focus-visible:ring-white focus-visible:ring-offset-black/40"><Link to="/pricing">{t('employers.pricingCta')}</Link></Button></div></section>
    <section className="bg-[#171a20] px-5 py-24 text-center sm:py-32 text-white"><h2 className="text-3xl font-medium tracking-tight sm:text-[2.5rem]">{t('employers.footerTitle')}</h2><Button size="lg" className="mt-7 bg-white text-[#171a20] hover:bg-white/90 focus-visible:ring-white focus-visible:ring-offset-[#171a20]" onClick={goToDashboard}>{t('employers.heroCta')}</Button></section>
  </main></div>
}
