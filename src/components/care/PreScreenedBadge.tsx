import { ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

/** Trust badge shown on caregivers who have passed admin screening. */
export function PreScreenedBadge({ className }: { className?: string }) {
  const { t } = useI18n()
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-500/30 ${className ?? ''}`}
      title={t('care.badge.preScreened')}
    >
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {t('care.badge.preScreened')}
    </span>
  )
}
