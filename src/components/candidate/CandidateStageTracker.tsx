import { useI18n } from '@/i18n/I18nProvider'
import {
  CANDIDATE_STAGES,
  candidateNextStepKey,
  candidateStageIndex,
  candidateStageTone,
} from '@/lib/applicationStatus'

/**
 * Five-step tracker for candidates: Applied · In review · Interviewing ·
 * Offer · Decision, with the current step highlighted and one line on what
 * happens next. Employers keep the detailed pipeline.
 */
export function CandidateStageTracker({ status, className = '' }: { status: string; className?: string }) {
  const { t } = useI18n()
  const current = candidateStageIndex(status)
  const tone = candidateStageTone(status)
  const fill = tone === 'good' ? 'bg-emerald-500' : tone === 'ended' ? 'bg-muted-foreground/60' : 'bg-primary'
  return (
    <div className={`space-y-1.5 ${className}`}>
      <ol className="grid grid-cols-5 gap-1" aria-label={t('candidateStage.trackerLabel')}>
        {CANDIDATE_STAGES.map((stage, i) => (
          <li key={stage} className="min-w-0" aria-current={i === current ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full ${i <= current ? fill : 'bg-muted'}`} />
            <span className={`mt-1 block truncate text-xs sm:text-[10px] ${i === current ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              {t(`candidateStage.${stage}`)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{t(candidateNextStepKey(status))}</p>
    </div>
  )
}
