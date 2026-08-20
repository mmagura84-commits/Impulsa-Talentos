import { Info, ShieldAlert } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

/**
 * Vetting-limitation + Law 1581 privacy disclaimer (scope item 6).
 * Rendered on the caregiver onboarding surface, the household posting
 * surface, and the caregiver directory, so the platform is always honest
 * that screening is document-review based and that we are a matchmaking /
 * screening service — NOT an employer.
 */
export function CareSummaryDisclaimer({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="rounded-lg border border-muted bg-muted/30 p-4 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">{t('care.disclaimer.title')}</p>
          <p>{t('care.disclaimer.vetting')}</p>
          <p>{t('care.disclaimer.notEmployer')}</p>
          {!compact && (
            <div className="flex items-start gap-1.5 pt-1">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p>{t('care.disclaimer.privacy')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
