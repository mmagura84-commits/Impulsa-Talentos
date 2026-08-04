import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { JobReport } from '@/types'


export const reportKeys = {
  all: ['jobReports'] as const,
}

async function fetchAllReports(): Promise<JobReport[]> {
  return listRows<JobReport>('reports', { orderBy: { createdAt: 'desc' } })
}

/** All abuse reports, newest first (HQ moderation view). */
export function useAllReports() {
  return useQuery({
    queryKey: reportKeys.all,
    queryFn: fetchAllReports,
  })
}

/** Create a new abuse report against a job. */
export function useCreateReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<JobReport, 'id' | 'createdAt'>) =>
      createRow<JobReport>('reports', { ...data, createdAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.all })
    },
  })
}
