/**
 * Lightweight, deterministic match scoring between a candidate profile
 * and an open job posting. Used by the candidate dashboard's "Best
 * matches for you" panel.
 *
 * Score components (0–100 total):
 *   • Skills overlap (50 pts) — Jaccard-style token overlap of the
 *     candidate's `bio` + `languages` text vs the job's required
 *     skills. We bias the score toward smaller skill sets so a
 *     mid-level match isn't drowned by a single long bio.
 *   • Language level (20 pts) — substring match between the
 *     candidate's declared languages and the job's required level
 *     (A2 < B1 < B2 < C1 < C2). A weaker level gets partial credit;
 *     a stronger level still scores full.
 *   • Seniority (15 pts) — exact level match between the candidate's
 *     bio and the job's level ("Junior", "Mid", "Senior", etc.).
 *   • Modality (10 pts) — full credit if the job is remote, half
 *     credit if it's hybrid or unspecified. The candidate's
 *     preferred location is not always declared, so modality is
 *     always worth at least half credit.
 *   • Location (5 pts) — substring match between the candidate's
 *     city and the job's locationType text (e.g. "Medellin" in
 *     "Hibrido · Medellin").
 *
 * Everything runs on plain strings — no external service cost. Result is intended
 * as a quick "how relevant is this?" hint for the candidate, not a
 * real recommendation system.
 */
import type { Job, Profile } from '@/types'

export interface MatchScore {
  total: number
  skills: number
  language: number
  seniority: number
  modality: number
  location: number
  /** Short human-readable rationale for the score. */
  rationale: string[]
}

const LANGUAGE_RANK: Record<string, number> = {
  a1: 1, a2: 2,
  b1: 3, b2: 4, 'b2+': 4,
  c1: 5, c2: 6,
}

