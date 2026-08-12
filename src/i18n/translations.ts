/**
 * Public translations entrypoint. The dictionaries themselves have
 * been split into per-locale files under `./locales/` to keep each
 * file under a couple hundred lines. This module re-exports the
 * public types and the merged `dictionaries` map.
 */
export { dictionaries, loadLocaleDict } from './locales'
export { defaultLocale } from './locales.config'
export type { Locale, Dict } from './types'
export { LOCALE_LABELS, LOCALE_FLAGS } from './locales.config'
