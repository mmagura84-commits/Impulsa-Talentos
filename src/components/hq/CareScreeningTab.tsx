/**
 * HQ admin screening workflow (scope item 3).
 * Lists all caregiver profiles, lets an admin view uploaded documents and
 * advance the verification status. The status transition runs through the
 * `set_caregiver_verification_status` SECURITY DEFINER RPC (admin-only,
 * monotonic) — a caregiver never self-attests.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { ShieldCheck, XCircle, ArrowRight, FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useAllCaregiverProfiles,
  useSetCaregiverVerificationStatus,
} from '@/hooks/useCare'
import { useSignedStorageUrl } from '@/hooks/useSignedStorageUrl'
import { useI18n } from '@/i18n/I18nProvider'
import {
  CARE_VERIFICATION_KEYS,
  TERMINAL_REJECTED,
  isPreScreened,
  type CareVerificationStatus,
} from '@/lib/care'
import { PreScreenedBadge } from '@/components/care/PreScreenedBadge'

function DocLink({ label, pointer }: { label: string; pointer?: string | null }) {
  const url = useSignedStorageUrl(pointer ?? undefined)
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent/40"
    >
      <FileText className="size-3.5" aria-hidden="true" />
      {label}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  )
}

export function CareScreeningTab() {
  const { t } = useI18n()
  const { data: caregivers, isLoading } = useAllCaregiverProfiles()
  const setStatus = useSetCaregiverVerificationStatus()
  const [busyId, setBusyId] = useState<string | null>(null)

  const transition = async (id: string, to: CareVerificationStatus) => {
    setBusyId(id)
    try {
      await setStatus.mutateAsync({ profileId: id, to })
      toast.success(to === TERMINAL_REJECTED ? t('care.hq.rejected') : t('care.hq.verified'))
    } catch (err) {
      toast.error(t('care.hq.error'), {
        description: err instanceof Error ? err.message : '',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('care.hq.title')}</CardTitle>
          <CardDescription>{t('care.hq.desc')}</CardDescription>
        </CardHeader>
      </Card>

      {isLoading && <div className="h-32 rounded-lg bg-muted animate-pulse" />}

      {!isLoading && (caregivers ?? []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t('care.hq.empty')}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(caregivers ?? []).map(c => (
          <Card key={c.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.userId}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.barrio || '—'}, Medellín · {c.competencies.join(', ') || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {t(CARE_VERIFICATION_KEYS[c.verificationStatus] ?? 'care.status.unverified')}
                  </span>
                  {isPreScreened(c.verificationStatus) && <PreScreenedBadge />}
                </div>
              </div>

              {/* Uploaded documents (signed URL) */}
              <div className="flex flex-wrap items-center gap-2">
                <DocLink label={t('care.hq.doc.identity')} pointer={c.identityPointer} />
                <DocLink label={t('care.hq.doc.background')} pointer={c.backgroundCheckPointer} />
                <DocLink label={t('care.hq.doc.certificate')} pointer={c.certificatePointer} />
              </div>

              {/* Monotonic admin-only actions */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {c.verificationStatus !== 'verified' && c.verificationStatus !== TERMINAL_REJECTED && (
                  <Button
                    size="sm"
                    disabled={setStatus.isPending && busyId === c.id}
                    onClick={() => transition(c.id, 'verified')}
                    className="gap-1.5"
                  >
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                    {t('care.hq.markVerified')}
                  </Button>
                )}
                {c.verificationStatus !== 'verified' && c.verificationStatus !== TERMINAL_REJECTED && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setStatus.isPending && busyId === c.id}
                    onClick={() => transition(c.id, 'background_pending')}
                    className="gap-1.5"
                  >
                    <ShieldCheck className="size-3.5" aria-hidden="true" />
                    {t('care.hq.markInProgress')}
                  </Button>
                )}
                {(c.verificationStatus === 'verified' ||
                  c.verificationStatus === 'background_pending') && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={setStatus.isPending && busyId === c.id}
                    onClick={() => transition(c.id, TERMINAL_REJECTED)}
                    className="gap-1.5"
                  >
                    <XCircle className="size-3.5" aria-hidden="true" />
                    {t('care.hq.reject')}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">{t('care.hq.monotonic')}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
