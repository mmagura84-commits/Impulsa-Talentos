import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Sparkles, X, ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import type { OnboardingStep } from '@/hooks/useOnboarding'

/**
 * Guided onboarding panel — shown on the dashboard while a new user still
 * has steps to complete (candidate: profile → CV → browse jobs; employer:
 * company → first job → review applications). Dismissible; auto-hides once
 * every step is done.
 */
export function OnboardingPanel({
  steps,
  onDismiss,
  onVisit,
}: {
  steps: OnboardingStep[]
  onDismiss: () => void
  /** Called before navigating to a step's CTA (marks visit-based steps done). */
  onVisit: (id: string) => void
}) {
  const { t } = useI18n()
  const doneCount = steps.filter((s) => s.done).length

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      aria-label={t('onboarding.title')}
      className="mb-8 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4.5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-foreground leading-tight">{t('onboarding.title')}</h2>
            <p className="text-xs text-muted-foreground">{t('onboarding.progress', { done: String(doneCount), total: String(steps.length) })}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
          aria-label={t('onboarding.dismiss')}
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${steps.length ? Math.round((doneCount / steps.length) * 100) : 0}%` }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id}>
            {step.done ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 opacity-70">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t(step.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(step.descKey)}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium text-emerald-600 uppercase tracking-wide">{t('onboarding.done')}</span>
              </div>
            ) : (
              <Link
                to={step.href as never}
                params={step.params as never}
                onClick={() => onVisit(step.id)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <Circle className="size-5 shrink-0 text-primary/60 group-hover:text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t(step.titleKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(step.descKey)}</p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {t('onboarding.go')}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </motion.section>
  )
}
