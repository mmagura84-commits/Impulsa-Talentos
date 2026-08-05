import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany, useUpdateCompany } from '@/hooks/useCompanies'
import { useDeleteJob, useCompanyJobs } from '@/hooks/useJobs'
import { useApplications, useApplicationsByCompany } from '@/hooks/useApplications'
import { useProfileById } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { FadeIn, StatCard, formatSalary, formatPosted, statusLabel } from './shared'
import {
  Briefcase,
  FileText,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Mail,
  Users,
  Clock,
  BadgeCheck,
} from 'lucide-react'
import type { Job, Application } from '@/types'

/* ── Employer job row ──────────────────────────────────── */
function EmployerJobRow({ job }: { job: Job }) {
  const { locale, t } = useI18n()
  const { data: apps } = useApplications(job.id)
  const appCount = apps?.length ?? 0
  return (
    <div className="group flex items-center justify-between rounded-lg border border-border p-4 hover:bg-accent/30 hover:border-accent/50 transition-all duration-150 gap-3">
      <div className="min-w-0 flex-1">
        <h4 className="font-medium text-sm text-foreground truncate">{job.title}</h4>
        <p className="text-xs text-muted-foreground">
          {formatSalary(job, locale)} &middot; {formatPosted(job.createdAt, t)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {job.moderationStatus === 'pending' && (
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700">
            <Clock className="mr-1 size-3" /> {t('job.moderation.pending')}
          </span>
        )}
        {job.moderationStatus === 'rejected' && (
          <span className="inline-flex items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
            {t('job.moderation.rejected')}
          </span>
        )}
        <span
          className={`hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            job.status === 'open'
              ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
              : job.status === 'closed'
                ? 'border-muted-foreground/30 text-muted-foreground bg-muted/30'
                : 'border-amber-500/30 text-amber-700 bg-amber-500/5'
          }`}
        >
          {job.status === 'open'
            ? t('dashboard.jobStatus.open')
            : job.status === 'closed'
              ? t('dashboard.jobStatus.closed')
              : t('dashboard.jobStatus.draft')}
        </span>
        {appCount > 0 ? (
          <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs text-primary hover:text-primary" asChild aria-label={t('dashboard.manage')}>
            <Link to="/employer/manage/$id" params={{ id: job.id }}>
              <Users className="size-3.5" />
              <span className="font-medium">{appCount}</span>
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" asChild aria-label={t('dashboard.manage')}>
            <Link to="/employer/manage/$id" params={{ id: job.id }}>
              <Users className="size-4" />
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild aria-label={t('dashboard.view')}>
          <Link to="/jobs/$id" params={{ id: job.id }}>
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" asChild aria-label={t('dashboard.edit')}>
          <Link to="/employer/edit-job/$id" params={{ id: job.id }}>
            <Pencil className="size-4" />
          </Link>
        </Button>
        <DeleteJobButton jobId={job.id} jobTitle={job.title} />
      </div>
    </div>
  )
}

/* ── Delete confirmation dialog ────────────────────────── */
function DeleteJobButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const { t } = useI18n()
  const deleteJob = useDeleteJob()
  const [confirming, setConfirming] = useState(false)

  const handleDelete = async () => {
    try {
      await deleteJob.mutateAsync(jobId)
      toast.success(t('dashboard.jobDeleted'), { description: jobTitle })
      setConfirming(false)
    } catch (err) {
      toast.error(t('dashboard.jobDeleteError'), { description: err instanceof Error ? err.message : '' })
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} disabled={deleteJob.isPending}
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" aria-label={t('dashboard.delete')}>
        <Trash2 className="size-4" />
      </Button>
      <AnimatePresence>
        {confirming && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setConfirming(false)} />
            <motion.div role="dialog" aria-modal="true"
              initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <Trash2 className="size-4" />
                  </div>
                  <h2 className="font-serif text-lg font-bold text-foreground">{t('dashboard.confirmDelete')}</h2>
                </div>
                <button onClick={() => setConfirming(false)} className="text-muted-foreground hover:text-foreground cursor-pointer" aria-label={t('dashboard.confirmDeleteNo')}>
                  <X className="size-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t('dashboard.confirmDeleteDesc')}</p>
              <p className="text-sm font-medium text-foreground line-clamp-2 mb-5">"{jobTitle}"</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirming(false)}>{t('dashboard.confirmDeleteNo')}</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteJob.isPending} className="gap-2">
                  {deleteJob.isPending ? (
                    <><span className="inline-block size-3.5 rounded-full border-2 border-destructive-foreground/30 border-t-destructive-foreground animate-spin" />{t('common.loading')}</>
                  ) : (
                    <><Trash2 className="size-3.5" />{t('dashboard.confirmDeleteYes')}</>
                  )}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── Company contact-email card ─────────────────────────── */
function CompanyContactEmailCard({ company }: { company: { id: string; contactEmail?: string; name: string } }) {
  const { t } = useI18n()
  const updateCompany = useUpdateCompany()
  const [value, setValue] = useState(company.contactEmail ?? '')
  const [editing, setEditing] = useState(!company.contactEmail)

  const handleSave = async () => {
    try {
      await updateCompany.mutateAsync({ id: company.id, data: { contactEmail: value.trim() || undefined } })
      toast.success(t('profile.saved'), { duration: 1800 })
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    }
  }

  const hasEmail = !!company.contactEmail
  const emailChanged = value.trim() !== (company.contactEmail ?? '')

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            {t('dashboard.company.contactEmailLabel')}
          </CardTitle>
          <CardDescription className="mt-1">{t('dashboard.company.contactEmailHelp')}</CardDescription>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
          hasEmail ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5' : 'border-amber-500/30 text-amber-700 bg-amber-500/5'
        }`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${hasEmail ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {hasEmail ? t('dashboard.company.contactEmailSet') : t('dashboard.company.contactEmailMissing')}
        </span>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <Input type="email" value={value} onChange={e => setValue(e.target.value)}
              placeholder={t('postJob.company.contactEmailPlaceholder')} className="flex-1" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={updateCompany.isPending || !emailChanged}>
                {updateCompany.isPending ? t('common.loading') : t('common.save')}
              </Button>
              {hasEmail && (
                <Button size="sm" variant="ghost" onClick={() => { setValue(company.contactEmail ?? ''); setEditing(false) }}>
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-sm text-foreground font-mono truncate">{company.contactEmail}</p>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>{t('dashboard.edit')}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ── Company verification request card ────────────────── */
function VerificationCard({ company }: { company: { id: string; name: string; verified?: boolean; verificationRequested?: boolean } }) {
  const { t } = useI18n()
  const updateCompany = useUpdateCompany()
  const requested = !!company.verificationRequested

  const request = async () => {
    try {
      await updateCompany.mutateAsync({ id: company.id, data: { verificationRequested: true } })
      toast.success(t('verification.requestSuccess'), { duration: 2500 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeCheck className="size-4 text-primary" />
            {t('verification.verified')}
          </CardTitle>
          <CardDescription className="mt-1">
            {requested ? t('verification.requestedDesc') : t('verification.requestDesc')}
          </CardDescription>
        </div>
        {requested ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t('verification.requested')}
          </span>
        ) : (
          <Button size="sm" variant="outline" onClick={request} disabled={updateCompany.isPending} className="shrink-0 gap-1.5">
            <BadgeCheck className="size-3.5" />
            {updateCompany.isPending ? t('common.loading') : t('verification.request')}
          </Button>
        )}
      </CardHeader>
    </Card>
  )
}

/* ════════════════════════════════════════════════════════════
   Employer Dashboard
   ════════════════════════════════════════════════════════════ */
export function EmployerDashboard({ employerId }: { employerId: string }) {
      const { t } = useI18n()
      const { data: company, isLoading: companyLoading } = useCompany(employerId)
      const { data: companyJobs, isLoading: jobsLoading } = useCompanyJobs(company?.id)
      const postedJobs = (companyJobs ?? []).filter(j => j.companyId === company?.id)
      const jobIds = postedJobs.map(j => j.id)
      const { data: allApplications = [], isLoading: appsLoading } = useApplicationsByCompany(jobIds)
      const applications = allApplications.filter(a => jobIds.includes(a.jobId))
      const hires = applications.filter(a => a.status === 'hired').length
      const recentApplications = applications.slice(0, 5)
  return <div className="space-y-6">
    <div className="grid sm:grid-cols-3 gap-4"><StatCard icon={Briefcase} label={t('dashboard.stat.activeJobs')} value={String(postedJobs.filter(j=>j.status==='open').length)} delay={0}/><StatCard icon={Users} label={t('dashboard.stat.totalApplicants')} value={String(applications.length)} delay={0.05}/><StatCard icon={CheckCircle2} label={t('dashboard.stat.hires')} value={String(hires)} delay={0.1}/></div>
    {company && <FadeIn delay={0.1}><div className="space-y-4"><CompanyContactEmailCard company={company} /><VerificationCard company={company} /></div></FadeIn>}
    <FadeIn delay={0.14}><Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">{t('dashboard.employerJobs.title')}</CardTitle><CardDescription>{company ? company.name : t('dashboard.noCompany')}</CardDescription></div><Button size="sm" asChild><Link to="/employer/post-job"><Plus className="size-3.5 mr-1"/>{t('dashboard.newJob')}</Link></Button></CardHeader><CardContent className="space-y-2">{companyLoading || jobsLoading ? <div className="h-16 rounded bg-muted animate-pulse"/> : !company ? <div className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.noCompany')}<br/><Button className="mt-3" size="sm" asChild><Link to="/employer/post-job">{t('dashboard.registerCompany')}</Link></Button></div> : !postedJobs.length ? <div className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.noEmployerJobs')}<br/><Button className="mt-3" size="sm" asChild><Link to="/employer/post-job">{t('dashboard.firstJob')}</Link></Button></div> : postedJobs.map(job=><EmployerJobRow key={job.id} job={job}/>)}</CardContent></Card></FadeIn>
    <FadeIn delay={0.18}><Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="size-4 text-primary"/>{t('dashboard.recentActivity')}</CardTitle></CardHeader><CardContent>{appsLoading ? <div className="h-16 rounded bg-muted animate-pulse"/> : !recentApplications.length ? <p className="py-6 text-center text-sm text-muted-foreground">{t('dashboard.noApplications')}</p> : <div className="space-y-2">{recentApplications.map(a=><RecentActivityRow key={a.id} app={a}/>)}</div>}</CardContent></Card></FadeIn>
  </div>
}

/* ── Recent activity row (resolves candidate name) ─────── */
function RecentActivityRow({ app }: { app: { id: string; candidateId: string; status: string; createdAt: string } }) {
  const { data: profile } = useProfileById(app.candidateId)
  const { t } = useI18n()
  const displayName = profile?.fullName ?? app.candidateId.slice(0, 8)
  return (
    <div className="flex items-center justify-between rounded border p-3 text-sm">
      <span className="font-medium truncate">{displayName}</span>
      <span className="text-muted-foreground shrink-0 ml-2">{statusLabel(app.status as Application['status'], (k: string) => t(k))} · {formatPosted(app.createdAt, t)}</span>
    </div>
  )
}
