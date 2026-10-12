/** What a candidate's CV adds to their profile (pure; used by CvSuggestions). */
import type { CvExtracted } from '@/types'

export interface CvCurrent { skills: string; languages: string; years: string; role: string }
export interface CvPatch { skills?: string[]; languages?: string[]; years?: number; role?: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Spanish and Portuguese names, so "Inglés B2" on the profile counts as English. */
const LANG_ALIASES: Record<string, string[]> = {
  english: ['ingles'], spanish: ['espanol', 'castellano', 'espanhol'], portuguese: ['portugues'],
  french: ['frances', 'francais'], german: ['aleman', 'alemao'], italian: ['italiano'],
}

/** What the CV adds to the profile (pure; exported for tests). */
export function cvSuggestions(x: CvExtracted, cur: CvCurrent): CvPatch {
  const have = new Set(cur.skills.split(',').map(norm).filter(Boolean))
  const skills = x.skills.filter(s => !have.has(norm(s))).slice(0, 12)
  const langsText = norm(cur.languages)
  const languages = x.languages
    .filter(l => {
      const n = norm(l.name)
      return n && ![n, ...(LANG_ALIASES[n] ?? [])].some(a => langsText.includes(a))
    })
    .map(l => (l.level === 'unknown' ? l.name : `${l.name} ${l.level}`))
  const out: CvPatch = {}
  if (skills.length) out.skills = skills
  if (languages.length) out.languages = languages
  if (!cur.years.trim() && x.years_experience != null) out.years = Math.round(x.years_experience)
  const role = x.desired_role || x.current_title
  if (!cur.role.trim() && role) out.role = role
  return out
}
