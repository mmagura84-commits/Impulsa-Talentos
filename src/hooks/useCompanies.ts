import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { Company } from '@/types'


// ─── Query key factories ───

export const companyKeys = {
  all: ['companies'] as const,
  allList: ['companies', 'all'] as const,
  byEmployer: (employerId: string) =>
    ['companies', 'byEmployer', employerId] as const,
  detail: (id: string) => ['companies', 'detail', id] as const,
}

// ─── Fetch helpers ───

async function fetchCompanyByEmployer(
  employerId: string,
): Promise<Company | null> {
  const results = await listRows<Company>('companies', {
    where: { employerId },
    limit: 1,
  })
  return results[0] ?? null
}

/** Fetch a company by id (also used by route loaders for SSR/prerender). */
export async function fetchCompanyById(id: string): Promise<Company | null> {
  return getRow<Company>('companies', id)
}

/** Fetch every company (also used by route loaders for SSR/prerender). */
export async function fetchAllCompanies(): Promise<Company[]> {
  return listRows<Company>('companies', { orderBy: { createdAt: 'desc' } })
}

// ─── Hooks ───

/**
 * Fetch a company by its employer's userId.
 * Pass `undefined` to skip the query.
 */
export function useCompany(employerId: string | undefined) {
  return useQuery({
    queryKey: companyKeys.byEmployer(employerId ?? ''),
    queryFn: () => fetchCompanyByEmployer(employerId!),
    enabled: !!employerId,
  })
}

/**
 * Fetch a company by its row id.
 */
export function useCompanyById(id: string | undefined) {
  return useQuery({
    queryKey: companyKeys.detail(id ?? ''),
    queryFn: () => fetchCompanyById(id!),
    enabled: !!id,
  })
}

/**
 * Create a new company profile (employers only).
 */
export function useCreateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      data: Omit<Company, 'id' | 'createdAt'>,
    ) => createRow<Company>('companies', data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all })
      queryClient.invalidateQueries({
        queryKey: companyKeys.byEmployer(variables.employerId),
      })
    },
  })
}

/**
 * Update an existing company by its row id.
 */
export function useUpdateCompany() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Company, 'id' | 'employerId' | 'createdAt'>>
    }) => updateRow('companies', id, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: companyKeys.all })
      queryClient.invalidateQueries({
        queryKey: companyKeys.detail(variables.id),
      })
    },
  })
}

/** List ALL companies (HQ admin view). */
export function useAllCompanies() {
  return useQuery({
    queryKey: companyKeys.allList,
    queryFn: fetchAllCompanies,
  })
}
