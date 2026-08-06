import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import {
  Building2,
  PlusCircle,
  ChevronRight,
  ArrowLeft,
  Mail,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany, useCreateCompany, useUpdateCompany } from '@/hooks/useCompanies'
import { useCreateJob } from '@/hooks/useJobs'
import { useI18n } from '@/i18n/I18nProvider'
import { RichTextEditor } from '@/components/RichTextEditor'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import {
  LOCATION_TYPES,
  LOCATION_TYPE_KEYS,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_KEYS,
} from '@/lib/jobEnums'
import { CANONICAL_INDUSTRIES, industryLabelKey, matchIndustry } from '@/lib/industries'
import { useBlocker } from '@tanstack/react-router'
import { toast } from 'sonner'

export const Route = createFileRoute('/m/post')({
  head: () => ({ meta: [{ title: 'Post a job — Impulsa (mobile)' }] }),
  component: MobilePost,
})

type Step = 'company' | 'job' | 'done'

const CURRENCY_OPTIONS = ['COP', 'USD', 'EUR', 'MXN', 'ARS', 'BRL', 'GBP']

const EMPTY_COMPANY = {
  name: '',
  industry: '',
  size: '',
  location: '',
  website: '',
  contactEmail: '',
  description: '',
}

const EMPTY_JOB = {
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

function MobilePost() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: existingCompany, isLoading: companyLoading } = useCompany(user?.id)
  const { t } = useI18n()
  const navigate = useNavigate()
  const createCompany = useCreateCompany()
  const createJob = useCreateJob()
  const updateCompany = useUpdateCompany()

  const [step, setStep] = useState<Step>('company')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY)
  const [jobForm, setJobForm] = useState(EMPTY_JOB)
  const [companyEditing, setCompanyEditing] = useState(false)

  const updateCompany_ = (k: keyof typeof EMPTY_COMPANY, v: string) =>
    setCompanyForm(p => ({ ...p, [k]: v }))
  const updateJob = (k: keyof typeof EMPTY_JOB, v: string) =>
    setJobForm(p => ({ ...p, [k]: v }))

  // If a company already exists, skip the company step.
  if (
    !companyLoading &&
    existingCompany &&
    !companyId &&
    step === 'company' &&
    !companyEditing
  ) {
    setCompanyId(existingCompany.id)
    setCompanyForm({
      name: existingCompany.name,
      industry: matchIndustry(existingCompany.industry) ?? '',
      size: existingCompany.size || '',
      location: existingCompany.location || '',
      website: existingCompany.website || '',
      contactEmail: existingCompany.contactEmail || '',
      description: existingCompany.description || '',
    })
    setStep('job')
  }

  if (!user) {
    return (
      <div className="px-4 pt-12 text-center">
        <p className="text-sm font-semibold text-foreground">{t('mobile.authRequired')}</p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link to="/m/profile" search={{ apply: undefined }}>{t('mobile.authRequiredCta')}</Link>
        </Button>
      </div>
    )
  }

  if (profile?.role !== 'employer') {
    return (
      <div className="px-4 pt-12 text-center">
        <p className="text-sm font-semibold text-foreground">
          {t('postJob.step1.title')}
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('profile.role.employerDesc')}
        </p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link to="/m/profile" search={{ apply: undefined }}>{t('profile.create')}</Link>
        </Button>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="px-4 pt-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <p className="text-base font-bold text-foreground">{t('postJob.success.title')}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('postJob.success.desc')}
        </p>
        <div className="mt-6 space-y-2">
          <Button asChild size="lg" className="w-full h-12 font-semibold">
            <Link to="/m/home">{t('postJob.success.dashboard')}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 font-semibold"
            onClick={() => {
              setJobForm(EMPTY_JOB)
              setStep('job')
            }}
          >
            {t('postJob.success.another')}
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'company' && !companyId) {
    return (
      <div className="px-4 pt-4 pb-24 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/m/home' })}
            className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('postJob.step1.kicker')}
            </p>
            <p className="text-base font-bold text-foreground">
              {t('postJob.step1.title')}
            </p>
          </div>
        </div>
        <FadeIn>
          <Card>
            <CardContent className="pt-5 space-y-3">
              <Field label={t('postJob.company.name')} required>
                <Input
                  value={companyForm.name}
                  onChange={e => updateCompany_('name', e.target.value)}
                  placeholder={t('postJob.company.namePlaceholder')}
                  className="h-11"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('postJob.company.industry')}>
                  <select
                    value={companyForm.industry}
                    onChange={e => updateCompany_('industry', e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">{t('postJob.company.industryPlaceholder')}</option>
                    {CANONICAL_INDUSTRIES.map(c => {
                      const key = industryLabelKey(c)
                      return <option key={c} value={c}>{key ? t(key) : c}</option>
                    })}
                  </select>
                </Field>
                <Field label={t('postJob.company.size')}>
                  <select
                    value={companyForm.size}
                    onChange={e => updateCompany_('size', e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">—</option>
                    {['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={t('postJob.company.location')}>
                <Input
                  value={companyForm.location}
                  onChange={e => updateCompany_('location', e.target.value)}
                  placeholder={t('postJob.company.locationPlaceholder')}
                  className="h-11"
                />
              </Field>
              <Field label={t('postJob.company.contactEmail')} required>
                <Input
                  type="email"
                  required
                  value={companyForm.contactEmail}
                  onChange={e => updateCompany_('contactEmail', e.target.value)}
                  placeholder={t('postJob.company.contactEmailPlaceholder')}
                  className="h-11"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('postJob.company.contactEmailHint')}
                </p>
              </Field>
              <Field label={t('postJob.company.description')}>
                <textarea
                  value={companyForm.description}
                  onChange={e => updateCompany_('description', e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-y"
                />
              </Field>
            </CardContent>
          </Card>
        </FadeIn>
        <Button
          size="lg"
          onClick={async () => {
            if (!companyForm.name.trim()) {
              toast.error(t('postJob.company.nameRequired'))
              return
            }
            const contactEmail = companyForm.contactEmail.trim()
            if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
              toast.error(t('postJob.company.contactEmailRequired'))
              return
            }
            try {
              const created = await createCompany.mutateAsync({
                employerId: user.id,
                ...companyForm,
                contactEmail,
                logoUrl: '',
              })
              setCompanyId(created.id)
              setStep('job')
            } catch (err) {
              toast.error(t('postJob.company.createError'), {
                description: err instanceof Error ? err.message : '',
              })
            }
          }}
          disabled={createCompany.isPending}
          className="w-full h-12 font-semibold gap-2"
        >
          {createCompany.isPending ? t('common.loading') : t('common.continue')}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    )
  }

  // Step: job posting
  return (
    <div className="px-4 pt-4 pb-24 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => navigate({ to: '/m/home' })}
          className="h-9 w-9 -ml-1 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('postJob.step2.kicker')}
          </p>
          <p className="text-base font-bold text-foreground">{t('postJob.step2.title')}</p>
        </div>
      </div>
      <FadeIn>
        <Card>
          <CardContent className="pt-5 space-y-3">
            <Field label={t('postJob.job.title')} required>
              <Input
                value={jobForm.title}
                onChange={e => updateJob('title', e.target.value)}
                placeholder={t('postJob.job.titlePlaceholder')}
                className="h-11"
              />
            </Field>
            <Field label={t('postJob.job.description')} required>
              <RichTextEditor
                value={jobForm.description}
                onChange={v => updateJob('description', v)}
                placeholder={t('postJob.job.descriptionPlaceholder')}
                rows={6}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('postJob.job.level')}>
                <select
                  value={jobForm.level}
                  onChange={e => updateJob('level', e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {['Junior', 'Junior-Mid', 'Mid', 'Mid-Senior', 'Senior', 'Lead'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('postJob.job.modality')}>
                <select
                  value={jobForm.locationType}
                  onChange={e => updateJob('locationType', e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {LOCATION_TYPES.map(lt => (
                    <option key={lt} value={lt}>{t(LOCATION_TYPE_KEYS[lt])}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t('postJob.job.salaryMin')}>
                <Input
                  type="number"
                  value={jobForm.salaryMin}
                  onChange={e => updateJob('salaryMin', e.target.value)}
                  placeholder="5000000"
                  className="h-11"
                />
              </Field>
              <Field label={t('postJob.job.salaryMax')}>
                <Input
                  type="number"
                  value={jobForm.salaryMax}
                  onChange={e => updateJob('salaryMax', e.target.value)}
                  placeholder="12000000"
                  className="h-11"
                />
              </Field>
              <Field label={t('postJob.job.currency')}>
                <select
                  value={jobForm.currency}
                  onChange={e => updateJob('currency', e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CURRENCY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t('postJob.job.skills')}>
              <Input
                value={jobForm.skillsRequired}
                onChange={e => updateJob('skillsRequired', e.target.value)}
                placeholder={t('postJob.job.skillsPlaceholder')}
                className="h-11"
              />
            </Field>
            <Field label={t('postJob.job.languages')}>
              <select
                value={jobForm.languagesRequired}
                onChange={e => updateJob('languagesRequired', e.target.value)}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {LANGUAGE_LEVELS.map(l => (
                  <option key={l} value={l}>{t(LANGUAGE_LEVEL_KEYS[l])}</option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>
      </FadeIn>
      <div className="grid grid-cols-1 gap-2">
        <Button
          size="lg"
          onClick={async () => {
            if (!companyId) return
            if (!jobForm.title.trim() || !jobForm.description.trim()) {
              toast.error(t('postJob.job.requiredFields'))
              return
            }
            // Verification gate: unverified companies cannot publish jobs.
            if (existingCompany && !existingCompany.verified) {
              toast.error(
                existingCompany.verificationRequested
                  ? t('verification.pendingPublishTitle')
                  : t('verification.unverifiedPublishTitle'),
                {
                  description: existingCompany.verificationRequested
                    ? t('verification.pendingPublishDesc')
                    : t('verification.unverifiedPublishDesc'),
                },
              )
              return
            }
            try {
              const salaryMin = jobForm.salaryMin ? Number(jobForm.salaryMin) : 0
              const salaryMax = jobForm.salaryMax ? Number(jobForm.salaryMax) : 0
              await createJob.mutateAsync({
                companyId,
                title: jobForm.title,
                description: jobForm.description,
                level: jobForm.level,
                locationType: jobForm.locationType,
                salaryMin: Number.isFinite(salaryMin) ? salaryMin : 0,
                salaryMax: Number.isFinite(salaryMax) ? salaryMax : 0,
                currency: jobForm.currency,
                skillsRequired: jobForm.skillsRequired,
                languagesRequired: jobForm.languagesRequired,
                status: 'open',
              })
              setStep('done')
              toast.success(t('postJob.job.success'))
            } catch (err) {
              toast.error(t('postJob.job.error'), {
                description: err instanceof Error ? err.message : '',
              })
            }
          }}
          disabled={createJob.isPending}
          className="w-full h-12 font-semibold gap-2"
        >
          <Send className="size-4" />
          {createJob.isPending ? t('postJob.job.publishing') : t('postJob.job.publish')}
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={async () => {
            if (!companyId || !jobForm.title.trim()) {
              toast.error(t('postJob.job.requiredFields'))
              return
            }
            try {
              await createJob.mutateAsync({
                companyId,
                title: jobForm.title,
                description: jobForm.description,
                level: jobForm.level,
                locationType: jobForm.locationType,
                salaryMin: 0,
                salaryMax: 0,
                currency: jobForm.currency,
                skillsRequired: jobForm.skillsRequired,
                languagesRequired: jobForm.languagesRequired,
                status: 'draft',
              })
              toast.success(t('postJob.job.savedAsDraft'))
              navigate({ to: '/m/home' })
            } catch (err) {
              toast.error(t('postJob.job.error'), {
                description: err instanceof Error ? err.message : '',
              })
            }
          }}
          disabled={createJob.isPending}
          className="w-full h-12 font-semibold gap-2"
        >
          <Save className="size-4" />
          {t('postJob.job.saveAsDraft')}
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: ReactNode
  required?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive ml-0.5">*</span> : null}
      </Label>
      {children}
    </div>
  )
}

function FadeIn({ children }: { children: ReactNode }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}
