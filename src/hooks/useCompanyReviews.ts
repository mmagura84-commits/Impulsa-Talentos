import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { CompanyReview } from '@/types'


export const reviewKeys = {
  all: ['companyReviews'] as const,
  byCompany: (companyId: string) => ['companyReviews', 'byCompany', companyId] as const,
}

async function fetchReviewsByCompany(companyId: string): Promise<CompanyReview[]> {
  return listRows<CompanyReview>('company_reviews', {
    where: { companyId } as any,
    orderBy: { createdAt: 'desc' },
  })
}

export function useCompanyReviews(companyId: string | undefined) {
  return useQuery({
    queryKey: reviewKeys.byCompany(companyId ?? ''),
    queryFn: () => fetchReviewsByCompany(companyId!),
    enabled: !!companyId,
  })
}

export function useCreateReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      data: Omit<CompanyReview, 'id' | 'createdAt'>,
    ) => createRow<CompanyReview>('company_reviews', data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: reviewKeys.all })
      queryClient.invalidateQueries({
        queryKey: reviewKeys.byCompany(variables.companyId),
      })
    },
  })
}
