import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, createRow, updateRow, snakeToCamel, supabase } from '@/lib/supabase'
import type {
  Interview,
  InterviewStatus,
  InterviewType,
  InterviewScorecard,
  ScorecardRecommendation,
} from '@/types'

// ─── Query key factories ───

export const interviewKeys = {
  all: ['interviews'] as const,
  byJob: (jobId: string) => ['interviews', 'byJob', jobId] as const,
  upcoming: (companyId: string) => ['interviews', 'upcoming', companyId] as const,
  detail: (id: string) => ['interviews', 'detail', id] as const,
  scorecards: (interviewId: string) => ['interviews', 'scorecards', interviewId] as const,
}

// ─── Fetch helpers ───

async function fetchInterviewsByJob(jobId: string): Promise<Interview[]> {
  return listRows<Interview>('interviews', {
    where: { jobId },
    orderBy: { scheduledAt: 'asc' },
  })
}

async function fetchUpcomingInterviews(companyId: string): Promise<Interview[]> {
  const { data, error } = await supabase
    .from('interviews')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'scheduled')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
  if (error) {
    throw new Error(`[supabase:interviews] ${error.message}`)
  }
  return (data ?? []).map((row) => snakeToCamel<Interview>(row as Record<string, unknown>))
}

async function fetchScorecardsByInterview(interviewId: string): Promise<InterviewScorecard[]> {
  return listRows<InterviewScorecard>('interview_scorecards', {
    where: { interviewId },
    orderBy: { createdAt: 'asc' },
  })
}

// ─── Hooks: interviews ───

/** List all interviews scheduled for a job. */
export function useInterviewsByJob(jobId: string | undefined) {
  return useQuery({
    queryKey: interviewKeys.byJob(jobId ?? ''),
    queryFn: () => fetchInterviewsByJob(jobId!),
    enabled: !!jobId,
  })
}

/** List upcoming (future, still-scheduled) interviews for a company. */
export function useUpcomingInterviews(companyId: string | undefined) {
  return useQuery({
    queryKey: interviewKeys.upcoming(companyId ?? ''),
    queryFn: () => fetchUpcomingInterviews(companyId!),
    enabled: !!companyId,
  })
}

/** Schedule a new interview for a candidate on a job. */
export function useCreateInterview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      jobId,
      candidateId,
      companyId,
      scheduledAt,
      durationMinutes,
      type,
      locationOrLink,
      notes,
      createdBy,
    }: {
      jobId: string
      candidateId: string
      companyId: string
      scheduledAt: string
      durationMinutes: number
      type: InterviewType
      locationOrLink?: string
      notes?: string
      createdBy?: string
    }) =>
      createRow<Interview>('interviews', {
        jobId,
        candidateId,
        companyId,
        scheduledAt,
        durationMinutes,
        type,
        locationOrLink,
        notes,
        createdBy,
        status: 'scheduled' as InterviewStatus,
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.byJob(variables.jobId) })
      queryClient.invalidateQueries({ queryKey: interviewKeys.upcoming(variables.companyId) })
    },
  })
}

/** Update an interview (reschedule, change type/link/notes, mark completed, etc.). */
export function useUpdateInterview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<
        Pick<
          Interview,
          'scheduledAt' | 'durationMinutes' | 'type' | 'status' | 'locationOrLink' | 'notes'
        >
      >
    }) =>
      updateRow('interviews', id, { ...data, updatedAt: new Date().toISOString() }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all })
      queryClient.invalidateQueries({ queryKey: interviewKeys.detail(variables.id) })
    },
  })
}

/** Convenience mutation: cancel a scheduled interview. */
export function useCancelInterview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, companyId }: { id: string; companyId: string }) =>
      updateRow('interviews', id, {
        status: 'cancelled' as InterviewStatus,
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.all })
      queryClient.invalidateQueries({ queryKey: interviewKeys.upcoming(variables.companyId) })
    },
  })
}

// ─── Hooks: scorecards ───

/** List all scorecards for an interview. */
export function useScorecards(interviewId: string | undefined) {
  return useQuery({
    queryKey: interviewKeys.scorecards(interviewId ?? ''),
    queryFn: () => fetchScorecardsByInterview(interviewId!),
    enabled: !!interviewId,
  })
}

/** Submit a scorecard for a completed interview. */
export function useSubmitScorecard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      interviewId,
      reviewerId,
      overallRating,
      strengths,
      concerns,
      recommendation,
    }: {
      interviewId: string
      reviewerId: string
      overallRating: number
      strengths?: string
      concerns?: string
      recommendation: ScorecardRecommendation
    }) =>
      createRow<InterviewScorecard>('interview_scorecards', {
        interviewId,
        reviewerId,
        overallRating,
        strengths,
        concerns,
        recommendation,
        submittedAt: new Date().toISOString(),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: interviewKeys.scorecards(variables.interviewId) })
    },
  })
}
