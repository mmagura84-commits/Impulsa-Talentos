import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Check, Sparkles, Loader2, CircleCheck, Landmark, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { useI18n } from '@/i18n/I18nProvider'
import { JOB_PACKAGES, FREE_TRIAL_PLAN, type JobPostingPackage } from '@/lib/pricing'
import { PublicHeader } from '@/components/PublicHeader'
import { LeadCaptureForm } from '@/components/LeadCaptureForm'
import { AuthGate } from '@/components/AuthGate'
import { useAuth, useIsEmployer } from '@/hooks/useAuth'
import { useCompany } from '@/hooks/useCompanies'
import { supabase } from '@/lib/supabase'
import { useEffect } from 'react'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: 'Pricing — Hire Bilingual Talent on Impulsa Talentos' },
      { name: 'description', content: 'Pro Plan $97/mo, Premium Plan $297/mo, Talent Hunt done-for-you recruiting. Post jobs, reach pre-verified talent, hire faster.' },
    ],
  }),
})

type Billing = 'monthly' | 'yearly'

function PlanCard({ id, billing, onBuy }: { id: string; billing: Billing; onBuy: (pkg: JobPostingPackage) => void }) {
  const { t } = useI18n()
  const pkg = JOB_PACKAGES.find(p => p.id === id)!
  const isPremium = pkg.kind === 'premium'
  const isTalent = pkg.kind === 'talent'
  const price = billing === 'yearly' ? pkg.priceYearlyUsd : pkg.priceUsd
  return (
    <div className={isPremium ? 'md:-mt-3 md:mb-3' : ''}>
      <Card className={`h-full flex flex-col ${isPremium ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isPremium && <Sparkles className="size-4 text-primary" />}
            {t(pkg.nameKey)}
          </CardTitle>
          <CardDescription className="min-h-10">{t(pkg.descKey)}</CardDescription>
          {isTalent ? (
            <p className="text-2xl font-bold font-serif mt-1">
              {t('pricing.oneTime')}
            </p>
          ) : (
            <p className="text-3xl font-bold font-serif mt-1">
              ${price}
              <span className="text-sm font-normal text-muted-foreground"> USD</span>
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {billing === 'yearly' ? t('pricing.year') : t('pricing.month')}
              </span>
            </p>
          )}
          {!isTalent && billing === 'yearly' && (
            <p className="text-xs font-medium text-emerald-600 mt-1">{t('pricing.yearlyDeal')}</p>
          )}
        </CardHeader>
        <CardContent className="flex flex-col flex-1 gap-4">
          <ul className="space-y-2 flex-1">
            {pkg.featuresKeys.map(k => (
              <li key={k} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                {t(k)}
              </li>
            ))}
          </ul>
          {isTalent ? (
            <Button asChild className="w-full">
              <Link to="/contact">
                <Phone className="size-4" />
                {t('pricing.bookCall')}
              </Link>
            </Button>
          ) : (
            <Button onClick={() => onBuy(pkg)} className="w-full" variant={isPremium ? 'default' : 'outline'}>
              {t('pricing.buy')}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Compare table: Free Trial / Pro / Premium (mirrors Remote Latinos). */
function CompareTable() {
  const { t } = useI18n()
  const free = FREE_TRIAL_PLAN
  const pro = JOB_PACKAGES.find(p => p.id === 'pro')!
  const premium = JOB_PACKAGES.find(p => p.id === 'premium')!
  const days = (p: JobPostingPackage) => `${p.listingDays} ${t('pricing.cmp.days')}`
  const yes = <span className="text-emerald-600">✓</span>
  const no = <span className="text-muted-foreground">—</span>
  const heads = [
    { name: t(free.nameKey), pkg: free },
    { name: t(pro.nameKey), pkg: pro },
    { name: t(premium.nameKey), pkg: premium },
  ]
  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: t('pricing.cmp.posts'), cells: [t('pricing.feat.free.posts'), t('pricing.feat.pro.posts'), t('pricing.feat.premium.posts')] },
    { label: t('pricing.cmp.duration'), cells: [days(free), days(pro), days(premium)] },
    { label: t('pricing.cmp.applicants'), cells: ['20', '100', t('pricing.cmp.unlimited')] },
    { label: t('pricing.cmp.admin'), cells: ['1', '1', '2'] },
    { label: t('pricing.cmp.team'), cells: [no, '2', '5'] },
    { label: t('pricing.cmp.contact'), cells: [no, t('pricing.feat.pro.contact'), t('pricing.feat.premium.contact')] },
    { label: t('pricing.cmp.email'), cells: [t('pricing.feat.free.support'), t('pricing.feat.pro.support'), t('pricing.feat.premium.support')] },
    { label: t('pricing.cmp.call'), cells: [no, no, yes] },
    { label: t('pricing.cmp.chatbot'), cells: [no, no, yes] },
  ]
  return (
    <section className="mt-14">
      <h2 className="mb-6 hidden text-center font-serif text-xl font-bold sm:block">{t('pricing.compare.title')}</h2>
      {/* Phones: the 4-column table does not fit, so each plan gets a block listing every row.
          It repeats detail already shown on the plan cards, so it sits in a native
          collapsible section (keyboard and screen-reader friendly, closed by default). */}
      <details className="group sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border bg-card px-4 py-3 [&::-webkit-details-marker]:hidden">
          <h2 className="font-serif text-xl font-bold">{t('pricing.compare.title')}</h2>
          <span aria-hidden="true" className="text-2xl leading-none transition-transform group-open:rotate-45">+</span>
        </summary>
      <div className="mt-4 space-y-4">
        {heads.map((h, col) => (
          <div key={h.name} className="rounded-xl border bg-card p-4">
            <h3 className="text-lg font-semibold">{h.name}</h3>
            <dl className="mt-3 divide-y divide-border text-base">
              {rows.map(r => (
                <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="max-w-[55%] text-right">{r.cells[col]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      </details>
      <div className="hidden overflow-x-auto rounded-xl border sm:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="p-3 text-left font-semibold text-muted-foreground w-40">{''}</th>
              {heads.map(h => (
                <th key={h.name} className="p-3 text-center font-semibold">{h.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-t border-border">
                <td className="p-3 text-left font-medium text-muted-foreground">{r.label}</td>
                {r.cells.map((c, i) => <td key={i} className="p-3 text-center">{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Manual-first checkout (Gate 2 pending). Presents the current honest payment
 *  method (bank transfer + proof/reference), records a pending payment order via
 *  submit_manual_payment, and explains that credits are granted once an admin
 *  verifies receipt. Online card (Wompi) is explicitly "being configured" — no
 *  fake live-payment claims. The amount reflects the selected billing period. */
function CheckoutSheet({ pkg, billing, open, onClose }: { pkg: JobPostingPackage | null; billing: Billing; open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const isEmployer = useIsEmployer()
  const { data: company } = useCompany(user?.id)
  const [phase, setPhase] = useState<'form' | 'submitted'>('form')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submittedRef, setSubmittedRef] = useState('')
  // Card checkout link submitted by the MD (Wompi hosted page), if any.
  const [cardLink, setCardLink] = useState<string | null>(null)
  useEffect(() => {
    if (!open || !user) return
    supabase.rpc('public_payment_link').then(({ data }) => setCardLink(typeof data === 'string' && data.startsWith('https://') ? data : null))
  }, [open, user])
  // Instant card checkout (migration 045): shown only when Wompi is configured
  // and this plan has a peso price. Credits arrive as soon as Wompi confirms.
  const packageId = pkg ? (billing === 'yearly' ? `${pkg.id}_yearly` : pkg.id) : ''
  const [copCents, setCopCents] = useState<number | null>(null)
  const [cardEnabled, setCardEnabled] = useState(false)
  const [cardBusy, setCardBusy] = useState(false)
  useEffect(() => {
    if (!open || !user || !packageId) return
    let active = true
    supabase.from('billing_packages').select('amount_cop_cents').eq('id', packageId).maybeSingle()
      .then(({ data }) => { if (active) setCopCents(Number((data as { amount_cop_cents?: number } | null)?.amount_cop_cents) || null) })
    supabase.functions.invoke('wompi-payments', { body: { action: 'config' } })
      .then(({ data }) => { if (active) setCardEnabled(!!(data as { enabled?: boolean } | null)?.enabled) })
      .catch(() => { if (active) setCardEnabled(false) })
    return () => { active = false }
  }, [open, user, packageId])
  const cardReady = cardEnabled && !!copCents
  const payByCard = async () => {
    if (!company || !packageId) return
    setCardBusy(true)
    setSubmitError('')
    const { data, error } = await supabase.functions.invoke('wompi-payments', { body: { action: 'checkout', companyId: company.id, packageId } })
    const url = (data as { url?: string } | null)?.url
    if (error || !url) {
      setCardBusy(false)
      setSubmitError(t('pricing.card.startError'))
      return
    }
    window.location.href = url
  }

  // Reset per-open (so closing then re-opening starts clean).
  useEffect(() => {
    if (open) { setPhase('form'); setReference(''); setNote(''); setSubmitError(''); setSubmittedRef('') }
  }, [open, pkg?.id])

  const amountUsd = pkg && pkg.priceUsd > 0 ? (billing === 'yearly' ? pkg.priceYearlyUsd : pkg.priceUsd) : 0

  const submit = async () => {
    if (!pkg || !company) return
    const referenceVal = reference.trim()
    setBusy(true)
    setSubmitError('')
    const { data, error } = await supabase.rpc('submit_manual_payment', {
      p_company_id: company.id,
      // The database prices the order from its own catalog (migration 041);
      // only the package id is trusted.
      p_package_id: billing === 'yearly' ? `${pkg.id}_yearly` : pkg.id,
      p_amount_usd: amountUsd,
      p_requested_credits: pkg.credits,
      p_transaction_reference: referenceVal,
      p_proof_note: note.trim(),
    })
    setBusy(false)
    if (error) {
      setSubmitError(t('pricing.manual.submitError') + ' ' + error.message)
      return
    }
    setSubmittedRef(String(data ?? ''))
    setPhase('submitted')
    toast.success(t('pricing.manual.submitted'))
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{pkg ? t(pkg.nameKey) : ''} — ${amountUsd || ''} USD{billing === 'yearly' ? t('pricing.year') : t('pricing.month')}</SheetTitle>
          <SheetDescription>{pkg ? t(pkg.descKey) : ''}</SheetDescription>
        </SheetHeader>
        <div className="mt-5">
          {!pkg ? null : (
            <AuthGate fallbackKey="pricing.auth.title" fallbackDescKey="pricing.auth.desc">
              {!isEmployer || !company ? (
                <div className="grid gap-3 text-sm">
                  <p className="text-muted-foreground">{t('pricing.manual.noCompany')}</p>
                  <Button asChild>
                    <Link to="/employer/post-job">{t('pricing.manual.createCompany')}</Link>
                  </Button>
                </div>
              ) : phase === 'submitted' ? (
                <div className="grid gap-3 text-center text-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                    <CircleCheck className="size-6 text-emerald-600" />
                  </div>
                  <p className="font-medium text-foreground">{t('pricing.manual.received')}</p>
                  <p className="text-muted-foreground">{t('pricing.manual.receivedDesc')}</p>
                  {submittedRef && (
                    <p className="text-muted-foreground">{t('pricing.manual.orderId')} <span className="text-foreground">{submittedRef}</span></p>
                  )}
                  <Button variant="outline" onClick={onClose}>{t('pricing.manual.close')}</Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {cardReady && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 grid gap-2 text-sm">
                      <p className="font-medium text-foreground">{t('pricing.card.instantTitle')}</p>
                      <p className="text-muted-foreground text-xs">{t('pricing.card.instantDesc', { amount: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format((copCents ?? 0) / 100) })}</p>
                      <Button size="sm" disabled={cardBusy} onClick={payByCard}>
                        {cardBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                        {t('pricing.card.payNow')}
                      </Button>
                    </div>
                  )}
                  {!cardReady && cardLink && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 grid gap-2 text-sm">
                      <p className="font-medium text-foreground">{t('pricing.card.title')}</p>
                      <p className="text-muted-foreground text-xs">{t('pricing.card.desc')}</p>
                      <Button asChild variant="default" size="sm">
                        <a href={cardLink} target="_blank" rel="noopener noreferrer">{t('pricing.card.cta')}</a>
                      </Button>
                    </div>
                  )}
                  {/* Method explanation — honest, manual-first. */}
                  <div className="rounded-md border p-4 grid gap-2 text-sm">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Landmark className="size-4 text-primary" />
                      {t('pricing.manual.method')}
                    </div>
                    <p className="text-muted-foreground">{t('pricing.manual.methodDesc')}</p>
                    <p className="text-xs text-muted-foreground">{t('pricing.manual.transferDetails')}</p>
                    <p className="text-xs text-muted-foreground">{t('pricing.manual.verifyNote')}</p>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ref">{t('pricing.manual.reference')} <span className="text-muted-foreground">({t('pricing.manual.optional')})</span></Label>
                    <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t('pricing.manual.referencePlaceholder')} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="proofnote">{t('pricing.manual.note')} <span className="text-muted-foreground">({t('pricing.manual.optional')})</span></Label>
                    <Textarea id="proofnote" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('pricing.manual.notePlaceholder')} />
                  </div>
                  {submitError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{submitError}</p>}
                  <Button disabled={busy} onClick={submit}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    {busy ? t('pricing.manual.submitting') : t('pricing.manual.submit')}
                  </Button>
                  {!cardReady && !cardLink && <p className="text-xs text-muted-foreground">{t('pricing.manual.cardComing')}</p>}
                </div>
              )}
            </AuthGate>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** After Wompi sends the employer back (?payment=IT-...), show what happened. */
function CardPaymentStatus() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [ref, setRef] = useState<string | null>(null)
  const [status, setStatus] = useState<'pending' | 'approved' | 'declined' | 'voided' | 'error' | 'unknown'>('pending')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const r = new URLSearchParams(window.location.search).get('payment')
    if (r && /^IT-[a-f0-9]{32}$/.test(r)) setRef(r)
  }, [])
  useEffect(() => {
    if (!ref || !user) return
    let tries = 0
    let timer: number | undefined
    const check = async () => {
      const { data } = await supabase.from('card_payments').select('status').eq('reference', ref).maybeSingle()
      const st = (data as { status?: string } | null)?.status
      if (st && st !== 'pending') { setStatus(st as typeof status); return }
      if (!data && tries > 2) { setStatus('unknown'); return }
      if (++tries < 40) timer = window.setTimeout(check, 3000)
    }
    void check()
    return () => { if (timer) window.clearTimeout(timer) }
  }, [ref, user])
  if (!ref) return null
  const tone = status === 'approved' ? 'border-emerald-500/40 bg-emerald-500/5' : status === 'pending' ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'
  return (
    <div className="mx-auto mb-8 max-w-3xl" role="status">
      <div className={`rounded-lg border p-4 text-sm ${tone}`}>
        <p className="font-medium text-foreground">{t(`pricing.card.result.${status}`)}</p>
        <p className="mt-1 text-muted-foreground">{t(`pricing.card.result.${status}Desc`)}</p>
        {status === 'approved' && (
          <Button asChild size="sm" className="mt-3"><Link to="/employer/post-job">{t('pricing.card.result.postJob')}</Link></Button>
        )}
      </div>
    </div>
  )
}

function PricingPage() {
  const { t } = useI18n(); const { user } = useAuth(); const [unlocked, setUnlocked] = useState(false)
  const [selected, setSelected] = useState<JobPostingPackage | null>(null)
  const [billing, setBilling] = useState<Billing>('monthly')
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => { setUnlocked(!!user || sessionStorage.getItem('impulsa_pricing_lead') === '1') }, [user])
  const openCheckout = (pkg: JobPostingPackage) => { setSelected(pkg); setSheetOpen(true) }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader transparentOnTop={false} />
      <main id="main" className="max-w-5xl mx-auto px-5 py-12">
        <CardPaymentStatus />
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">{t('pricing.kicker')}</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold">{t('pricing.title')}</h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">{t('pricing.subtitle')}</p>
        </div>
        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 rounded-full border bg-muted/40 p-1 text-sm">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${billing === 'monthly' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('pricing.billingMonthly')}
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${billing === 'yearly' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('pricing.billingYearly')}
            </button>
          </div>
        </div>
        {/* Prices are public (they're in the search description too); the
            contact form is an optional "talk to us" below the plans. */}
        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {JOB_PACKAGES.map(pkg => <PlanCard key={pkg.id} id={pkg.id} billing={billing} onBuy={openCheckout} />)}
        </div>
        <CompareTable />
        {!user && (
          <div className="mt-14">
            {unlocked
              ? <p className="text-center text-sm font-medium text-emerald-700">{t('pricing.talkThanks')}</p>
              : <LeadCaptureForm titleKey="pricing.talkTitle" descKey="pricing.talkDesc" submitKey="pricing.talkSubmit" onSuccess={() => setUnlocked(true)} />}
          </div>
        )}
        <CheckoutSheet pkg={selected} billing={billing} open={sheetOpen} onClose={() => setSheetOpen(false)} />
        <p className="mt-8 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
          {t('pricing.footnote')}
        </p>
      </main>
    </div>
  )
}