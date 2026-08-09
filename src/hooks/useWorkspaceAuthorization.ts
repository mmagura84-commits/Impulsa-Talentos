import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** Phase 0 capability keys shared by Founder/MD route gates. */
export const WORKSPACE_PERMISSIONS = {
  teamManage: 'team.manage',
  approvalsDecide: 'approvals.decide',
  financeReadDetail: 'finance.read_detail',
} as const

export const workspaceAuthorizationKeys = {
  all: ['workspaceAuthorization'] as const,
  scopes: () => ['workspaceAuthorization', 'scopes'] as const,
  capability: (companyId: string, permission: string) =>
    ['workspaceAuthorization', 'capability', companyId, permission] as const,
}

/**
 * Returns the authenticated user's active company memberships. The RPC derives
 * identity from auth.uid(); callers cannot supply an actor id or broaden scope.
 */
export function useMyCompanyScopes() {
  return useQuery({
    queryKey: workspaceAuthorizationKeys.scopes(),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_company_scopes')
      if (error) throw error
      return data ?? []
    },
    staleTime: 60_000,
  })
}

/**
 * Route-gate integration point for company-scoped Founder/MD actions. A false
 * result is fail-closed while auth, membership, or permission data is loading.
 */
export function useCompanyCapability(companyId: string | undefined, permission: string) {
  return useQuery({
    queryKey: workspaceAuthorizationKeys.capability(companyId ?? '', permission),
    queryFn: async () => {
      if (!companyId) return false
      const { data, error } = await supabase.rpc('can_company', {
        p_company_id: companyId,
        p_permission: permission,
      })
      if (error) throw error
      return data === true
    },
    enabled: !!companyId,
    staleTime: 60_000,
  })
}
