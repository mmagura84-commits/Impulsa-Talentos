import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, BriefcaseBusiness, Check, FileText, Globe2, Users, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PublicHeader } from '@/components/PublicHeader'
import { useI18n } from '@/i18n/I18nProvider'
import { useAllJobs } from '@/hooks/useJobs'
import { useAllCompanies } from '@/hooks/useCompanies'

export const Route = createFileRoute('/for-employers')({
  component: ForEmployersPage,
  head: () => ({ meta: [{ title: 'For Employers — Hire Bilingual Talent | Impulsa Talentos' }, { name: 'description', content: "Find Colombia's best bilingual talent. Post jobs, review candidates, and hire globally." }] }),
})

const open = (j: { status: string; moderationStatus?: string }) => j.status === 'open' && j.moderationStatus !== 'pending'
function ForEmployersPage() {
  const { t } = useI18n()
  const { data: jobs } = useAllJobs()
  const { data: companies } = useAllCompanies()
  const openJobs = (jobs ?? []).filter(open)
  const stats = [{ value: openJobs.length, label: t('employers.stats.jobs') }, { value: new Set(openJobs.map(j => j.companyId)).size, label: t('employers.stats.companies') }, { value: openJobs.length, label: t('employers.stats.roles') }]
  const steps = [{ icon: Users, title: t('employers.step1Title'), text: t('employers.step1Desc') }, { icon: FileText, title: t('employers.step2Title'), text: t('employers.step2Desc') }, { icon: Zap, title: t('employers.step3Title'), text: t('employers.step3Desc') }]
  const props = [{ icon: Globe2, text: t('employers.why1') }, { icon: BriefcaseBusiness, text: t('employers.why2') }, { icon: FileText, text: t('employers.why3') }, { icon: Check, text: t('employers.why4') }]
  return <div className="min-h-dvh bg-background"><PublicHeader /><main>
    <section className="relative overflow-hidden bg-slate-950 text-white"><div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-primary/30" aria-hidden="true" /><div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:py-28 lg:grid-cols-[1.1fr_.9fr] lg:px-8"><div><p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">{t('employers.heroEyebrow')}</p><h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">{t('employers.heroTitle')}</h1><p className="mt-5 max-w-xl text-lg leading-relaxed text-white/75">{t('employers.heroDesc')}</p><Button asChild size="lg" className="mt-8 gap-2 bg-accent text-slate-950 hover:bg-accent/90"><Link to="/dashboard">{t('employers.heroCta')}<ArrowRight className="size-4" /></Link></Button></div><div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-md"><p className="text-sm font-semibold text-white/70">{t('employers.snapshot')}</p><div className="mt-5 grid grid-cols-3 gap-3">{stats.map(s => <div key={s.label} className="rounded-xl bg-black/20 p-3 text-center"><p className="text-2xl font-bold text-accent">{s.value}</p><p className="mt-1 text-xs text-white/65">{s.label}</p></div>)}</div><div className="mt-6 space-y-3">{(companies ?? []).slice(0, 3).map(c => <div key={c.id} className="flex items-center gap-3 rounded-lg bg-white/5 p-3"><div className="flex size-9 items-center justify-center rounded-lg bg-accent/15 font-bold text-accent">{c.name.charAt(0)}</div><span className="text-sm font-medium text-white">{c.name}</span><span className="ml-auto text-xs text-white/50">{c.industry}</span></div>)}</div></div></div></section>
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20"><div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('employers.howTitle')}</h2><p className="mt-3 text-muted-foreground">{t('employers.howDesc')}</p></div><div className="mt-10 grid gap-5 sm:grid-cols-3">{steps.map((s, i) => <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .1 }} className="rounded-2xl border border-border bg-card p-6"><div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><s.icon className="size-5" /></div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-primary">0{i + 1}</p><h3 className="mt-2 font-semibold">{s.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p></motion.div>)}</div></section>
    <section className="border-y border-border bg-muted/40"><div className="mx-auto max-w-6xl px-5 py-16 sm:py-20"><div className="max-w-2xl"><h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('employers.whyTitle')}</h2></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{props.map(p => <div key={p.text} className="rounded-2xl border border-border bg-card p-5"><p.icon className="size-5 text-primary" /><p className="mt-4 text-sm font-medium leading-relaxed">{p.text}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-6xl px-5 py-16"><div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-primary/[.06] p-8 sm:flex-row sm:items-center sm:p-12"><div><h2 className="text-3xl font-bold">{t('employers.pricingTitle')}</h2><p className="mt-2 text-muted-foreground">{t('employers.pricingDesc')}</p></div><Button asChild variant="outline" size="lg"><Link to="/pricing">{t('employers.pricingCta')}<ArrowRight className="ml-2 size-4" /></Link></Button></div></section>
    <section className="bg-slate-950 px-5 py-16 text-center text-white"><h2 className="text-3xl font-bold sm:text-4xl">{t('employers.footerTitle')}</h2><Button asChild size="lg" className="mt-7 bg-accent text-slate-950 hover:bg-accent/90"><Link to="/dashboard">{t('employers.heroCta')}<ArrowRight className="ml-2 size-4" /></Link></Button></section>
  </main></div>
}
