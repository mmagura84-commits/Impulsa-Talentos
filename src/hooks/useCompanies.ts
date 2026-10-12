import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, supabase } from '@/lib/supabase'
import type { Company } from '@/types'

/** Columns anonymous visitors may read (migration 041 column grant). */
export const PUBLIC_COMPANY_COLUMNS =
  'id,name,industry,size,location,website,description,logo_url,verified,created_at,entity_type,employer_id'

/** Signed-in callers get every column RLS allows; visitors (and the static
 *  prerender build) get the public column set. */
async function companyColumns(): Promise<string> {
  if (typeof window === 'undefined') return PUBLIC_COMPANY_COLUMNS
  const { data } = await supabase.auth.getSession()
  return data.session ? '*' : PUBLIC_COMPANY_COLUMNS
}


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
  if (results[0]) return results[0]
  // Invited team members (owner/admin/member seats) work for a company they
  // do not own: resolve it through their active membership.
  const { data: seat } = await supabase
    .from('team_members')
    .select('company_id')
    .eq('user_id', employerId)
    .eq('status', 'active')
    .in('role', ['owner', 'admin', 'member'])
    .limit(1)
    .maybeSingle()
  if (!seat?.company_id) return null
  return getRow<Company>('companies', seat.company_id as string)
}

/** Fetch a company by id (also used by route loaders for SSR/prerender). */
export async function fetchCompanyById(id: string): Promise<Company | null> {
  return getRow<Company>('companies', id, await companyColumns())
}

/** Fetch every company (also used by route loaders for SSR/prerender). */
export async function fetchAllCompanies(): Promise<Company[]> {
  return listRows<Company>('companies', { orderBy: { createdAt: 'desc' }, select: await companyColumns() })
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
