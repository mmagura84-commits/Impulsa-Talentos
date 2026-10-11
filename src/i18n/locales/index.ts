/**
 * Per-locale dictionary index. Each locale is split across multiple
 * files (base + jobs + employer + dashboard) to keep each file small
 * and easy to maintain.
 *
 * The DEFAULT locale dictionary (`en`) is merged statically so it is
 * always available (SSR, first paint, soft fallback). Non-default
 * locales are loaded on demand via `loadLocaleDict()` so their
 * dictionaries are emitted as separate async chunks instead of
 * inflating the initial bundle (index chunk reduction, bff36fa1).
 */
import enBase from './en'
import enJobs from './en.jobs'
import enEmployer from './en.employer'
import enDashboard from './en.dashboard'
import enHq from './en.hq'
import type { Dict, Locale } from '../types'

export const dictionaries: Record<'en', Dict> = {
  en: { ...enBase, ...enJobs, ...enEmployer, ...enDashboard, ...enHq },
}

type DictModule = { default: Partial<Dict> }

/**
 * Static import() literals per locale so Vite can analyze them (no
 * "dynamic import cannot be analyzed" warning) and still emit each
 * dictionary as its own async chunk.
 */
const localeLoaders: Record<Exclude<Locale, 'en'>, () => Promise<DictModule[]>> = {
  es: () =>
    Promise.all([
      import('./es'),
      import('./es.jobs'),
      import('./es.employer'),
      import('./es.dashboard'),
      import('./es.hq'),
    ]),
  pt: () =>
    Promise.all([
      import('./pt'),
      import('./pt.jobs'),
      import('./pt.employer'),
      import('./pt.dashboard'),
      import('./pt.hq'),
    ]),
}

/** Load a dictionary, dynamic-importing non-default locales on demand. */
export async function loadLocaleDict(locale: Locale): Promise<Dict> {
  if (locale === 'en') return dictionaries.en
  const modules = await localeLoaders[locale]()
  return Object.assign({}, ...modules.map((m) => m.default)) as Dict
}
