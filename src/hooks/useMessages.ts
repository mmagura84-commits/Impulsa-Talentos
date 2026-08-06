import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, createRow } from '@/lib/supabase'
import type { Message } from '@/types'

export const messageKeys = {
  all: ['messages'] as const,
  byApplication: (applicationId: string) => ['messages', 'byApplication', applicationId] as const,
  byCompany: (companyId: string) => ['messages', 'byCompany', companyId] as const,
}

/** Fetch messages for a specific application thread. */
export function useMessagesByApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: messageKeys.byApplication(applicationId ?? ''),
    queryFn: () =>
      listRows<Message>('messages', {
        where: { applicationId: applicationId! },
        orderBy: { createdAt: 'asc' },
      }),
    enabled: !!applicationId,
  })
}

/** Send a message in an application thread. */
export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Message, 'id' | 'createdAt'>) =>
      createRow<Message>('messages', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: messageKeys.byApplication(variables.applicationId),
      })
      queryClient.invalidateQueries({ queryKey: messageKeys.all })
    },
  })
}
