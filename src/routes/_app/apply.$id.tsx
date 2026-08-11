import { createFileRoute, Link, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useJob } from '@/hooks/useJobs'
import { useCompanyById } from '@/hooks/useCompanies'
import { useApply, useMyApplications } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import { sendApplicationNotifications } from '@/lib/notifyApplication'
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  Link as LinkIcon,
  Send,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Briefcase,
  MapPin,
  DollarSign,
  Globe,
  ShieldCheck,
  Check,
} from 'lucide-react'
import type { Job } from '@/types'

export const Route = createFileRoute('/_app/apply/$id')({
  component: ApplyPage,
})

/* ── Animation helper ─────────────────────────────────── */
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

/* ── Helpers ───────────────────────────────────────────── */
const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'txt']

function isAllowedFile(f: File): boolean {
  if (ALLOWED_TYPES.has(f.type)) return true
  // Some browsers leave type empty — fall back to extension
  const ext = f.name.split('.').pop()?.toLowerCase() || ''
  return ALLOWED_EXT.includes(ext)
}

function formatSalary(job: Job, locale: 'en' | 'es'): string {
  if (!job.salaryMin && !job.salaryMax) return '—'
  const min = job.salaryMin ? job.salaryMin.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const max = job.salaryMax ? job.salaryMax.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const ccy = job.currency || 'COP'
  return `${ccy} ${min} - ${max}`
}

