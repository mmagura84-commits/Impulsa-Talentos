import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { TeamMember, TeamMemberRole, TeamMemberStatus } from '@/types'

// ─── Query key factories ───

export const teamMemberKeys = {
  all: ['teamMembers'] as const,
  byCompany: (companyId: string) => ['teamMembers', 'byCompany', companyId] as const,
  byUser: (userId: string) => ['teamMembers', 'byUser', userId] as const,
  detail: (id: string) => ['teamMembers', 'detail', id] as const,
}

// ─── Fetch helpers ───

async function fetchTeamByCompany(companyId: string): Promise<TeamMember[]> {
  return listRows<TeamMember>('team_members', {
    where: { companyId },
    orderBy: { createdAt: 'asc' },
  })
}

async function fetchTeamByUser(userId: string): Promise<TeamMember[]> {
  return listRows<TeamMember>('team_members', {
    where: { userId },
  })
}

async function fetchTeamMemberById(id: string): Promise<TeamMember | null> {
  return getRow<TeamMember>('team_members', id)
}

// ─── Hooks ───

/** List all team members for a company. */
export function useTeamMembers(companyId: string | undefined) {
  return useQuery({
    queryKey: teamMemberKeys.byCompany(companyId ?? ''),
    queryFn: () => fetchTeamByCompany(companyId!),
    enabled: !!companyId,
  })
}

/** List all companies a user is a member of. */
export function useUserTeams(userId: string | undefined) {
  return useQuery({
    queryKey: teamMemberKeys.byUser(userId ?? ''),
    queryFn: () => fetchTeamByUser(userId!),
    enabled: !!userId,
  })
}

/** Check if a user is an owner or admin of a given company. */
export function useIsCompanyAdmin(companyId: string | undefined, userId: string | undefined) {
  const { data: teams } = useUserTeams(userId)
  if (!companyId || !userId || !teams) return false
  const membership = teams.find(
    (tm) => tm.companyId === companyId && tm.status === 'active'
  )
  return membership?.role === 'owner' || membership?.role === 'admin'
}

/** Invite a new team member (inserts a pending row). */
export function useInviteTeamMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      companyId,
      inviteEmail,
      role,
      invitedBy,
    }: {
      companyId: string
      inviteEmail: string
      role: TeamMemberRole
      invitedBy: string
    }) =>
      createRow<TeamMember>('team_members', {
        companyId,
        userId: `pending_${inviteEmail}`, // placeholder until accepted
        inviteEmail,
        role,
        invitedBy,
        status: 'pending' as TeamMemberStatus,
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.byCompany(variables.companyId) })
    },
  })
}

/** Update a team member (e.g. change role, accept invite, decline). */
export function useUpdateTeamMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Pick<TeamMember, 'role' | 'status' | 'userId'>>
    }) => updateRow('team_members', id, { ...data, updatedAt: new Date().toISOString() }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.all })
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.detail(variables.id) })
    },
  })
}

/** Remove a team member from a company. */
export function useRemoveTeamMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, companyId }: { id: string; companyId: string }) =>
      deleteRow('team_members', id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: teamMemberKeys.byCompany(variables.companyId) })
    },
  })
}

/** Count team members for a company. */
export function useTeamMemberCount(companyId: string | undefined) {
  return useQuery({
    queryKey: [...teamMemberKeys.byCompany(companyId ?? ''), 'count'],
    queryFn: () =>
      countRows('team_members', {
        companyId: companyId!,
        status: 'active',
      }),
    enabled: !!companyId,
  })
}
