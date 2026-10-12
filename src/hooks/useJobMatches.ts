/**
 * Stored match scores (migration 048: job_matches), the same number for the
 * candidate and the employer, with a structured "why you match".
 *
 * Row-level security decides what comes back: a candidate gets their own
 * rows, an employer only rows for candidates who applied to their jobs, HQ all.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

import type { JobMatch, MatchDetail } from '@/lib/matchReasons'
export { MATCH_WEIGHTS, matchReasons, displaySkill, type MatchDetail, type JobMatch } from '@/lib/matchReasons'

type Row = { job_id: string; profile_id: string; score: number; eligible: boolean; detail: MatchDetail; computed_at: string }
const toMatch = (r: Row): JobMatch => ({
  jobId: r.job_id, profileId: r.profile_id, score: r.score, eligible: r.eligible, detail: r.detail, computedAt: r.computed_at,
})
const COLS = 'job_id, profile_id, score, eligible, detail, computed_at'

export const jobMatchKeys = {
  mine: (profileId: string) => ['jobMatches', 'profile', profileId] as const,
  forJob: (jobId: string) => ['jobMatches', 'job', jobId] as const,
}

/** A candidate's scored jobs, best first. */
export function useMyJobMatches(profileId: string | undefined) {
  return useQuery({
    queryKey: jobMatchKeys.mine(profileId ?? ''),
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('job_matches').select(COLS)
        .eq('profile_id', profileId!).order('score', { ascending: false }).limit(50)
      if (error) return [] as JobMatch[]   // table not there yet / offline: callers fall back
      return ((data ?? []) as Row[]).map(toMatch)
    },
  })
}

/** Scores for one job's applicants (employer) or every candidate (HQ). */
export function useJobApplicantMatches(jobId: string | undefined) {
  return useQuery({
    queryKey: jobMatchKeys.forJob(jobId ?? ''),
    enabled: !!jobId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('job_matches').select(COLS).eq('job_id', jobId!)
      if (error) return new Map<string, JobMatch>()
      return new Map(((data ?? []) as Row[]).map(r => [r.profile_id, toMatch(r)]))
    },
  })
}
