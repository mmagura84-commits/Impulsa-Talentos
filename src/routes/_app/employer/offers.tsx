import { createFileRoute } from '@tanstack/react-router'
import { useState, useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useProfileById } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { useApplicationsByCompany, useUpdateApplicationStatus } from '@/hooks/useApplications'
import { useOffersByApplication, useCreateOffer, useUpdateOffer } from '@/hooks/useOffers'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthGate } from '@/components/AuthGate'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  FileCheck,
  Plus,
  Pencil,
  X,
  Send,
  Loader2,
} from 'lucide-react'
import type { Application, Offer } from '@/types'

export const Route = createFileRoute('/_app/employer/offers')({
  component: EmployerOffersPage,
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

const STATUS_COLORS: Record<Offer['status'], string> = {
  pending: 'bg-blue-500/10 text-blue-600',
  revised: 'bg-amber-500/10 text-amber-600',
  accepted: 'bg-emerald-500/10 text-emerald-600',
  declined: 'bg-destructive/10 text-destructive',
  withdrawn: 'bg-muted text-muted-foreground',
}

function EmployerOffersPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: company } = useCompany(user?.id)
  const { data: jobs } = useCompanyJobs(company?.id)
  const jobIds = jobs?.map(j => j.id) ?? []
  const { data: applications, isLoading: appsLoading } = useApplicationsByCompany(jobIds.length > 0 ? jobIds : undefined)
  const { t } = useI18n()
  const [creatingFor, setCreatingFor] = useState<string | null>(null) // application id
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)

  if (!user || !profile) {
    return (
      <AuthGate>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AuthGate>
    )
  }

  return (
    <AuthGate
      fallbackKey="auth.fallback.employerDashboard"
      fallbackDescKey="auth.fallback.employerDashboardDesc"
    >
      <div className="p-6 max-w-5xl mx-auto">
        <FadeIn>
          <div className="mb-8">
            <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('offers.kicker')}</p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <FileCheck className="size-7 text-primary" />
              {t('offers.title')}
            </h1>
          </div>
        </FadeIn>

        {appsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : !applications || applications.length === 0 ? (
          <FadeIn delay={0.05}>
            <Card>
              <CardContent className="py-12 text-center">
                <FileCheck className="size-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium text-foreground">{t('offers.empty')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('offers.emptyDesc')}</p>
              </CardContent>
            </Card>
          </FadeIn>
        ) : (
          <FadeIn delay={0.05}>
            <div className="space-y-4">
              {applications.map(app => (
                <ApplicationOfferRow
                  key={app.id}
                  application={app}
                  isCreating={creatingFor === app.id}
                  onCreate={() => setCreatingFor(app.id)}
                  onCancelCreate={() => setCreatingFor(null)}
                  onEditOffer={setEditingOffer}
                  editingOffer={editingOffer}
                  onCancelEdit={() => setEditingOffer(null)}
                  t={t}
                />
              ))}
            </div>
          </FadeIn>
        )}
      </div>
    </AuthGate>
  )
}

function ApplicationOfferRow({
  application,
  isCreating,
  onCreate,
  onCancelCreate,
  onEditOffer,
  editingOffer,
  onCancelEdit,
  t,
}: {
  application: Application
  isCreating: boolean
  onCreate: () => void
  onCancelCreate: () => void
  onEditOffer: (o: Offer | null) => void
  editingOffer: Offer | null
  onCancelEdit: () => void
  t: (k: string, p?: Record<string, unknown>) => string
}) {
  const { data: candidate } = useProfileById(application.candidateId as string)
  const { data: offers } = useOffersByApplication(application.id)
  const { data: profile } = useProfile(useAuth().user?.id)
  const createOffer = useCreateOffer()
  const updateOffer = useUpdateOffer()
  const updateStatus = useUpdateApplicationStatus()
  const initials = candidate?.fullName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  const latestOffer = offers?.[0]

  const handleCreateOffer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fd = new FormData(form)
    try {
      await createOffer.mutateAsync({
        applicationId: application.id,
        salary: Number(fd.get('salary')),
        currency: String(fd.get('currency') || 'COP'),
        startDate: String(fd.get('startDate') || ''),
        notes: String(fd.get('notes') || ''),
        status: 'pending',
      })
      // Update application status to 'offered'
      await updateStatus.mutateAsync({ id: application.id, status: 'offered' })
      toast.success(t('offers.created'))
      onCancelCreate()
    } catch (err) {
      toast.error(t('offers.createError'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  const handleUpdateOffer = async (offerId: string, newStatus: Offer['status']) => {
    try {
      await updateOffer.mutateAsync({
        id: offerId,
        data: { status: newStatus },
      })
      toast.success(t('offers.updated'))
      onCancelEdit()
    } catch (err) {
      toast.error(t('offers.updateError'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm">
              {candidate?.fullName ?? t('messages.unknownCandidate')}
            </p>
            {latestOffer && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[latestOffer.status]}`}>
                  {t(`offers.status.${latestOffer.status}`)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {latestOffer.currency} {latestOffer.salary.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          {!isCreating && !editingOffer && (
            <Button variant="outline" size="sm" onClick={onCreate} className="gap-1 shrink-0">
              <Plus className="size-3.5" />
              {latestOffer ? t('offers.revise') : t('offers.create')}
            </Button>
          )}
        </div>

        {/* Existing offers list */}
        {offers && offers.length > 0 && !isCreating && !editingOffer && (
          <div className="space-y-1 mt-3">
            {offers.slice(0, 3).map(o => (
              <div key={o.id} className="flex items-center justify-between text-xs border-t border-border pt-2">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[o.status]}`}>
                    {t(`offers.status.${o.status}`)}
                  </span>
                  <span className="text-muted-foreground">{o.currency} {o.salary.toLocaleString()}</span>
                  {o.startDate && <span className="text-muted-foreground">{o.startDate}</span>}
                </div>
                <div className="flex gap-1">
                  {['pending', 'revised'].includes(o.status) && (
                    <>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => onEditOffer(o)}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => handleUpdateOffer(o.id, 'withdrawn')}>
                        <X className="size-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create offer form */}
        {isCreating && (
          <form onSubmit={handleCreateOffer} className="border-t border-border pt-4 mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">{t('offers.salary')}</Label>
                <Input name="salary" type="number" placeholder="5000000" required className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t('offers.currency')}</Label>
                <select name="currency" defaultValue="COP" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {['COP', 'USD', 'EUR'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('offers.startDate')}</Label>
              <Input name="startDate" type="date" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('offers.notes')}</Label>
              <Input name="notes" placeholder={t('offers.notesPlaceholder')} className="h-9" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={onCancelCreate}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={createOffer.isPending} className="gap-1">
                {createOffer.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                {t('offers.send')}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
