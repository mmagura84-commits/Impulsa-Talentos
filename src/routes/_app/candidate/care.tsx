import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCaregiverProfile } from '@/hooks/useCare'
import { PreScreenedBadge } from '@/components/care/PreScreenedBadge'
import { CaregiverScreeningForm } from '@/components/care/CaregiverScreeningForm'
import { CareSummaryDisclaimer } from '@/components/care/CareDisclaimer'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent } from '@/components/ui/card'
import { HeartHandshake, ShieldAlert } from 'lucide-react'
import { CARE_VERIFICATION_KEYS, isPreScreened } from '@/lib/care'

export const Route = createFileRoute('/_app/candidate/care')({
  component: CandidateCarePage,
})

/** Caregiver onboarding + screening application surface (scope item 2). */
function CandidateCarePage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const navigate = useNavigate()
  const { data: care, isLoading } = useCaregiverProfile(user?.id)
  const { t } = useI18n()

  useEffect(() => {
    if (profile && profile.role !== 'candidate') navigate({ to: '/dashboard', replace: true })
  }, [profile, navigate])

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <HeartHandshake className="size-7 text-emerald-600" />
            {t('care.candidate.title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('care.candidate.desc')}</p>
        </div>

        {/* Verification status */}
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {isLoading
                    ? t('common.loading')
                    : care
                      ? t('care.candidate.statusLabel')
                      : t('care.candidate.notStarted')}
                </p>
                {!isLoading && care && (
                  <p className="text-sm text-muted-foreground">
                    {t(CARE_VERIFICATION_KEYS[care.verificationStatus] ?? 'care.status.unverified')}
                  </p>
                )}
              </div>
              {!isLoading && isPreScreened(care?.verificationStatus) && <PreScreenedBadge />}
            </div>
            {!isLoading && care?.verificationStatus === 'rejected' && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <ShieldAlert className="size-3.5" aria-hidden="true" />
                {t('care.candidate.rejected')}
              </p>
            )}
          </CardContent>
        </Card>

        <CaregiverScreeningForm userId={user?.id ?? ''} existing={care} />
        <CareSummaryDisclaimer />
      </div>
    </AuthGate>
  )
}
