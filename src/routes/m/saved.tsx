import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Heart, Building2, MapPin, Briefcase, Clock, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useMySavedJobs, useUnsaveJob } from '@/hooks/useSavedJobs'
import { useCompanyById } from '@/hooks/useCompanies'
import { useI18n } from '@/i18n/I18nProvider'
import { formatLocationType, formatLanguageList } from '@/lib/jobEnums'
import type { Job } from '@/types'

export const Route = createFileRoute('/m/saved')({
  head: () => ({ meta: [{ title: 'Saved — Impulsa (mobile)' }] }),
  component: MobileSaved,
})

function MobileSaved() {
  const { t } = useI18n()
  const { user, login } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: savedJobs, isLoading } = useMySavedJobs(profile?.id)
  const unsave = useUnsaveJob()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (!user) {
    return (
      <div className="px-4 pt-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/10 mb-3">
          <Heart className="size-6 text-pink-600" />
        </div>
        <p className="text-sm font-semibold text-foreground">{t('mobile.authRequired')}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('mobile.authRequiredDesc')}
        </p>
        <Button onClick={login} size="lg" className="mt-4 w-full">
          {t('mobile.authRequiredCta')}
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  if (!savedJobs || savedJobs.length === 0) {
    return (
      <div className="px-4 pt-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
          <Heart className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">{t('mobile.empty.title')}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('mobile.empty.saved')}
        </p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to="/m/jobs">
            <Heart className="size-3.5 mr-1.5" /> {t('savedJobs.browse')}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4">
      <ul className="space-y-2.5">
        {savedJobs.map(job => (
          <li key={job.id}>
            <SavedJobRow
              job={job}
              candidateId={profile!.id}
              onUnsave={() => unsave.mutate({ candidateId: profile!.id, jobId: job.id })}
              confirming={confirmId === job.id}
              onConfirmStart={() => setConfirmId(job.id)}
              onConfirmEnd={() => setConfirmId(null)}
            />
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {confirmId && (
          <ConfirmDialog
            onCancel={() => setConfirmId(null)}
            onConfirm={() => {
              const job = savedJobs.find(j => j.id === confirmId)
              if (job && profile) {
                unsave.mutate({ candidateId: profile.id, jobId: job.id })
              }
              setConfirmId(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function SavedJobRow({
  job,
  candidateId,
  onUnsave,
  confirming,
  onConfirmStart,
  onConfirmEnd,
}: {
  job: Job
  candidateId: string
  onUnsave: () => void
  confirming: boolean
  onConfirmStart: () => void
  onConfirmEnd: () => void
}) {
  const { data: company } = useCompanyById(job.companyId)
  const { t } = useI18n()
  const ccy = job.currency || 'COP'
  const salary =
    job.salaryMin && job.salaryMax
      ? `${job.salaryMin.toLocaleString()}-${job.salaryMax.toLocaleString()} ${ccy}`
      : t('jobs.salaryTBD')
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Link to="/m/jobs/$id" params={{ id: job.id }} className="block">
        <h3 className="font-semibold text-sm text-foreground line-clamp-2">{job.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
          <Building2 className="size-3" /> {company?.name ?? t('jobDetail.confidential')}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {formatLocationType(job.locationType, t)}
          </span>
          <span className="text-accent font-semibold truncate">{salary}</span>
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onConfirmStart()
          }}
          className="h-9 px-3 rounded-full text-xs font-medium text-muted-foreground active:bg-accent flex items-center gap-1.5"
        >
          <X className="size-3.5" /> {t('savedJobs.remove')}
        </button>
      </div>
    </div>
  )
}

function ConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n()
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,20rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <p className="text-sm font-semibold text-foreground">{t('savedJobs.removeConfirm')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('savedJobs.removeConfirmDesc')}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {t('savedJobs.remove')}
          </Button>
        </div>
      </motion.div>
    </>
  )
}
