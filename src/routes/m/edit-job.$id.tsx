import { createFileRoute, Link, useBlocker, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Save } from 'lucide-react'
import { AuthGate } from '@/components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { RichTextEditor } from '@/components/RichTextEditor'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useJob, useUpdateJob } from '@/hooks/useJobs'
import { useI18n } from '@/i18n/I18nProvider'
import {
  LOCATION_TYPES,
  LOCATION_TYPE_KEYS,
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_KEYS,
  parseLocationType,
  buildLocationType,
  normalizeLanguageToken,
  type LocationType,
} from '@/lib/jobEnums'

export const Route = createFileRoute('/m/edit-job/$id')({ component: MobileEditJob })

const CURRENCY_OPTIONS = ['COP', 'USD', 'EUR', 'MXN', 'ARS', 'BRL', 'GBP']
const LEVEL_OPTIONS = ['Junior', 'Junior-Mid', 'Mid', 'Mid-Senior', 'Senior', 'Lead']
const STATUS_OPTIONS = ['open', 'closed', 'draft'] as const

interface JobForm {
  title: string
  description: string
  level: string
  locationType: string
  city: string
  salaryMin: string
  salaryMax: string
  currency: string
  skillsRequired: string
  languagesRequired: string
  status: (typeof STATUS_OPTIONS)[number]
}

const EMPTY_FORM: JobForm = {
  title: '',
  description: '',
  level: 'Mid',
  locationType: 'Remote',
  city: '',
  salaryMin: '',
  salaryMax: '',
  currency: 'COP',
  skillsRequired: '',
  languagesRequired: 'English B2+',
  status: 'open',
}

const selectCls = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm'

