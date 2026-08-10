import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, createRow } from '@/lib/supabase'
import type { Message } from '@/types'

// ─── Query key factories ───

export const messageKeys = {
  all: ['messages'] as const,
  byApplication: (applicationId: string) => ['messages', 'byApplication', applicationId] as const,
}

// ─── Fetch helpers ───

async function fetchMessagesByApplication(applicationId: string): Promise<Message[]> {
  return listRows<Message>('messages', {
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  })
}

// ─── Hooks ───

/**
 * Fetch all messages for a specific application, ordered oldest-first.
 */
export function useApplicationMessages(applicationId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.byApplication(applicationId ?? ''),
    queryFn: () => fetchMessagesByApplication(applicationId!),
    enabled: !!applicationId,
  })
}

/** @deprecated — use useApplicationMessages instead; kept for existing employer page compat. */
export const useMessagesByApplication = useApplicationMessages

/**
 * Send a new message on an application thread.
 */
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      applicationId,
      senderId,
      body,
    }: {
      applicationId: string
      senderId: string
      body: string
    }) =>
      createRow<Message>('messages', {
        applicationId,
        senderId,
        body,
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: messageKeys.byApplication(variables.applicationId),
      })
    },
  })
}
