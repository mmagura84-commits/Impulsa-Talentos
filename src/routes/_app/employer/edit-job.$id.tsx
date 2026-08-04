import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useJob, useUpdateJob } from '@/hooks/useJobs'
import { useI18n } from '@/i18n/I18nProvider'
import { RichTextEditor } from '@/components/RichTextEditor'
import {
  Pencil,
  Save,
  AlertCircle,
  XCircle,
  CheckCircle2,
  ArrowLeft,
  Send,
} from 'lucide-react'

export const Route = createFileRoute('/_app/employer/edit-job/$id')({
  component: EditJobPage,
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

const EMPTY_FORM = {
  title: '',
  description: '',
  level: 'Mid',
  locationType: 'Remoto',
  salaryMin: '',
  salaryMax: '',
  currency: 'COP',
  skillsRequired: '',
  languagesRequired: 'Ingles B2+',
  status: 'open' as 'open' | 'closed' | 'draft',
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

function EditJobPage() {
  const { id } = useParams({ from: '/_app/employer/edit-job/$id' })
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: company } = useCompany(user?.id)
  const { data: job, isLoading, isError, error, refetch } = useJob(id)
  const updateJob = useUpdateJob()
  const { t } = useI18n()

  const [form, setForm] = useState(EMPTY_FORM)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate the form from the fetched job
  useEffect(() => {
    if (!job) return
    setForm({
      title: job.title ?? '',
      description: job.description ?? '',
      level: job.level || 'Mid',
      locationType: job.locationType || 'Remoto',
      salaryMin: job.salaryMin ? String(job.salaryMin) : '',
      salaryMax: job.salaryMax ? String(job.salaryMax) : '',
      currency: job.currency || 'COP',
      skillsRequired: job.skillsRequired ?? '',
      languagesRequired: job.languagesRequired || 'Ingles B2+',
      status: (job.status as 'open' | 'closed' | 'draft') || 'open',
    })
    setHydrated(true)
  }, [job])

  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  // Owner check — only the employer whose company owns this job can edit
  const isOwner = !!(job && company && job.companyId === company.id)

  const handleSubmit = async (targetStatus?: 'open' | 'draft') => {
    if (!job) return
    if (!form.title.trim()) {
      toast.error(t('postJob.job.requiredFields'))
      return
    }
    const nextStatus = targetStatus ?? form.status
    if (nextStatus === 'open' && !form.description.trim()) {
      toast.error(t('postJob.job.requiredFields'))
      return
    }
    try {
      const salaryMin = form.salaryMin ? Number(form.salaryMin) : 0
      const salaryMax = form.salaryMax ? Number(form.salaryMax) : 0

      if (salaryMin > 0 && salaryMax > 0 && salaryMax < salaryMin) {
        toast.error(t('postJob.job.salaryRangeError'))
        return
      }
      await updateJob.mutateAsync({
        id: job.id,
        data: {
          title: form.title,
          description: form.description,
          level: form.level,
          locationType: form.locationType,
          salaryMin: Number.isFinite(salaryMin) ? salaryMin : 0,
          salaryMax: Number.isFinite(salaryMax) ? salaryMax : 0,
          currency: form.currency,
          skillsRequired: form.skillsRequired,
          languagesRequired: form.languagesRequired,
          status: nextStatus,
        },
      })
      setForm(prev => ({ ...prev, status: nextStatus }))
      toast.success(t('dashboard.jobUpdated'), {
        description: form.title,
      })
    } catch (err) {
      toast.error(t('dashboard.jobUpdateError'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  /* ── Loading skeleton ───────────────────────────────── */
  if (isLoading) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="h-4 w-32 rounded bg-muted animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 rounded bg-muted animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-muted animate-pulse" />
            <div className="h-64 rounded-lg bg-muted animate-pulse mt-6" />
          </div>
        </div>
      </AuthGate>
    )
  }

  /* ── Error state ────────────────────────────────────── */
  if (isError) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertCircle className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">{t('jobDetail.errorTitle')}</h2>
          <p className="mt-2 text-muted-foreground">
            {error instanceof Error ? error.message : ''}
          </p>
          <Button variant="outline" className="mt-6" onClick={() => refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </AuthGate>
    )
  }

  /* ── Not found ──────────────────────────────────────── */
  if (!job) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <XCircle className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">{t('editJob.notFound')}</h2>
          <p className="mt-2 text-muted-foreground">{t('editJob.notFoundDesc')}</p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/dashboard">{t('editJob.backToDashboard')}</Link>
          </Button>
        </div>
      </AuthGate>
    )
  }

  /* ── Owner-only guard ───────────────────────────────── */
  if (!isOwner) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <XCircle className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">{t('dashboard.notYourJob')}</h2>
          <p className="mt-2 text-muted-foreground">{t('dashboard.ownerOnlyEdit')}</p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/dashboard">{t('editJob.backToDashboard')}</Link>
          </Button>
        </div>
      </AuthGate>
    )
  }

  /* ── Render form ────────────────────────────────────── */
  if (!hydrated) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="h-4 w-32 rounded bg-muted animate-pulse mb-6" />
          <div className="h-64 rounded-lg bg-muted animate-pulse" />
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <div className="p-6 max-w-3xl mx-auto">
        <FadeIn>
          <div className="mb-8">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="size-4" />
              {t('editJob.backToDashboard')}
            </Link>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <Pencil className="size-7 text-primary" />
              {t('editJob.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t('editJob.subtitle')}
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">id: {job.id}</span>
              </CardTitle>
              <CardDescription>{job.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">{t('postJob.job.title')}</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={e => update('title', e.target.value)}
                  placeholder={t('postJob.job.titlePlaceholder')}
                />
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
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
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
                    {['Remoto', 'Hibrido', 'Presencial'].map(lt => (
                      <option key={lt} value={lt}>{lt}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">{t('dashboard.jobStatus.draft') /* status */}</Label>
                  <select
                    id="status"
                    value={form.status}
                    onChange={e => update('status', e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                  >
                    <option value="open">{t('dashboard.jobStatus.open')}</option>
                    <option value="closed">{t('dashboard.jobStatus.closed')}</option>
                    <option value="draft">{t('dashboard.jobStatus.draft')}</option>
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
                  {['Ingles A2', 'Ingles B1', 'Ingles B2', 'Ingles B2+', 'Ingles C1', 'Ingles C2'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => handleSubmit('open')}
              size="lg"
              disabled={updateJob.isPending}
              className="gap-2 font-medium px-8"
            >
              {updateJob.isPending ? (
                <>
                  <span className="inline-block size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  {t('editJob.saving')}
                </>
              ) : updateJob.isSuccess && form.status === 'open' ? (
                <>
                  <CheckCircle2 className="size-4" />
                  {t('dashboard.jobUpdated')}
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {form.status === 'draft' ? t('postJob.job.publishDraft') : t('editJob.save')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              disabled={updateJob.isPending}
              onClick={() => handleSubmit('draft')}
              className="gap-2"
            >
              <Save className="size-4" />
              {t('postJob.job.saveAsDraft')}
            </Button>
            <Button variant="ghost" asChild size="lg">
              <Link to="/dashboard">{t('common.cancel')}</Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </AuthGate>
  )
}