function splitList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(/[,;|]/).map(x => x.trim()).filter(Boolean)
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/* ── Step indicator ────────────────────────────────────── */
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const { t } = useI18n()
  const steps = [
    { n: 1, label: t('apply.step.1') },
    { n: 2, label: t('apply.step.2') },
    { n: 3, label: t('apply.step.3') },
  ] as const
  return (
    <ol className="flex items-center gap-3 sm:gap-6 mb-8">
      {steps.map((s, i) => {
        const active = s.n === step
        const done = s.n < step
        return (
          <li key={s.n} className="flex items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                      ? 'bg-accent text-accent-foreground ring-2 ring-accent/30'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="size-3.5" /> : s.n}
              </div>
              <span
                className={`text-xs sm:text-sm font-medium ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="hidden sm:inline-block h-px w-8 bg-border" />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ── Resume input: file + link tabs ───────────────────── */
function ResumeInput({
  file,
  setFile,
  link,
  setLink,
  fileError,
}: {
  file: File | null
  setFile: (f: File | null) => void
  link: string
  setLink: (s: string) => void
  fileError: string | null
}) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mode, setMode] = useState<'file' | 'link'>(file ? 'file' : 'link')

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null)
      return
    }
    if (!isAllowedFile(f)) {
      toast.error(t('apply.resume.fileTypeError'))
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error(t('apply.resume.fileSizeError'))
      return
    }
    setFile(f)
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null)
  }

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div className="space-y-4">
      {/* Mode tabs */}
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => { setMode('file'); setFile(null) }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'file' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          <Upload className="inline-block size-3.5 mr-1.5" />
          {t('apply.resume.upload')}
        </button>
        <button
          type="button"
          onClick={() => { setMode('link'); setFile(null) }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === 'link' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
          }`}
        >
          <LinkIcon className="inline-block size-3.5 mr-1.5" />
          {t('apply.resume.link').replace('Or ', '').replace('O ', '')}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'file' ? (
          <motion.div
            key="file"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {!file ? (
              <label
                onDragOver={e => e.preventDefault()}
                onDrop={onDrop}
                className="flex flex-col items-center justify-center text-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40 transition-colors py-10 px-6 cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground">{t('apply.resume.upload')}</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, TXT · up to 8 MB</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={onInputChange}
                  className="sr-only"
                />
                {fileError && (
                  <p className="text-xs text-destructive mt-2">{fileError}</p>
                )}
              </label>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB · {file.type || file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFile(null)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={t('apply.resume.remove')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="link"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder={t('apply.resume.linkPlaceholder')}
                className="pl-9"
              />
            </div>
            {link && !isValidUrl(link) && (
              <p className="mt-2 text-xs text-destructive">Please enter a valid URL (http:// or https://).</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ── Page ──────────────────────────────────────────────── */
function ApplyPage() {
  const { id } = useParams({ from: '/_app/apply/$id' })
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { locale, t } = useI18n()

  /* ── Candidate-only gate: redirect non-candidates before any content ── */
  useLayoutEffect(() => {
    if (!profile) return
    if (profile.role !== 'candidate') {
      toast.error(t('apply.accessDenied'), { description: t('apply.accessDeniedDesc') })
      navigate({ to: '/jobs/' + id, replace: true })
    }
  }, [profile, navigate, id, t])
  const { data: job, isLoading, isError, error, refetch } = useJob(id)
  const { data: company } = useCompanyById(job?.companyId)
  const { data: myApps, isLoading: myAppsLoading } = useMyApplications(profile?.id)
  const apply = useApply()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [link, setLink] = useState('')
  const [message, setMessage] = useState('')

  const alreadyApplied = useMemo(
    () => !!myApps?.some(a => a.jobId === id),
    [myApps, id],
  )

  // Seed the link with the profile's saved CV URL (if any)
  useEffect(() => {
    if (profile?.cvUrl && !link && !file) {
      setLink(profile.cvUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.cvUrl])

  // Already applied — short-circuit to confirmation page (deferred to avoid render-side navigate).
  // Declared unconditionally ABOVE every early return so all renders call the
  // same hooks in the same order (React #310 — loading render: 16 hooks, loaded: 17).
  // No-op while loading or when not applied.
  // Already applied — short-circuit to confirmation page (deferred to avoid render-side navigate).
  // Declared unconditionally ABOVE the early returns so every render calls the
  // same hooks in the same order (React #310). No-op when not applied.
  useEffect(() => {
    if (!profile?.id || !alreadyApplied) return
    if (alreadyApplied) {
      const lastApp = myApps?.find(a => a.jobId === id)
      if (lastApp) {
        navigate({
          to: '/apply/$id/confirm',
          params: { id },
          search: { appId: lastApp.id },
        })
      }
    }
  }, [alreadyApplied, myApps, id, navigate])

  /* ── Loading skeleton ───────────────────────────────── */
  if (isLoading || myAppsLoading) {
    return (
      <AuthGate fallbackKey="auth.fallback.apply" fallbackDescKey="auth.fallback.applyDesc">
        <div className="p-6 max-w-3xl mx-auto">
          <div className="h-4 w-32 rounded bg-muted animate-pulse mb-6" />
          <div className="h-24 rounded-lg bg-muted animate-pulse mb-6" />
          <div className="h-64 rounded-lg bg-muted animate-pulse" />
        </div>
      </AuthGate>
    )
  }

  if (isError) {
    return (
      <AuthGate fallbackKey="auth.fallback.apply" fallbackDescKey="auth.fallback.applyDesc">
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

  if (!job) {
    return (
      <AuthGate fallbackKey="auth.fallback.apply" fallbackDescKey="auth.fallback.applyDesc">
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <XCircle className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">{t('jobDetail.notFoundTitle')}</h2>
          <p className="mt-2 text-muted-foreground">{t('jobDetail.notFoundDesc')}</p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/jobs">{t('jobDetail.viewAll')}</Link>
          </Button>
        </div>
      </AuthGate>
    )
  }

  // Profile must exist before applying
  if (!profile?.id) {
    return (
      <AuthGate fallbackKey="auth.fallback.apply" fallbackDescKey="auth.fallback.applyDesc">
        <div className="p-6 max-w-3xl mx-auto text-center py-20">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <ShieldCheck className="size-7 text-destructive" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground">{t('apply.next.errorTitle')}</h2>
          <p className="mt-2 text-muted-foreground">{t('apply.next.errorProfile')}</p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            <Button asChild>
              <Link to="/profile">{t('profile.create')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/jobs/$id" params={{ id }}>{t('common.back')}</Link>
            </Button>
          </div>
        </div>
      </AuthGate>
    )
  }


  const companyName = company?.name ?? t('jobDetail.confidential')
  const skills = splitList(job.skillsRequired)

  const hasResume = !!file || (!!link && isValidUrl(link))
  const messageValid = message.length <= 1000
  const canProceedFromStep1 = hasResume
  const canProceedFromStep2 = messageValid

  const handleSubmit = async () => {
    if (!profile?.id) {
      toast.error(t('apply.next.errorProfile'))
      return
    }
    if (!hasResume) {
      toast.error(t('apply.next.errorFile'))
      return
    }
    if (!messageValid) {
      toast.error(t('apply.next.errorMessage'))
      return
    }
    try {
      const created = await apply.mutateAsync({
        jobId: job.id,
        candidateId: profile.id,
        coverLetter: message,
        resumeFile: file,
        resumeUrl: link,
      })

      // Fire the candidate + platform notification emails. Fire-and-forget so a
      // failed notification never blocks the candidate's confirmation
      // page. Surface a soft toast so the user knows emails are out.
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      void sendApplicationNotifications({
        app: created,
        job,
        candidateProfile: profile,
        locale,
        dashboardUrl: `${origin}/dashboard`,
        jobsUrl: `${origin}/jobs`,
        resumeUrl: file ? null : link || null,
        coverNote: message,
      }).then(outcome => {
        const parts: string[] = []
        if (outcome.candidate.ok) parts.push(t('apply.email.candidateSent'))
        else if (outcome.candidate.error) parts.push(t('apply.email.candidateFailed'))
        if (parts.length) {
          const hasFailure = parts.some(p => p.toLowerCase().includes('ailed'))
          toast[hasFailure ? 'warning' : 'success'](
            t('apply.email.title'),
            { description: parts.join(' · '), duration: 4500 },
          )
        }
      })

      navigate({
        to: '/apply/$id/confirm',
        params: { id: job.id },
        search: { appId: created.id },
      })
    } catch (err) {
      toast.error(t('apply.next.errorTitle'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  return (
    <AuthGate fallbackKey="auth.fallback.apply" fallbackDescKey="auth.fallback.applyDesc">
      <div className="p-6 max-w-3xl mx-auto">
        <FadeIn>
          <div className="mb-6">
            <Link
              to="/jobs/$id"
              params={{ id: job.id }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="size-4" />
              {t('apply.review.back')}
            </Link>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
              {t('apply.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">{t('apply.subtitle')}</p>
          </div>
        </FadeIn>

        {/* Job summary card (always visible) */}
        <FadeIn delay={0.05}>
          <Card className="mb-6 border-border">
            <CardHeader className="pb-3">
              <p className="text-xs font-medium text-accent uppercase tracking-wider">
                {t('apply.reviewingJob')}
              </p>
              <CardTitle className="text-lg">{job.title}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Briefcase className="size-3.5" /> {companyName}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5 text-accent" /> {formatLocationType(job.locationType, t)}
              </span>
              <span className="flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-accent" /> {formatSalary(job, locale)}
              </span>
              {job.languagesRequired && (
                <span className="flex items-center gap-1.5">
                  <Globe className="size-3.5 text-accent" /> {formatLanguageList(job.languagesRequired, t)}
                </span>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Steps */}
        <FadeIn delay={0.1}>
          <StepIndicator step={step} />
        </FadeIn>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="size-5 text-primary" />
                    {t('apply.resume.title')}
                  </CardTitle>
                  <CardDescription>{t('apply.resume.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.cvUrl && !file && !link && (
                    <button
                      type="button"
                      onClick={() => setLink(profile.cvUrl ?? '')}
                      className="w-full flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors text-left"
                    >
                      <CheckCircle2 className="size-3.5 text-primary" />
                      {t('apply.resume.currentProfile')}: <span className="font-mono text-foreground truncate flex-1">{profile.cvUrl}</span>
                    </button>
                  )}
                  <ResumeInput
                    file={file}
                    setFile={setFile}
                    link={link}
                    setLink={setLink}
                    fileError={null}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="size-5 text-accent" />
                    {t('apply.message.title')}
                  </CardTitle>
                  <CardDescription>{t('apply.message.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="message">{t('apply.message.label')}</Label>
                      <span className={`text-[11px] ${message.length > 1000 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {t('apply.message.charCount', { n: message.length })}
                      </span>
                    </div>
                    <textarea
                      id="message"
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={t('apply.message.placeholder')}
                      rows={6}
                      maxLength={1200}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-y"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Sparkles className="size-3" /> {t('apply.message.templates')}
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2">
                      {([
                        { k: 'excited', skill: skills[0] ?? 'this domain', n: 3 },
                        { k: 'referred', skill: skills[0] ?? 'this domain', n: 5 },
                        { k: 'experience', skill: skills[0] ?? 'this domain', n: 4 },
                      ] as const).map(tpl => (
                        <button
                          key={tpl.k}
                          type="button"
                          onClick={() => setMessage(t(`apply.message.tpl.${tpl.k}`, { skill: tpl.skill, n: tpl.n, company: companyName }))}
                          className="text-left text-xs text-muted-foreground rounded-lg border border-border bg-card hover:bg-accent/30 hover:border-accent/50 transition-colors px-3 py-2 cursor-pointer"
                        >
                          {t(`apply.message.tpl.${tpl.k}`, { skill: tpl.skill, n: tpl.n, company: companyName })}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="size-5 text-primary" />
                    {t('apply.review.title')}
                  </CardTitle>
                  <CardDescription>{t('apply.review.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Job summary */}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {t('apply.review.job')}
                    </p>
                    <p className="font-semibold text-foreground">{job.title}</p>
                    <p className="text-sm text-muted-foreground">{companyName}</p>
                  </div>

                  {/* Resume summary */}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {t('apply.review.resume')}
                    </p>
                    {file ? (
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-emerald-700" />
                        <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    ) : link ? (
                      <div className="flex items-center gap-2">
                        <LinkIcon className="size-4 text-emerald-700" />
                        <span className="text-sm font-medium text-foreground truncate">{link}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t('apply.review.notAttached')}
                      </p>
                    )}
                  </div>

                  {/* Message summary */}
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {t('apply.review.message')}
                    </p>
                    {message.trim() ? (
                      <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                        {message}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t('apply.review.notAttached')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step navigation */}
        <FadeIn delay={0.15}>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {step === 1 && (
              <>
                <Button
                  size="lg"
                  onClick={() => setStep(2)}
                  disabled={!canProceedFromStep1}
                  className="gap-2 font-medium px-6"
                >
                  {t('common.continue')}
                  <ArrowRight className="size-4" />
                </Button>
                <Button variant="ghost" asChild size="lg">
                  <Link to="/jobs/$id" params={{ id: job.id }}>{t('apply.next.cancel')}</Link>
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <Button
                  size="lg"
                  onClick={() => setStep(3)}
                  disabled={!canProceedFromStep2}
                  className="gap-2 font-medium px-6"
                >
                  {t('common.continue')}
                  <ArrowRight className="size-4" />
                </Button>
                <Button variant="ghost" onClick={() => setStep(1)} size="lg">
                  {t('common.back')}
                </Button>
              </>
            )}

            {step === 3 && (
              <>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={apply.isPending}
                  className="gap-2 font-medium px-8"
                >
                  {apply.isPending ? (
                    <>
                      <span className="inline-block size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      {t('apply.review.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      {t('apply.review.submit')}
                    </>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setStep(2)} size="lg" disabled={apply.isPending}>
                  {t('common.back')}
                </Button>
                <Button variant="ghost" asChild size="lg" disabled={apply.isPending}>
                  <Link to="/jobs/$id" params={{ id: job.id }}>{t('apply.next.cancel')}</Link>
                </Button>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    </AuthGate>
  )
}
