import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthGate } from '@/components/AuthGate'
import { useJob, useJobs } from '@/hooks/useJobs'
import { useCompanyById } from '@/hooks/useCompanies'
import { useApplicationById } from '@/hooks/useApplications'
import { useI18n } from '@/i18n/I18nProvider'
import { SocialShare } from '@/components/SocialShare'
import {
  CheckCircle2,
  Briefcase,
  CalendarClock,
  ListChecks,
  Building2,
  ArrowRight,
  LayoutDashboard,
  Search,
  X,
  MailCheck,
  Bell,
  Eye,
} from 'lucide-react'
import type { Job } from '@/types'

export const Route = createFileRoute('/_app/apply/$id/confirm')({
  component: ApplyConfirmPage,
  validateSearch: (search: Record<string, unknown>) => ({
    appId: typeof search.appId === 'string' ? search.appId : undefined,
  }),
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
function splitList(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(/[,;|]/).map(x => x.trim()).filter(Boolean)
}

function extractResumeUrl(coverLetter: string | null | undefined): string | null {
  if (!coverLetter) return null
  const m = coverLetter.match(/\[Resume\]\s+(\S+)/i)
  return m ? m[1] : null
}

function extractCoverNote(coverLetter: string | null | undefined): string {
  if (!coverLetter) return ''
  return coverLetter.replace(/\[Resume\]\s+\S+/i, '').trim()
}

function localeOf(): 'es' | 'en' {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

/* ── Page ──────────────────────────────────────────────── */
function ApplyConfirmPage() {
  const { id } = useParams({ from: '/_app/apply/$id/confirm' })
  const { appId } = Route.useSearch()
  const { data: app, isLoading: appLoading } = useApplicationById(appId)
  const { data: job, isLoading: jobLoading } = useJob(id)
  const { data: company } = useCompanyById(job?.companyId)
  const { data: allJobs } = useJobs()
  const { t } = useI18n()

  const isLoading = appLoading || jobLoading

  const similarJobs: Job[] = (allJobs ?? [])
    .filter(j => j.id !== id && (job?.level ? j.level === job.level : true))
    .slice(0, 3)

  if (isLoading) {
    return (
      <AuthGate>
        <div className="p-6 max-w-3xl mx-auto">
          <div className="h-20 w-20 rounded-full bg-muted animate-pulse mx-auto mb-6" />
          <div className="h-8 w-64 rounded bg-muted animate-pulse mx-auto mb-3" />
          <div className="h-4 w-96 rounded bg-muted animate-pulse mx-auto mb-10" />
          <div className="h-40 rounded-lg bg-muted animate-pulse" />
        </div>
      </AuthGate>
    )
  }

  const companyName = company?.name ?? t('jobDetail.confidential')
  const resumeUrl = extractResumeUrl(app?.coverLetter)
  const coverNote = extractCoverNote(app?.coverLetter)

  return (
    <AuthGate>
      <div className="p-6 max-w-3xl mx-auto">
        {/* Hero: success state */}
        <FadeIn>
          <div className="text-center pt-2 pb-6">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 mb-5"
            >
              <CheckCircle2 className="size-10" />
            </motion.div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">
              {t('apply.success.title')}
            </h1>
            {job && (
              <p className="text-muted-foreground max-w-xl mx-auto">
                {t('apply.success.thanksForApplying', { title: job.title })}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
              {t('apply.success.subtitle')}
            </p>
          </div>
        </FadeIn>

        {/* Email notifications callout */}
        <FadeIn delay={0.08}>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700 shrink-0">
              <Bell className="size-4" />
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <MailCheck className="size-3.5 text-emerald-700" />
                {t('apply.email.title')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('apply.email.candidateSent')}
                
              </p>
            </div>
          </div>
        </FadeIn>

        {/* Application receipt card */}
        <FadeIn delay={0.1}>
          <Card className="mb-6 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MailCheck className="size-5 text-primary" />
                {t('apply.reviewingJob')}
              </CardTitle>
              {app && (
                <CardDescription className="text-xs font-mono">
                  {t('apply.success.confirmationId')}: {app.id}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {job && (
                <div className="rounded-lg bg-muted/40 p-3 flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    <Briefcase className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{job.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="size-3" /> {companyName}
                    </p>
                  </div>
                </div>
              )}

              {app && (
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {t('dashboard.status.pending')}
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-muted-foreground/30 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <CalendarClock className="size-3" />
                      {t('dashboard.status.pending')} ·{' '}
                      {new Date(app.createdAt).toLocaleDateString(localeOf(), {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      {t('apply.review.resume')}
                    </p>
                    {resumeUrl ? (
                      <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-primary hover:underline truncate flex items-center gap-1"
                      >
                        <Eye className="size-3 shrink-0" />
                        {t('apply.resume.fileReady')}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {t('apply.review.notAttached')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {coverNote && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    {t('apply.review.message')}
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {coverNote}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* What happens next */}
        <FadeIn delay={0.15}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="size-4 text-primary" />
                {t('apply.success.statusTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {[1, 2, 3].map(n => (
                  <li key={n} className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                      {n}
                    </span>
                    <span className="text-foreground/90">{t(`apply.success.status${n}`)}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Spread the word (SocialShare) */}
        {job && (
          <FadeIn delay={0.2}>
            <div className="mb-6">
              <SocialShare
                variant="inline"
                title={`${job.title} — ${companyName}`}
                description={t('apply.success.shareDesc')}
                referralMode
                referralHandle={t('social.aFriend')}
              />
            </div>
          </FadeIn>
        )}

        {/* Similar roles */}
        {similarJobs.length > 0 && (
          <FadeIn delay={0.25}>
            <div className="mb-6">
              <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                <Search className="size-4" /> {t('apply.success.recommendTitle')}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                {t('apply.success.recommendDesc')}
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {similarJobs.map(j => {
                  const skills = splitList(j.skillsRequired).slice(0, 2)
                  return (
                    <Link
                      key={j.id}
                      to="/jobs/$id"
                      params={{ id: j.id }}
                      className="block rounded-lg border border-border bg-card p-3 hover:border-primary/40 hover:shadow-md transition-all group"
                    >
                      <p className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {j.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{j.locationType}</p>
                      {skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {skills.map(s => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Withdraw note */}
        <FadeIn delay={0.3}>
          <div className="rounded-lg border border-border bg-muted/30 p-4 mb-6 flex items-start gap-3 text-sm">
            <X className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">{t('apply.success.undoTitle')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('apply.success.undoDesc')}
              </p>
            </div>
          </div>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.35}>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button asChild size="lg" className="gap-2 font-medium">
              <Link to="/dashboard">
                <LayoutDashboard className="size-4" />
                {t('apply.success.goDashboard')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild size="lg" className="gap-2 font-medium">
              <Link to="/jobs">
                {t('apply.success.browseMore')}
              </Link>
            </Button>
          </div>
        </FadeIn>
      </div>
    </AuthGate>
  )
}
