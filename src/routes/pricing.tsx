import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Check, Sparkles, Landmark, Loader2, CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { useI18n } from '@/i18n/I18nProvider'
import { JOB_PACKAGES, type JobPostingPackage } from '@/lib/pricing'
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
      { title: 'Pricing — Post Jobs on Impulsa Talentos' },
      { name: 'description', content: 'Job posting packages for employers: single post $49, 5-pack $199, featured listing add-on $29.' },
    ],
  }),
})

function PackageCard({ id, onBuy }: { id: string; onBuy: (pkg: JobPostingPackage) => void }) {
  const { t } = useI18n()
  const pkg = JOB_PACKAGES.find(p => p.id === id)!
  const isFeatured = pkg.id === 'featured'
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={isFeatured ? 'md:-mt-3 md:mb-3' : ''}
    >
      <Card className={`h-full flex flex-col hover:shadow-lg transition-shadow ${isFeatured ? 'border-primary/40 bg-gradient-to-b from-primary/5 to-card' : ''}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isFeatured && <Sparkles className="size-4 text-primary" />}
            {t(pkg.nameKey)}
          </CardTitle>
          <CardDescription className="min-h-10">{t(pkg.descKey)}</CardDescription>
          <p className="text-3xl font-bold font-serif mt-1">
            ${pkg.priceUsd}
            <span className="text-sm font-normal text-muted-foreground"> USD</span>
          </p>
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
          <Button onClick={() => onBuy(pkg)} className="w-full" variant={isFeatured ? 'default' : 'outline'}>
            {t('pricing.buy')}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/** Manual-first checkout (Gate 2 pending). Presents the current honest payment
 *  method (bank transfer + proof/reference), records a pending payment order via
 *  submit_manual_payment, and explains that credits are granted once an admin
 *  verifies receipt. Online card (Wompi) is explicitly "being configured" — no
 *  fake live-payment claims. */
function CheckoutSheet({ pkg, open, onClose }: { pkg: JobPostingPackage | null; open: boolean; onClose: () => void }) {
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

  // Reset per-open (so closing then re-opening starts clean).
  useEffect(() => {
    if (open) { setPhase('form'); setReference(''); setNote(''); setSubmitError(''); setSubmittedRef('') }
  }, [open, pkg?.id])

  const isFeatured = pkg?.id === 'featured'

  const submit = async () => {
    if (!pkg || !company) return
    const referenceVal = reference.trim()
    if (!referenceVal) {
      setSubmitError(t('pricing.manual.referenceRequired'))
      return
    }
    setBusy(true)
    setSubmitError('')
    const { data, error } = await supabase.rpc('submit_manual_payment', {
      p_company_id: company.id,
      p_package_id: pkg.id,
      p_amount_usd: pkg.priceUsd,
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
          <SheetTitle>{pkg ? t(pkg.nameKey) : ''} — ${pkg?.priceUsd ?? ''} USD</SheetTitle>
          <SheetDescription>{pkg ? t(pkg.descKey) : ''}</SheetDescription>
        </SheetHeader>
        <div className="mt-5">
          {!pkg ? null : isFeatured ? (
            // Featured placement is a placement feature, not a posting credit — the
            // marking mechanism rides the Gate-2 wiring. Honest: do not imply we can
            // deliver it yet.
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              {t('pricing.manual.featuredNote')}
            </div>
          ) : (
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
                    <Label htmlFor="ref">{t('pricing.manual.reference')}</Label>
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
                  <p className="text-xs text-muted-foreground">{t('pricing.manual.cardComing')}</p>
                </div>
              )}
            </AuthGate>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function PricingPage() {
  const { t } = useI18n(); const { user } = useAuth(); const [unlocked, setUnlocked] = useState(false)
  const [selected, setSelected] = useState<JobPostingPackage | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => { setUnlocked(!!user || sessionStorage.getItem('impulsa_pricing_lead') === '1') }, [user])
  const openCheckout = (pkg: JobPostingPackage) => { setSelected(pkg); setSheetOpen(true) }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader transparentOnTop={false} />
      <main id="main" className="max-w-5xl mx-auto px-5 py-12">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('pricing.kicker')}</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold">{t('pricing.title')}</h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">{t('pricing.subtitle')}</p>
        </div>
        {!unlocked ? <LeadCaptureForm onSuccess={() => setUnlocked(true)} /> : <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {JOB_PACKAGES.map(pkg => <PackageCard key={pkg.id} id={pkg.id} onBuy={openCheckout} />)}
        </div>}
        <CheckoutSheet pkg={selected} open={sheetOpen} onClose={() => setSheetOpen(false)} />
        <p className="mt-8 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
          {t('pricing.footnote')}
        </p>
      </main>
    </div>
  )
}
