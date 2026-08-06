import { createFileRoute, Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthGate } from '@/components/AuthGate'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany, useCreateCompany, useUpdateCompany } from '@/hooks/useCompanies'
import { useCreateJob } from '@/hooks/useJobs'
import { supabase } from '@/lib/supabase'
import { NEW_COMPANY_TRIAL_CREDITS, CREDITS_PER_POSTING } from '@/lib/pricing'
import { useI18n } from '@/i18n/I18nProvider'
import { RichTextEditor } from '@/components/RichTextEditor'
import {
  LOCATION_TYPES,
  LOCATION_TYPE_KEYS,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_KEYS,
} from '@/lib/jobEnums'
import { CANONICAL_INDUSTRIES, industryLabelKey } from '@/lib/industries'
import {
  PlusCircle,
  Send,
  Building2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Mail,
  Save,
  Sparkles,
} from 'lucide-react'

export const Route = createFileRoute('/_app/employer/post-job')({
  component: PostJobPage,
})

function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

type Step = 'company' | 'job' | 'done'

const EMPTY_FORM = {
  title: '',
  description: '',
  level: 'Mid',
  locationType: 'Remote',
  salaryMin: '',
  salaryMax: '',
  currency: 'COP',
  skillsRequired: '',
  languagesRequired: 'English B2+',
}

const CURRENCY_OPTIONS = [
  { value: 'COP', label: 'COP — Colombian Peso' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'MXN', label: 'MXN — Mexican Peso' },
  { value: 'ARS', label: 'ARS — Argentine Peso' },
  { value: 'BRL', label: 'BRL — Brazilian Real' },
  { value: 'GBP', label: 'GBP — British Pound' },
]

const EMPTY_COMPANY = {
  name: '',
  industry: '',
  size: '',
  location: '',
  website: '',
  contactEmail: '',
  description: '',
}

function PostJobPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const navigate = useNavigate()
  useEffect(() => {
    if (profile && profile.role !== 'employer') navigate({ to: '/dashboard', replace: true })
  }, [profile, navigate])
  const { data: existingCompany, isLoading: companyLoading } = useCompany(user?.id)
  const { t } = useI18n()

  const createCompany = useCreateCompany()
  const createJob = useCreateJob()
  const saveCompany = useUpdateCompany() // kept for hook order; unused — credits now decremented via RPC

  const [step, setStep] = useState<Step>('company')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY)
  const [form, setForm] = useState(EMPTY_FORM)
  const [dirty, setDirty] = useState(false)
  const [companyErrors, setCompanyErrors] = useState<{ name?: string; contactEmail?: string }>({})
  const [jobErrors, setJobErrors] = useState<{ title?: string; description?: string; salary?: string }>({})

  const updateCompany = (field: string, value: string) => {
    setDirty(true)
    setCompanyForm(prev => ({ ...prev, [field]: value }))
    if (field === 'name') setCompanyErrors(prev => ({ ...prev, name: undefined }))
    if (field === 'contactEmail') setCompanyErrors(prev => ({ ...prev, contactEmail: undefined }))
  }
  const update = (field: string, value: string) => {
    setDirty(true)
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'title') setJobErrors(prev => ({ ...prev, title: undefined }))
    if (field === 'description') setJobErrors(prev => ({ ...prev, description: undefined }))
    if (field === 'salaryMin' || field === 'salaryMax') setJobErrors(prev => ({ ...prev, salary: undefined }))
  }

  const blocker = useBlocker(
    { shouldBlockFn: () => true, enableBeforeUnload: true, withResolver: true },
    dirty && step !== 'done',
  )

  useEffect(() => {
    if (step === 'company' && !companyLoading && existingCompany && !companyId) {
      setCompanyId(existingCompany.id)
      setStep('job')
    }
  }, [step, companyLoading, existingCompany, companyId])

  const handleCreateCompany = async () => {
    if (!user) return
    const nextErrors: { name?: string; contactEmail?: string } = {}
    if (!companyForm.name.trim()) nextErrors.name = t('postJob.company.nameRequired')
    // The application-inbox email is the ONLY way the platform can
    // notify the employer about new candidates — make it required.
    const contactEmail = companyForm.contactEmail.trim()
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      nextErrors.contactEmail = t('postJob.company.contactEmailRequired')
    }
    if (nextErrors.name || nextErrors.contactEmail) {
      setCompanyErrors(nextErrors)
      const first = document.getElementById(nextErrors.name ? 'company-name' : 'contactEmail')
      first?.focus()
      return
    }
    try {
      const created = await createCompany.mutateAsync({
        employerId: user.id,
        ...companyForm,
        contactEmail,
        logoUrl: '',
        // Monetization: every new company starts with free trial credits so
        // the marketplace is usable before Stripe goes live.
        jobCredits: NEW_COMPANY_TRIAL_CREDITS,
      })
      setCompanyId(created.id)
      setStep('job')
      toast.success(t('postJob.company.createSuccess'), { description: created.name })
    } catch (err) {
      toast.error(t('postJob.company.createError'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  const handleCreateJob = async (status: 'open' | 'draft' = 'open') => {
    if (!companyId) return
    const nextErrors: { title?: string; description?: string; salary?: string } = {}
    if (!form.title.trim()) nextErrors.title = t('postJob.job.titleRequired')
    if (status === 'open' && !form.description.trim()) {
      nextErrors.description = t('postJob.job.descriptionRequired')
    }
    const salaryMin = form.salaryMin ? Number(form.salaryMin) : 0
    const salaryMax = form.salaryMax ? Number(form.salaryMax) : 0
    if (salaryMin > 0 && salaryMax > 0 && salaryMax < salaryMin) {
      nextErrors.salary = t('postJob.job.salaryRangeError')
    }
    if (nextErrors.title || nextErrors.description || nextErrors.salary) {
      setJobErrors(nextErrors)
      const first = document.getElementById(nextErrors.title ? 'title' : nextErrors.description ? 'description' : 'salaryMin')
      first?.focus()
      return
    }
    try {
      if (salaryMin > 0 && salaryMax > 0 && salaryMax < salaryMin) {
        toast.error(t('postJob.job.salaryRangeError'))
        return
      }
      await createJob.mutateAsync({
        companyId,
        title: form.title || 'Untitled draft',
        description: form.description,
        level: form.level,
        locationType: form.locationType,
        salaryMin: Number.isFinite(salaryMin) ? salaryMin : 0,
        salaryMax: Number.isFinite(salaryMax) ? salaryMax : 0,
        currency: form.currency,
        skillsRequired: form.skillsRequired,
        languagesRequired: form.languagesRequired,
        status,
      })
      setDirty(false)
      // Consume one credit for every OPEN posting (drafts are free).
      // Uses atomic server-side decrement (migration 013) to avoid the
      // stale-write race that happens with client-side math.
      if (status === 'open' && existingCompany) {
        await supabase
          .rpc('decrement_company_credits', { company_id: existingCompany.id })
          .then(() => { /* credit consumed */ })
          .catch(() => { /* best-effort: don't block job creation */ })
      }
      setStep(status === 'draft' ? 'company' : 'done')
      if (status === 'draft') {
        toast.success(t('postJob.job.savedAsDraft'), {
          description: t('postJob.job.savedAsDraftDesc'),
        })
        // Reset only the job fields; keep the company context.
        setForm({ ...EMPTY_FORM, currency: form.currency })
      } else {
        toast.success(t('postJob.job.success'), {
          description: t('postJob.job.successDesc'),
        })
      }
    } catch (err) {
      toast.error(t('postJob.job.error'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  const reset = () => {
    setForm(EMPTY_FORM)
    setStep(existingCompany ? 'job' : 'company')
    setCompanyId(existingCompany?.id ?? null)
  }

  /* ── Step: company info ─────────────────────────────── */
  if (step === 'company') {
    return (
      <AuthGate
        fallbackKey="auth.fallback.postJob"
        fallbackDescKey="auth.fallback.postJobDesc"
      >
        <div className="p-6 max-w-3xl mx-auto">
          <FadeIn>
            <div className="mb-8">
              <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('postJob.step1.kicker')}</p>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Building2 className="size-7 text-primary" />
                {t('postJob.step1.title')}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {t('postJob.step1.subtitle')}
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('postJob.company.dataCardTitle')}</CardTitle>
                <CardDescription>{t('postJob.company.dataCardDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">{t('postJob.company.name')}</Label>
                  <Input
                    id="company-name"
                    value={companyForm.name}
                    onChange={e => updateCompany('name', e.target.value)}
                    placeholder={t('postJob.company.namePlaceholder')}
                    aria-invalid={!!companyErrors.name}
                    aria-describedby={companyErrors.name ? 'company-name-error' : undefined}
                  />
                  {companyErrors.name && (
                    <p id="company-name-error" role="alert" className="text-xs text-destructive">
                      {companyErrors.name}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="industry">{t('postJob.company.industry')}</Label>
                    <select
                      id="industry"
                      value={companyForm.industry}
                      onChange={e => updateCompany('industry', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                    >
                      <option value="">{t('postJob.company.industryPlaceholder')}</option>
                      {CANONICAL_INDUSTRIES.map(c => {
                        const key = industryLabelKey(c)
                        return (
                          <option key={c} value={c}>{key ? t(key) : c}</option>
                        )
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="size">{t('postJob.company.size')}</Label>
                    <select
                      id="size"
                      value={companyForm.size}
                      onChange={e => updateCompany('size', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                    >
                      <option value="">{t('postJob.company.sizePlaceholder')}</option>
                      {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-location">{t('postJob.company.location')}</Label>
                    <Input
                      id="company-location"
                      value={companyForm.location}
                      onChange={e => updateCompany('location', e.target.value)}
                      placeholder={t('postJob.company.locationPlaceholder')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">{t('postJob.company.website')}</Label>
                    <Input
                      id="website"
                      value={companyForm.website}
                      onChange={e => updateCompany('website', e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {t('postJob.company.contactEmail')}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    required
                    value={companyForm.contactEmail}
                    onChange={e => updateCompany('contactEmail', e.target.value)}
                    placeholder={t('postJob.company.contactEmailPlaceholder')}
                    aria-invalid={!!companyErrors.contactEmail}
                    aria-describedby={companyErrors.contactEmail ? 'contactEmail-error' : undefined}
                  />
                  {companyErrors.contactEmail && (
                    <p id="contactEmail-error" role="alert" className="text-xs text-destructive">
                      {companyErrors.contactEmail}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t('postJob.company.contactEmailHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company-description">{t('postJob.company.description')}</Label>
                  <textarea
                    id="company-description"
                    value={companyForm.description}
                    onChange={e => updateCompany('description', e.target.value)}
                    placeholder={t('postJob.company.descriptionPlaceholder')}
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-y"
                  />
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-6 flex items-center gap-3">
              <Button
                onClick={handleCreateCompany}
                size="lg"
                disabled={createCompany.isPending}
                className="gap-2 font-medium px-8"
              >
                {createCompany.isPending ? t('common.loading') : t('common.continue')}
                <ChevronRight className="size-4" />
              </Button>
              {profile?.role !== 'employer' && (
                <p className="text-xs text-muted-foreground">
                  {t('postJob.profileHint')}
                </p>
              )}
            </div>
          </FadeIn>
        </div>
        <UnsavedChangesDialog
          open={blocker.status === 'blocked'}
          title={t('form.unsaved.title')}
          description={t('form.unsaved.desc')}
          confirmLabel={t('form.unsaved.leave')}
          cancelLabel={t('form.unsaved.stay')}
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      </AuthGate>
    )
  }

  /* ── Step: job posting ─────────────────────────────── */
  if (step === 'job') {
    // Monetization gate: an open posting consumes one credit. Companies with
    // no credits see the pricing page instead of the form (drafts stay free
    // but the gate keeps the flow simple — see handleCreateJob).
    const credits = existingCompany?.jobCredits ?? (companyId ? NEW_COMPANY_TRIAL_CREDITS : 0)

    if (credits < CREDITS_PER_POSTING) {
      return (
        <AuthGate>
          <div className="p-6 max-w-3xl mx-auto">
            <FadeIn>
              <div className="mb-8">
                <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('postJob.step2.kicker')}</p>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                  <PlusCircle className="size-7 text-primary" />
                  {t('postJob.step2.title')}
                </h1>
              </div>
            </FadeIn>
            <FadeIn delay={0.05}>
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 mb-3">
                    <AlertCircle className="size-6 text-amber-600" />
                  </div>
                  <p className="font-medium text-foreground">{t('postJob.credits.title')}</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{t('postJob.credits.desc')}</p>
                  <Button asChild className="mt-5">
                    <Link to="/pricing">{t('postJob.credits.cta')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </AuthGate>
      )
    }

    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto">
          <FadeIn>
            <div className="mb-8">
              <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('postJob.step2.kicker')}</p>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <PlusCircle className="size-7 text-primary" />
                {t('postJob.step2.title')}
              </h1>
              <p className="mt-1 text-muted-foreground">
                {t('postJob.step2.subtitle')}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                <Sparkles className="size-3" />
                {t('postJob.creditsRemaining', { n: String(credits) })}
              </span>
            </div>
          </FadeIn>

          <FadeIn delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('postJob.job.detailsCardTitle')}</CardTitle>
                <CardDescription>{t('postJob.job.detailsCardDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">{t('postJob.job.title')}</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                    placeholder={t('postJob.job.titlePlaceholder')}
                    aria-invalid={!!jobErrors.title}
                    aria-describedby={jobErrors.title ? 'title-error' : undefined}
                  />
                  {jobErrors.title && (
                    <p id="title-error" role="alert" className="text-xs text-destructive">
                      {jobErrors.title}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('postJob.job.description')}</Label>
                  <RichTextEditor
                    id="description"
                    ariaLabel={t('postJob.job.description')}
                    value={form.description}
                    onChange={v => update('description', v)}
                    placeholder={t('postJob.job.descriptionPlaceholder')}
                    rows={8}
                  />
                  {jobErrors.description && (
                    <p id="description-error" role="alert" className="text-xs text-destructive">
                      {jobErrors.description}
                    </p>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="level">{t('postJob.job.level')}</Label>
                    <select
                      id="level"
                      value={form.level}
                      onChange={e => update('level', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                    >
                      {['Junior', 'Junior-Mid', 'Mid', 'Mid-Senior', 'Senior', 'Lead'].map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationType">{t('postJob.job.modality')}</Label>
                    <select
                      id="locationType"
                      value={form.locationType}
                      onChange={e => update('locationType', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                    >
                      {LOCATION_TYPES.map(lt => (
                        <option key={lt} value={lt}>{t(LOCATION_TYPE_KEYS[lt])}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="salaryMin">{t('postJob.job.salaryMin')}</Label>
                    <Input
                      id="salaryMin"
                      type="number"
                      value={form.salaryMin}
                      onChange={e => update('salaryMin', e.target.value)}
                      placeholder="5000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salaryMax">{t('postJob.job.salaryMax')}</Label>
                    <Input
                      id="salaryMax"
                      type="number"
                      value={form.salaryMax}
                      onChange={e => update('salaryMax', e.target.value)}
                      placeholder="12000000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">{t('postJob.job.currency')}</Label>
                    <select
                      id="currency"
                      value={form.currency}
                      onChange={e => update('currency', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                    >
                      {CURRENCY_OPTIONS.map(c => (
                        <option key={c.value} value={c.value}>
                          {c.value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {jobErrors.salary && (
                  <p id="salary-error" role="alert" className="text-xs text-destructive">
                    {jobErrors.salary}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="skillsRequired">{t('postJob.job.skills')}</Label>
                  <Input
                    id="skillsRequired"
                    value={form.skillsRequired}
                    onChange={e => update('skillsRequired', e.target.value)}
                    placeholder={t('postJob.job.skillsPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">{t('postJob.job.skillsHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="languagesRequired">{t('postJob.job.languages')}</Label>
                  <select
                    id="languagesRequired"
                    value={form.languagesRequired}
                    onChange={e => update('languagesRequired', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                  >
                    {LANGUAGE_LEVELS.map(l => (
                      <option key={l} value={l}>{t(LANGUAGE_LEVEL_KEYS[l])}</option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => handleCreateJob('open')}
                size="lg"
                disabled={createJob.isPending}
                className="gap-2 font-medium px-8"
              >
                <Send className="size-4" />
                {createJob.isPending ? t('postJob.job.publishing') : t('postJob.job.publish')}
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={createJob.isPending}
                onClick={() => handleCreateJob('draft')}
                className="gap-2"
              >
                <Save className="size-4" />
                {t('postJob.job.saveAsDraft')}
              </Button>
              {!existingCompany && (
                <Button
                  variant="ghost"
                  onClick={() => setStep('company')}
                  size="lg"
                >
                  {t('common.back')}
                </Button>
              )}
            </div>
          </FadeIn>
        </div>
        <UnsavedChangesDialog
          open={blocker.status === 'blocked'}
          title={t('form.unsaved.title')}
          description={t('form.unsaved.desc')}
          confirmLabel={t('form.unsaved.leave')}
          cancelLabel={t('form.unsaved.stay')}
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      </AuthGate>
    )
  }

  /* ── Step: success ─────────────────────────────────── */
  return (
    <AuthGate>
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <FadeIn>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-6">
            <CheckCircle2 className="size-8 text-primary" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground mb-2">{t('postJob.success.title')}</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t('postJob.success.desc')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="outline" size="lg">
              {t('postJob.success.another')}
            </Button>
            <Button asChild size="lg">
              <Link to="/dashboard">{t('postJob.success.dashboard')}</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </AuthGate>
  )
}
