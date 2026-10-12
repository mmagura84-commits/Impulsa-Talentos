/**
 * Match score shapes and plain-language reasons (pure; no data access).
 * Scores come from migration 048 (job_matches); see src/hooks/useJobMatches.ts.
 */
export interface MatchDetail {
  score: number
  eligible: boolean
  version: string
  components: { skills: number; language: number; experience: number; salary: number; location: number; role: number }
  skills: { matched: string[]; missing: string[]; from_cv: string[]; total: number }
  languages: { lang: string; req: number; has: number; ok: boolean }[]
  experience: { years: number | null; band: string | null; state: string }
  salary: string
  location: string
}

export interface JobMatch {
  jobId: string
  profileId: string
  score: number
  eligible: boolean
  detail: MatchDetail
  computedAt: string
}

/** Weight of each component in the 0–100 score (kept in step with 048). */
export const MATCH_WEIGHTS: { key: keyof MatchDetail['components']; weight: number }[] = [
  { key: 'skills', weight: 40 },
  { key: 'language', weight: 20 },
  { key: 'experience', weight: 15 },
  { key: 'salary', weight: 10 },
  { key: 'location', weight: 10 },
  { key: 'role', weight: 5 },
]

const LEVELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

/** Show a canonical skill with the job's own spelling when it is the same skill. */
export function displaySkill(canonical: string, jobSkillsCsv?: string): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+#.]+/g, ' ').trim()
  const original = (jobSkillsCsv ?? '').split(/[,;|]/).map(s => s.trim()).find(s => norm(s) === canonical)
  return original || canonical.charAt(0).toUpperCase() + canonical.slice(1)
}

/** Plain-language reasons, most useful first. `t` is the i18n function. */
export function matchReasons(
  d: MatchDetail,
  t: (key: string, vars?: Record<string, string | number>) => string,
  jobSkillsCsv?: string,
): string[] {
  const out: string[] = []
  const level = (n: number) => (n >= 6 ? t('match.level.native') : LEVELS[n] || t('match.level.none'))
  if (d.skills.total > 0) {
    out.push(t('match.why.skills', { n: d.skills.matched.length, total: d.skills.total }))
    if (d.skills.missing.length) out.push(t('match.why.missing', { skills: d.skills.missing.slice(0, 3).map(s => displaySkill(s, jobSkillsCsv)).join(', ') }))
  }
  for (const l of d.languages) {
    if (l.lang === 'spanish' && l.ok) continue  // assumed for Colombian candidates; not worth a line
    const vars = { lang: t(`match.lang.${l.lang}`), has: level(l.has), req: level(l.req) }
    out.push(t(l.ok ? 'match.why.langOk' : 'match.why.langGap', vars))
  }
  const loc = { remote: 'match.why.remote', same_city: 'match.why.sameCity', relocate: 'match.why.relocate', other_city: 'match.why.otherCity', wants_remote: 'match.why.otherCity' }[d.location]
  if (loc) out.push(t(loc))
  const sal = { fits: 'match.why.salaryFits', close: 'match.why.salaryClose', below: 'match.why.salaryBelow' }[d.salary]
  if (sal) out.push(t(sal))
  if (d.experience.state === 'fits') out.push(t('match.why.expFits', { years: d.experience.years ?? 0 }))
  else if (d.experience.state === 'close' || d.experience.state === 'less') out.push(t('match.why.expLess', { years: d.experience.years ?? 0 }))
  else if (d.experience.state === 'more') out.push(t('match.why.expMore', { years: d.experience.years ?? 0 }))
  return out
}
