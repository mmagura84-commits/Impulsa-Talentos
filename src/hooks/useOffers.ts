import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow } from '@/lib/supabase'
import type { Offer } from '@/types'

export const offerKeys = {
  all: ['offers'] as const,
  byApplication: (applicationId: string) => ['offers', 'byApplication', applicationId] as const,
  detail: (id: string) => ['offers', 'detail', id] as const,
}

/** Fetch all offers for an application. */
export function useOffersByApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: offerKeys.byApplication(applicationId ?? ''),
    queryFn: () =>
      listRows<Offer>('offers', {
        where: { applicationId: applicationId! },
        orderBy: { createdAt: 'desc' },
      }),
    enabled: !!applicationId,
  })
}

/** Fetch a single offer by id. */
export function useOffer(id: string | undefined) {
  return useQuery({
    queryKey: offerKeys.detail(id ?? ''),
    queryFn: () => getRow<Offer>('offers', id!),
    enabled: !!id,
  })
}

/** Create a new offer for an application. */
export function useCreateOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>) =>
      createRow<Offer>('offers', data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.byApplication(variables.applicationId) })
      queryClient.invalidateQueries({ queryKey: offerKeys.all })
    },
  })
}

/** Update an offer (revise, withdraw, etc.) */
export function useUpdateOffer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Offer, 'id' | 'applicationId' | 'createdAt'>>
    }) => updateRow('offers', id, { ...data, updatedAt: new Date().toISOString() }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offerKeys.all })
      queryClient.invalidateQueries({ queryKey: offerKeys.detail(variables.id) })
    },
  })
}