function MobileEditJob() {
  const { id } = useParams({ from: '/m/edit-job/$id' })
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const { data: company } = useCompany(user?.id)
  const { data: job, isLoading, isError } = useJob(id)
  const updateJob = useUpdateJob()
  const navigate = useNavigate()
  const { t } = useI18n()

  const [form, setForm] = useState<JobForm>(EMPTY_FORM)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const dirty = useMemo(() => snapshot !== null && JSON.stringify(form) !== snapshot, [form, snapshot])

  // Role + ownership guards (mirror desktop edit-job).
  useEffect(() => {
    if (profileLoading || isLoading) return
    if (!profile || (profile.role !== 'employer' && profile.role !== 'admin')) {
      navigate({ to: '/m/home', replace: true })
      return
    }
    if (job && company && job.companyId !== company.id) {
      navigate({ to: '/m/home', replace: true })
    }
  }, [profileLoading, isLoading, profile, company, job, navigate])

  // Prefill once the job resolves. Legacy values normalize to canonical options.
  useEffect(() => {
    if (!job) return
    const parsed = parseLocationType(job.locationType)
    const rawLang = job.languagesRequired || ''
    const lang = normalizeLanguageToken(rawLang) ??
      (LANGUAGE_LEVELS.includes(rawLang as (typeof LANGUAGE_LEVELS)[number]) ? rawLang : 'English B2+')
    const next: JobForm = {
      title: job.title ?? '',
      description: job.description ?? '',
      level: job.level || 'Mid',
      locationType:
        parsed?.modality ??
        (LOCATION_TYPES.includes(job.locationType as (typeof LOCATION_TYPES)[number])
          ? job.locationType
          : 'Remote'),
      city: parsed?.city ?? '',
      salaryMin: job.salaryMin ? String(job.salaryMin) : '',
      salaryMax: job.salaryMax ? String(job.salaryMax) : '',
      currency: job.currency || 'COP',
      skillsRequired: job.skillsRequired ?? '',
      languagesRequired: lang,
      status: job.status || 'open',
    }
    setForm(next)
    setSnapshot(JSON.stringify(next))
  }, [job])

  const blocker = useBlocker(
    { shouldBlockFn: () => true, enableBeforeUnload: true, withResolver: true },
    dirty,
  )

  const update = (key: keyof JobForm, value: string) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    const salaryMin = form.salaryMin ? Number(form.salaryMin) : 0
    const salaryMax = form.salaryMax ? Number(form.salaryMax) : 0
    try {
      await updateJob.mutateAsync({
        id,
        data: {
          title: form.title.trim(),
          description: form.description,
          level: form.level,
          locationType: buildLocationType(form.locationType as LocationType, form.city.trim() || undefined),
          salaryMin: Number.isFinite(salaryMin) ? salaryMin : 0,
          salaryMax: Number.isFinite(salaryMax) ? salaryMax : 0,
          currency: form.currency,
          skillsRequired: form.skillsRequired,
          languagesRequired: form.languagesRequired,
          status: form.status,
        },
      })
      setSnapshot(JSON.stringify(form))
      toast.success(t('dashboard.jobUpdated'))
      navigate({ to: '/m/home' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('mobile.errorTitle'))
    }
  }

  if (isLoading || (job && !snapshot)) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <div className="h-8 w-40 rounded bg-muted animate-pulse" />
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="px-4 pt-12 text-center">
        <p className="text-sm font-semibold text-foreground">{t('editJob.notFound')}</p>
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link to="/m/home">{t('common.back')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc">
      <div className="px-4 pt-4 pb-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button asChild size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={t('common.back')}>
            <Link to="/m/home"><ArrowLeft className="size-4" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-bold truncate">{t('editJob.title')}</h1>
            <p className="text-[11px] text-muted-foreground truncate">{job.title}</p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t('postJob.job.title')}</Label>
              <Input id="title" value={form.title} onChange={e => update('title', e.target.value)} className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('postJob.job.description')}</Label>
              <RichTextEditor value={form.description} onChange={v => update('description', v)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="level">{t('postJob.job.level')}</Label>
                <select id="level" value={form.level} onChange={e => update('level', e.target.value)} className={selectCls}>
                  {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">{t('dashboard.jobStatus.status')}</Label>
                <select id="status" value={form.status} onChange={e => update('status', e.target.value)} className={selectCls}>
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{t(`dashboard.jobStatus.${s}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="locationType">{t('postJob.job.modality')}</Label>
                <select id="locationType" value={form.locationType} onChange={e => update('locationType', e.target.value)} className={selectCls}>
                  {LOCATION_TYPES.map(lt => (
                    <option key={lt} value={lt}>{t(LOCATION_TYPE_KEYS[lt])}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">{t('postJob.job.city')}</Label>
                <Input id="city" value={form.city} onChange={e => update('city', e.target.value)} placeholder="Medellín" className="h-11" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="salaryMin">{t('postJob.job.salaryMin')}</Label>
                <Input id="salaryMin" type="number" value={form.salaryMin} onChange={e => update('salaryMin', e.target.value)} placeholder="5000000" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salaryMax">{t('postJob.job.salaryMax')}</Label>
                <Input id="salaryMax" type="number" value={form.salaryMax} onChange={e => update('salaryMax', e.target.value)} placeholder="12000000" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">{t('postJob.job.currency')}</Label>
                <select id="currency" value={form.currency} onChange={e => update('currency', e.target.value)} className={selectCls}>
                  {CURRENCY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skillsRequired">{t('postJob.job.skills')}</Label>
              <Input id="skillsRequired" value={form.skillsRequired} onChange={e => update('skillsRequired', e.target.value)} placeholder={t('postJob.job.skillsPlaceholder')} className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="languagesRequired">{t('postJob.job.languages')}</Label>
              <select id="languagesRequired" value={form.languagesRequired} onChange={e => update('languagesRequired', e.target.value)} className={selectCls}>
                {LANGUAGE_LEVELS.map(l => (
                  <option key={l} value={l}>{t(LANGUAGE_LEVEL_KEYS[l])}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={updateJob.isPending || !dirty} size="lg" className="w-full h-12 font-semibold gap-2">
          {updateJob.isPending ? (
            <>
              <span className="inline-block size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              {t('editJob.saving')}
            </>
          ) : (
            <>
              <Save className="size-4" /> {t('editJob.save')}
            </>
          )}
        </Button>

        <UnsavedChangesDialog
          open={blocker.status === 'blocked'}
          title={t('form.unsaved.title')}
          description={t('form.unsaved.desc')}
          confirmLabel={t('form.unsaved.leave')}
          cancelLabel={t('form.unsaved.stay')}
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      </div>
    </AuthGate>
  )
}
