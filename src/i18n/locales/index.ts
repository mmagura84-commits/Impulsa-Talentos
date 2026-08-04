/**
 * Per-locale dictionary index. Each locale is split across multiple
 * files (base + jobs + employer + dashboard) to keep each file small
 * and easy to maintain. The exported `dictionaries` map merges the
 * pieces at module load time.
 */
import enBase from './en'
import enJobs from './en.jobs'
import enEmployer from './en.employer'
import enDashboard from './en.dashboard'
import enHq from './en.hq'
import esBase from './es'
import esJobs from './es.jobs'
import esEmployer from './es.employer'
import esDashboard from './es.dashboard'
import esHq from './es.hq'

import type { Dict } from '../types'

export const dictionaries: Record<'en' | 'es', Dict> = {
  en: { ...enBase, ...enJobs, ...enEmployer, ...enDashboard, ...enHq },
  es: { ...esBase, ...esJobs, ...esEmployer, ...esDashboard, ...esHq },
}
