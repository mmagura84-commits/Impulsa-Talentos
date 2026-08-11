import type { Locale } from '@/i18n/types'

/**
 * Locale-aware, null-safe salary formatting shared by every salary render.
 *
 * Guards against null / undefined / NaN — a live job with missing salary
 * fields must never crash a render (pre-existing defect surfaced by QA's
 * post-publish smoke for PR #101: `TypeError: Cannot read properties of
 * null (reading 'toLocaleString')` on the public home page).
 */
export function formatSalaryValue(
  value: number | null | undefined,
  locale: Locale,
): string {
  if (value == null || Number.isNaN(value)) return '?'
  return value.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US')
}
