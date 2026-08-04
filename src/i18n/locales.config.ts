/**
 * Locale metadata: labels for the language toggle, default locale,
 * flag glyphs used in compact UI surfaces.
 */
import type { Locale } from './types'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  en: 'EN',
  es: 'ES',
}

export const defaultLocale: Locale = 'en'
