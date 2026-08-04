import { useQuery } from '@tanstack/react-query'

import type { Job, Profile } from '@/types'

export interface AiMatchDetail {
  /** Overall match score (0-100) */
  score: number
  /** Skills alignment breakdown */
  skillsFit: { score: number; reasoning: string }
  /** Language proficiency alignment */
  languageFit: { score: number; reasoning: string }
  /** Experience / seniority alignment */
  experienceFit: { score: number; reasoning: string }
  /** Modality & location alignment */
  locationFit: { score: number; reasoning: string }
  /** Culture / sector fit */
  cultureFit: { score: number; reasoning: string }
  /** One-paragraph summary for the candidate */
  summary: string
  /** Top 3 strengths of this match */
  strengths: string[]
  /** 1-2 gaps the candidate might want to address */
  gaps: string[]
}

export interface AiMatchResult {
  jobId: string
  score: number
  detail: AiMatchDetail
}

function buildMatchPrompt(profile: Profile, job: Job): string {
  return `You are an expert bilingual recruitment analyst for Impulsa Talentos, a platform connecting Colombian bilingual professionals with top employers.

Analyze how well this CANDIDATE fits this JOB posting. Score each dimension (0-100), provide reasoning, a summary, strengths, and gaps.

CANDIDATE PROFILE:
- Bio: ${profile.bio || 'Not provided'}
- Languages: ${profile.languages || 'Not provided'}
- Location: ${profile.location || 'Not provided'}
- CV: ${profile.cvUrl ? 'Available' : 'Not uploaded'}

JOB POSTING:
- Title: ${job.title}
- Description: ${job.description.slice(0, 600)}
- Level: ${job.level || 'Not specified'}
- Location type: ${job.locationType || 'Not specified'}
- Required skills: ${job.skillsRequired || 'Not specified'}
- Required languages: ${job.languagesRequired || 'Not specified'}
- Salary range: ${job.currency || 'USD'} ${job.salaryMin || '?'} - ${job.salaryMax || '?'}

Important context:
- This is a Colombian bilingual talent market. English + Spanish is the baseline.
- Candidates are evaluated on technical skills, language proficiency, experience level, and cultural fit with international teams.
- Be honest but constructive. Even low-scoring matches should have helpful feedback.
- Focus on SPECIFIC evidence from the profile and job description, not generic praise.
- Score is NOT a pass/fail — it's a fit indicator. A 60% match can still be valuable.`
}

async function scoreSingleMatch(profile: Profile, job: Job): Promise<AiMatchResult> {
  try {
    const res = await fetch('/api/ai-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildMatchPrompt(profile, job) }),
    })
    if (!res.ok) throw new Error(`AI match failed (${res.status})`)
    const data = await res.json()
    const object = data.object as AiMatchDetail
    return {
      jobId: job.id,
      score: (object as AiMatchDetail).score,
      detail: object as AiMatchDetail,
    }
  } catch {
    // Fallback: return a neutral score on AI failure
    return {
      jobId: job.id,
      score: 30,
      detail: {
        score: 30,
        skillsFit: { score: 30, reasoning: 'Could not analyze — try again.' },
        languageFit: { score: 30, reasoning: 'Could not analyze — try again.' },
        experienceFit: { score: 30, reasoning: 'Could not analyze — try again.' },
        locationFit: { score: 30, reasoning: 'Could not analyze — try again.' },
        cultureFit: { score: 30, reasoning: 'Could not analyze — try again.' },
        summary: 'Match analysis unavailable. Please try again later.',
        strengths: [],
        gaps: ['Analysis could not be completed.'],
      },
    }
  }
}

export const aiMatchKeys = {
  all: ['aiMatches'] as const,
  forJob: (profileId: string, jobId: string) => ['aiMatches', profileId, jobId] as const,
  topMatches: (profileId: string) => ['aiMatches', 'top', profileId] as const,
}

/**
 * Score a single job against a candidate profile using AI.
 * Cached per profile+job pair.
 */
export function useAiMatchScore(profile: Profile | undefined | null, job: Job | undefined | null) {
  return useQuery({
    queryKey: aiMatchKeys.forJob(profile?.id ?? '', job?.id ?? ''),
    queryFn: () => scoreSingleMatch(profile!, job!),
    enabled: !!profile?.id && !!job?.id && !!(profile.bio || profile.languages || profile.location),
    staleTime: 10 * 60 * 1000, // 10 min cache
    retry: 1,
  })
}

/**
 * Score the top N jobs against a candidate profile.
 * Cached per profile. Use for dashboard "Best matches" panel.
 */
export function useAiTopMatches(profile: Profile | undefined | null, jobs: Job[] | undefined | null, limit = 3) {
  return useQuery({
    queryKey: aiMatchKeys.topMatches(profile?.id ?? ''),
    queryFn: async () => {
      if (!profile || !jobs?.length) return []
      const candidates = jobs.filter(j => j.status === 'open').slice(0, Math.min(limit * 2, 10))
      const results = await Promise.all(candidates.map(j => scoreSingleMatch(profile, j)))
      return results
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    },
    enabled: !!profile?.id && !!jobs?.length && !!(profile.bio || profile.languages || profile.location),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
