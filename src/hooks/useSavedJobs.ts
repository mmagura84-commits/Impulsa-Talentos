/**
 * Saved-jobs hooks.
 * The `saved_jobs` table is keyed on (candidate_id, job_id) — duplicates
 * are guarded client-side via a `useSavedJobIds` set that all components
 * share, so two clicks in quick succession on the heart button won't
 * create a duplicate row.
 */
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { SavedJob, Job } from '@/types'


export const savedJobKeys = {
  all: ['savedJobs'] as const,
  byCandidate: (candidateId: string) =>
    ['savedJobs', 'byCandidate', candidateId] as const,
  ids: (candidateId: string) =>
    ['savedJobs', 'ids', candidateId] as const,
  jobsForCandidate: (candidateId: string) =>
    ['savedJobs', 'jobsForCandidate', candidateId] as const,
}

async function fetchSavedJobs(candidateId: string): Promise<SavedJob[]> {
  return listRows<SavedJob>('saved_jobs', {
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Resolve a candidate's saved jobs into the full Job rows, joined in
 * memory. The `saved_jobs` table only stores (candidateId, jobId), so
 * we have to fetch the jobs separately. To avoid N+1 fetches, we
 * collect the job ids and run a single `in`-style list via SQLite
 * through the SDK's `OR` filter.
 */
async function fetchSavedJobsFull(candidateId: string): Promise<Job[]> {
  const rows = await listRows<SavedJob>('saved_jobs', {
    where: { candidateId },
    orderBy: { createdAt: 'desc' },
  })
  if (rows.length === 0) return []

  const jobIds = rows.map(r => r.jobId).filter(Boolean)
  const jobs = await listRows<Job>('jobs', { orderBy: { createdAt: 'desc' } })

  // Preserve the saved order (newest saves first) and filter out any
  // jobs that have since been deleted.
  const byId = new Map(jobs.map(j => [j.id, j]))
  return jobIds
    .map(id => byId.get(id))
    .filter((j): j is Job => !!j)
}

/**
 * All saved-jobs rows for a candidate. Used to render the dashboard
 * "Saved Jobs" tab + to power `useSavedJobIds`.
 */
export function useSavedJobs(candidateId: string | undefined) {
  return useQuery({
    queryKey: candidateId ? savedJobKeys.byCandidate(candidateId) : ['savedJobs', 'none'],
    queryFn: () => fetchSavedJobs(candidateId!),
    enabled: !!candidateId,
  })
}

/**
 * A derived Set<string> of job ids the candidate has saved. Cheaper
 * than scanning the full list inside every job card.
 */
export function useSavedJobIds(candidateId: string | undefined): Set<string> {
  const { data } = useSavedJobs(candidateId)
  return useMemo(() => new Set((data ?? []).map(s => s.jobId)), [data])
}

/**
 * Full Job rows for the candidate's saved jobs. Used by the dashboard
 * "Saved Jobs" panel.
 */
export function useMySavedJobs(candidateId: string | undefined) {
  return useQuery({
    queryKey: candidateId
      ? savedJobKeys.jobsForCandidate(candidateId)
      : ['savedJobs', 'jobsForCandidate', 'none'],
    queryFn: () => fetchSavedJobsFull(candidateId!),
    enabled: !!candidateId,
  })
}

/**
 * Save a job for the current candidate. Idempotent — if the row
 * already exists, the API will reject the duplicate (UNIQUE constraint)
 * and the mutation treats that as a no-op.
 */
export function useSaveJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      candidateId,
      jobId,
    }: {
      candidateId: string
      jobId: string
    }) =>
      createRow<SavedJob>('saved_jobs', { candidateId, jobId } as unknown as Omit<SavedJob, 'id' | 'createdAt'>),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: savedJobKeys.all })
      queryClient.invalidateQueries({ queryKey: savedJobKeys.ids(variables.candidateId) })
      queryClient.invalidateQueries({ queryKey: savedJobKeys.byCandidate(variables.candidateId) })
    },
  })
}

/**
 * Unsave a job. Looks up the row by (candidateId, jobId) so callers
 * don't have to track the savedJobs.id.
 */
export function useUnsaveJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      candidateId,
      jobId,
    }: {
      candidateId: string
      jobId: string
    }) => {
      const rows = await listRows<SavedJob>('saved_jobs', {
        where: { candidateId, jobId } as any,
        limit: 1,
      })
      const row = rows[0]
      if (!row) return null
      return deleteRow('saved_jobs', row.id)
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: savedJobKeys.all })
      queryClient.invalidateQueries({ queryKey: savedJobKeys.ids(variables.candidateId) })
      queryClient.invalidateQueries({ queryKey: savedJobKeys.byCandidate(variables.candidateId) })
    },
  })
}
