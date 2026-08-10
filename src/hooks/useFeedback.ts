import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, createRow, updateRow, deleteRow } from '@/lib/supabase'
import type { ApplicationFeedback, FeedbackVisibility } from '@/types'

// ─── Query key factories ───

export const feedbackKeys = {
  all: ['applicationFeedback'] as const,
  byApplication: (applicationId: string) =>
    ['applicationFeedback', 'byApplication', applicationId] as const,
  detail: (id: string) => ['applicationFeedback', 'detail', id] as const,
}

// ─── Fetch helpers ───

async function fetchFeedbackByApplication(
  applicationId: string,
): Promise<ApplicationFeedback[]> {
  return listRows<ApplicationFeedback>('application_feedback', {
    where: { applicationId },
    orderBy: { createdAt: 'desc' },
  })
}

// ─── Hooks ───

/** List structured feedback for one application (newest first). */
export function useFeedbackForApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: feedbackKeys.byApplication(applicationId ?? ''),
    queryFn: () => fetchFeedbackByApplication(applicationId!),
    enabled: !!applicationId,
  })
}

/** Create a new feedback entry for an application. */
export function useCreateFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      applicationId: string
      authorId: string
      companyId: string
      stage?: string
      rating?: number | null
      strengths?: string
      concerns?: string
      nextSteps?: string
      visibility: FeedbackVisibility
    }) => createRow<ApplicationFeedback>('application_feedback', input),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: feedbackKeys.byApplication(variables.applicationId),
      })
    },
  })
}

/** Update an existing feedback entry (stage/rating/text/visibility). */
export function useUpdateFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<
        Pick<
          ApplicationFeedback,
          'stage' | 'rating' | 'strengths' | 'concerns' | 'nextSteps' | 'visibility'
        >
      >
    }) =>
      updateRow('application_feedback', id, {
        ...data,
        updatedAt: new Date().toISOString(),
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all })
      queryClient.invalidateQueries({ queryKey: feedbackKeys.detail(variables.id) })
    },
  })
}

/** Delete a feedback entry. */
export function useDeleteFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, applicationId }: { id: string; applicationId: string }) =>
      deleteRow('application_feedback', id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: feedbackKeys.byApplication(variables.applicationId),
      })
    },
  })
}