function tokens(s: string | null | undefined): string[] {
  if (!s) return []
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .split(/[^a-z0-9+#.]+/g)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && t.length <= 32)
}

function languageLevelScore(candidateLangs: string, jobLang: string): { score: number; hit: string | null } {
  const candTokens = tokens(candidateLangs)
  const jobTokens = tokens(jobLang)
  if (jobTokens.length === 0) return { score: 20, hit: null }

  // Find the highest CEFR rank the candidate claims in any language.
  let bestCandidateRank = 0
  for (const tok of candTokens) {
    if (tok in LANGUAGE_RANK) {
      bestCandidateRank = Math.max(bestCandidateRank, LANGUAGE_RANK[tok])
    }
  }
  // Find the rank the job requires (use the highest if multiple).
  let jobRank = 0
  for (const tok of jobTokens) {
    if (tok in LANGUAGE_RANK) {
      jobRank = Math.max(jobRank, LANGUAGE_RANK[tok])
    }
  }
  if (jobRank === 0) {
    // Job text doesn't reference a CEFR level — give partial credit
    // if the candidate mentions English/Spanish at all.
    const hasLang = /(ingles|english|spanish|espanol)/.test(candidateLangs.toLowerCase())
    return { score: hasLang ? 12 : 6, hit: null }
  }
  if (bestCandidateRank === 0) {
    return { score: 4, hit: 'no CEFR level declared' }
  }
  if (bestCandidateRank >= jobRank) {
    return { score: 20, hit: 'meets language level' }
  }
  // Off by one level: e.g. B1 applied to a B2 role
  const ratio = bestCandidateRank / jobRank
  return { score: Math.round(20 * ratio), hit: 'below required level' }
}

function skillsScore(candidateText: string, jobSkillsCsv: string): { score: number; matched: string[] } {
  const jobSkills = (jobSkillsCsv || '')
    .split(/[,;|]/)
    .map(s => s.trim())
    .filter(Boolean)
  if (jobSkills.length === 0) return { score: 50, matched: [] }

  const candTokens = new Set(tokens(candidateText))
  const matched: string[] = []
  for (const skill of jobSkills) {
    const skillTokens = tokens(skill)
    if (skillTokens.length === 0) continue
    // Match if ANY of the skill's tokens are in the candidate text.
    if (skillTokens.some(t => candTokens.has(t))) {
      matched.push(skill)
    }
  }
  // Jaccard-style: matched / union
  const score = Math.round(50 * (matched.length / jobSkills.length))
  return { score, matched }
}

function seniorityScore(candidateText: string, jobLevel: string): { score: number; hit: string | null } {
  if (!jobLevel) return { score: 8, hit: null }
  const cand = candidateText.toLowerCase()
  const job = jobLevel.toLowerCase()
  // Map job levels to canonical buckets.
  const bucket = (s: string): string => {
    if (/(junior|jr)/.test(s)) return 'junior'
    if (/(senior|sr|lead)/.test(s)) return 'senior'
    if (/(mid|intermediate)/.test(s)) return 'mid'
    return s
  }
  const jobBucket = bucket(job)
  const candBucket = bucket(cand)
  if (!candBucket) return { score: 8, hit: null }
  if (jobBucket === candBucket) return { score: 15, hit: 'level matches' }
  // Adjacent buckets (e.g. mid applied to senior) get half credit
  const adjacent =
    (jobBucket === 'mid' && candBucket !== 'mid') ||
    (jobBucket !== 'mid' && candBucket === 'mid')
  if (adjacent) return { score: 8, hit: 'level nearby' }
  return { score: 3, hit: 'level mismatch' }
}

function modalityScore(jobModality: string): { score: number; hit: string | null } {
  const m = (jobModality || '').toLowerCase()
  if (m.includes('remoto') || m.includes('remote')) return { score: 10, hit: 'remote-friendly' }
  if (m.includes('hibrido') || m.includes('hybrid')) return { score: 6, hit: 'hybrid' }
  if (m.includes('presencial') || m.includes('on-site') || m.includes('onsite')) {
    return { score: 3, hit: 'on-site' }
  }
  return { score: 6, hit: null }
}

function locationScore(candidateLoc: string, jobModality: string): { score: number; hit: string | null } {
  if (!candidateLoc) return { score: 0, hit: null }
  const candTokens = tokens(candidateLoc)
  if (candTokens.length === 0) return { score: 0, hit: null }
  const jobTokens = tokens(jobModality)
  const hit = candTokens.some(t => jobTokens.includes(t))
  return { score: hit ? 5 : 0, hit: hit ? 'location matches' : null }
}

/**
 * Score a single (profile, job) pair.
 */
export function scoreMatch(profile: Profile | null, job: Job): MatchScore {
  const candidateText = [
    profile?.bio || '',
    profile?.languages || '',
    profile?.location || '',
  ].join(' ')

  const skills = skillsScore(candidateText, job.skillsRequired)
  const language = languageLevelScore(profile?.languages || '', job.languagesRequired || '')
  const seniority = seniorityScore(candidateText, job.level || '')
  const modality = modalityScore(job.locationType || '')
  const location = locationScore(profile?.location || '', job.locationType || '')

  const total = Math.min(
    100,
    skills.score + language.score + seniority.score + modality.score + location.score,
  )

  const rationale: string[] = []
  if (skills.matched.length > 0) {
    rationale.push(
      skills.matched.length === 1
        ? `Matches: ${skills.matched[0]}`
        : `Matches ${skills.matched.length} skills: ${skills.matched.slice(0, 3).join(', ')}${
            skills.matched.length > 3 ? '…' : ''
          }`,
    )
  } else if (job.skillsRequired) {
    rationale.push('No direct skill overlap')
  }
  if (language.hit) rationale.push(language.hit)
  if (seniority.hit) rationale.push(seniority.hit)
  if (modality.hit) rationale.push(modality.hit)
  if (location.hit) rationale.push(location.hit)

  return { total, skills: skills.score, language: language.score, seniority: seniority.score, modality: modality.score, location: location.score, rationale }
}

/**
 * Convenience: score a batch of jobs and sort by total descending.
 */
export function rankJobs(profile: Profile | null, jobs: Job[]): Array<{ job: Job; score: MatchScore }> {
  return jobs
    .map(job => ({ job, score: scoreMatch(profile, job) }))
    .sort((a, b) => b.score.total - a.score.total)
}
