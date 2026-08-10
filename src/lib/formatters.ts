/** Locale-aware formatting helpers that safely handle nullable API values. */
export function formatNumber(value: number | null | undefined, locale: string = 'en-US'): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(locale) : '?'
}
