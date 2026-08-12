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

/** Load a dictionary, dynamic-importing non-default locales on demand. */
export async function loadLocaleDict(locale: Locale): Promise<Dict> {
  if (locale === 'en') return dictionaries.en
  const [base, jobs, employer, dashboard, hq] = await Promise.all([
    import('./es'),
    import('./es.jobs'),
    import('./es.employer'),
    import('./es.dashboard'),
    import('./es.hq'),
  ])
  return { ...base.default, ...jobs.default, ...employer.default, ...dashboard.default, ...hq.default }
}
