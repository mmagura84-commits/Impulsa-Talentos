/**
 * Language toggle — switches between English and Spanish.
 * Persists to localStorage via I18nProvider.
 */
import { Languages, Check } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { LOCALE_LABELS, type Locale } from '@/i18n/translations'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface LanguageToggleProps {
  className?: string
  /** Render as compact icon-only toggle (true) or full pill (false). */
  compact?: boolean
  /** When true, render as a vertical list inside a menu/popover. */
  asList?: boolean
}

const LOCALES: Locale[] = ['en', 'es']

export function LanguageToggle({ className, compact = false, asList = false }: LanguageToggleProps) {
  const { locale, setLocale, t } = useI18n()

  // Vertical list (for inside menus)
  if (asList) {
    return (
      <div className={cn('w-full', className)} role="menu">
        <p className="px-2 pt-1 pb-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          {t('common.language')}
        </p>
        <div className="space-y-0.5">
          {LOCALES.map((l) => {
            const active = l === locale
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md text-sm transition-colors px-3 py-2 cursor-pointer',
                  active
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 w-7 rounded-sm border border-border bg-card text-[10px] font-semibold text-foreground/80">
                    {l.toUpperCase()}
                  </span>
                  {LOCALE_LABELS[l]}
                </span>
                {active && <Check className="size-3.5 text-primary" />}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Compact: just shows the OTHER locale and a globe icon
  if (compact) {
    const other: Locale = locale === 'en' ? 'es' : 'en'
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLocale(other)}
            className={cn('h-8 px-2.5 gap-1.5 text-muted-foreground hover:text-foreground', className)}
            aria-label={t('common.language')}
          >
            <Languages className="size-4" />
            <span className="text-[11px] font-semibold tracking-wider">
              {other.toUpperCase()}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {LOCALE_LABELS[other]}
        </TooltipContent>
      </Tooltip>
    )
  }

  // Pill: shows a globe + current locale code
  const other: Locale = locale === 'en' ? 'es' : 'en'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLocale(other)}
          className={cn('h-8 gap-1.5 px-2.5', className)}
          aria-label={t('common.language')}
        >
          <Languages className="size-3.5" />
          <span className="text-xs font-semibold tracking-wider">
            {locale.toUpperCase()}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {LOCALE_LABELS[other]}
      </TooltipContent>
    </Tooltip>
  )
}
