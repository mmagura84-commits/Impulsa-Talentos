/**
 * Lightweight, deterministic match scoring between a candidate profile
 * and an open job posting. Used by the candidate dashboard's "Best
 * matches for you" panel.
 *
 * Score components (0–100 total, capped):
 *   • Skills overlap (50 pts) — Jaccard-style overlap between the
 *     candidate's structured `skills` array (fallback: tokenized
 *     `bio` + `languages` text) and the job's required skills. We
 *     bias the score toward smaller skill sets so a mid-level match
 *     isn't drowned by a single long bio.
 *   • Language level (20 pts) — substring match between the
 *     candidate's declared languages and the job's required level
 *     (A2 < B1 < B2 < C1 < C2). A weaker level gets partial credit;
 *     a stronger level still scores full.
 *   • Seniority (15 pts) — level match between the job's level
 *     ("Junior", "Mid", "Senior", etc.) and the candidate's
 *     `experienceYears` (0–2 junior, 3–5 mid, 6+ senior); falls back
 *     to seniority keywords in the bio when years are absent.
 *   • Modality (10 pts) — full credit if the job is remote, half
 *     credit if it's hybrid or unspecified. The candidate's
 *     preferred location is not always declared, so modality is
 *     always worth at least half credit.
 *   • Location (5 pts) — substring match between the candidate's
 *     city and the job's locationType text (e.g. "Medellin" in
 *     "Hibrido · Medellin").
 *   • Desired-role bonus (up to 5 pts) — token overlap between the
 *     candidate's `desiredRole` and the job title.
 *
 * The enrichment fields (skills, experienceYears, desiredRole) are all
 * OPTIONAL: profiles that predate migration 005 degrade gracefully to
 * the bio/languages heuristics. Everything runs on plain strings — no
 * external service cost. Result is intended as a quick "how relevant is
 * this?" hint for the candidate, not a real recommendation system.
 */
import type { Job, Profile } from '@/types'
export interface MatchScore {
  total: number
  skills: number
  language: number
  seniority: number
  modality: number
  location: number
  /** Desired-role vs job-title overlap bonus (0–5). */
  title: number
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
/** Single-skill normalizer: lowercase, strip accents, collapse spaces. */
function normalizeSkill(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
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
/**
 * Skills overlap. Structured `profileSkills` take precedence; when absent
 * (pre-enrichment profiles) the candidate's free text is tokenized instead,
 * preserving the original behavior.
 */
function skillsScore(
  profileSkills: string[] | undefined,
  candidateText: string,
  jobSkillsCsv: string,
): { score: number; matched: string[] } {
  const jobSkills = (jobSkillsCsv || '')
    .split(/[,;|]/)
    .map(s => s.trim())
    .filter(Boolean)
  if (jobSkills.length === 0) return { score: 50, matched: [] }
  const declared = new Set(
    (profileSkills ?? []).map(normalizeSkill).filter(Boolean),
  )
  const textTokens = new Set(tokens(candidateText))
  const matched: string[] = []
  for (const skill of jobSkills) {
    const norm = normalizeSkill(skill)
    if (!norm) continue
    let hit: boolean
    if (declared.size > 0) {
      // Exact normalized equality, or a prefix overlap ("React" ⇄ "React.js",
      // "customer service" ⇄ "customer service specialist").
      hit =
        declared.has(norm) ||
        [...declared].some(
          d => d.startsWith(norm) || norm.startsWith(d),
        )
    } else {
      // Legacy fallback: any of the skill's tokens appear in bio/languages.
      hit = tokens(skill).some(t => textTokens.has(t))
    }
    if (hit) matched.push(skill)
  }
  // Jaccard-style: matched / union
  const score = Math.round(50 * (matched.length / jobSkills.length))
  return { score, matched }
}
/** Map structured years of experience to a seniority bucket. */
function experienceBucket(years: number | undefined | null): string | null {
  if (years === undefined || years === null || Number.isNaN(years)) return null
  if (years <= 2) return 'junior'
  if (years <= 5) return 'mid'
  return 'senior'
}
function seniorityScore(
  candidateText: string,
  experienceYears: number | undefined,
  jobLevel: string,
): { score: number; hit: string | null } {
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
  // Structured experience years take precedence; fall back to bio keywords.
  const candBucket = experienceBucket(experienceYears) ?? bucket(cand)
  if (!candBucket) return { score: 8, hit: null }
  if (jobBucket === candBucket) return { score: 15, hit: 'level matches' }
  // Adjacent buckets (e.g. mid applied to senior) get half credit
  const adjacent =
    (jobBucket === 'mid' && candBucket !== 'mid') ||
    (jobBucket !== 'mid' && candBucket === 'mid')
  if (adjacent) return { score: 8, hit: 'level nearby' }
  return { score: 3, hit: 'level mismatch' }
}
/** Bonus for desired-role vs job-title token overlap (0–5). */
function titleScore(
  desiredRole: string | undefined,
  jobTitle: string,
): { score: number; hit: string | null } {
  const role = desiredRole?.trim()
  if (!role || !jobTitle) return { score: 0, hit: null }
  const filler = new Set([
    'senior', 'junior', 'mid', 'lead', 'sr', 'jr',
    'bilingual', 'full', 'stack', 'engineer', 'developer',
  ])
  const roleTokens = tokens(role).filter(t => !filler.has(t))
  const titleTokens = new Set(tokens(jobTitle))
  if (roleTokens.length === 0 || titleTokens.size === 0) return { score: 0, hit: null }
  let overlap = 0
  for (const t of roleTokens) {
    if (titleTokens.has(t)) overlap++
  }
  if (overlap === 0) return { score: 0, hit: null }
  const score = Math.min(5, Math.round(5 * (overlap / roleTokens.length)))
  return {
    score,
    hit: overlap >= roleTokens.length ? 'role matches job title' : 'role partially matches title',
  }
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
  const skills = skillsScore(profile?.skills, candidateText, job.skillsRequired)
  const language = languageLevelScore(profile?.languages || '', job.languagesRequired || '')
  const seniority = seniorityScore(candidateText, profile?.experienceYears, job.level || '')
  const modality = modalityScore(job.locationType || '')
  const location = locationScore(profile?.location || '', job.locationType || '')
  const title = titleScore(profile?.desiredRole, job.title)
  const total = Math.min(
    100,
    skills.score + language.score + seniority.score + modality.score + location.score + title.score,
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
  if (title.hit) rationale.push(title.hit)
  return {
    total,
    skills: skills.score,
    language: language.score,
    seniority: seniority.score,
    modality: modality.score,
    location: location.score,
    title: title.score,
    rationale,
  }
}
/**
 * Convenience: score a batch of jobs and sort by total descending.
 */
export function rankJobs(profile: Profile | null, jobs: Job[]): Array<{ job: Job; score: MatchScore }> {
  return jobs
    .map(job => ({ job, score: scoreMatch(profile, job) }))
    .sort((a, b) => b.score.total - a.score.total)
}
