import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, getRow, createRow, updateRow, deleteRow, countRows } from '@/lib/supabase'
import type { Profile } from '@/types'


// ─── Query key factories ───

export const profileKeys = {
  all: ['profiles'] as const,
  allList: ['profiles', 'all'] as const,
  byUserId: (userId: string) => ['profiles', 'byUserId', userId] as const,
  detail: (id: string) => ['profiles', 'detail', id] as const,
}

// ─── Fetch helpers ───

async function fetchProfileByUserId(userId: string): Promise<Profile | null> {
  const results = await listRows<Profile>('profiles', {
    where: { userId },
    limit: 1,
  })
  return results[0] ?? null
}

async function fetchProfileById(id: string): Promise<Profile | null> {
  return getRow<Profile>('profiles', id)
}

async function fetchAllProfiles(): Promise<Profile[]> {
  return listRows<Profile>('profiles', { orderBy: { createdAt: 'desc' } })
}

// ─── Hooks ───

/**
 * Fetch the current user's profile by their Supabase auth userId.
 * Pass `undefined` to skip the query (e.g. while auth is loading).
 */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.byUserId(userId ?? ''),
    queryFn: () => fetchProfileByUserId(userId!),
    enabled: !!userId,
  })
}

/**
 * Fetch any profile by its row id.
 */
export function useProfileById(id: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(id ?? ''),
    queryFn: () => fetchProfileById(id!),
    enabled: !!id,
  })
}

/**
 * Create a profile for the currently authenticated user.
 */
export function useCreateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>) =>
      createRow<Profile>('profiles', data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all })
      // Also invalidate the specific userId query
      queryClient.invalidateQueries({
        queryKey: profileKeys.byUserId(variables.userId),
      })
    },
  })
}

/**
 * Update an existing profile by its row id.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: Partial<Omit<Profile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
    }) => updateRow('profiles', id, { ...data, updatedAt: new Date().toISOString() }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all })
      queryClient.invalidateQueries({ queryKey: profileKeys.detail(variables.id) })
    },
  })
}

/** List ALL profiles (HQ admin view). */
export function useAllProfiles() {
  return useQuery({
    queryKey: profileKeys.allList,
    queryFn: fetchAllProfiles,
  })
}
