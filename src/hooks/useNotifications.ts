import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listRows, updateRow, deleteRow, supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

// ─── Query key factories ───

export const notificationKeys = {
  all: ['notifications'] as const,
  byUser: (userId: string) => ['notifications', 'byUser', userId] as const,
  unread: (userId: string) => ['notifications', 'unread', userId] as const,
  detail: (id: string) => ['notifications', 'detail', id] as const,
}

// ─── Fetch helpers ───

async function fetchNotificationsByUser(userId: string): Promise<Notification[]> {
  return listRows<Notification>('notifications', {
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) {
    throw new Error(`[supabase:notifications] ${error.message}`)
  }
  return count ?? 0
}

// ─── Hooks ───

/** List all notifications for a user, newest first. */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: notificationKeys.byUser(userId ?? ''),
    queryFn: () => fetchNotificationsByUser(userId!),
    enabled: !!userId,
  })
}

/** Count unread notifications for a user (drives the action-center badge). */
export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: notificationKeys.unread(userId ?? ''),
    queryFn: () => fetchUnreadCount(userId!),
    enabled: !!userId,
  })
}

/** Mark a single notification as read. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      updateRow('notifications', id, { readAt: new Date().toISOString() }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(variables.userId) })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread(variables.userId) })
    },
  })
}

/** Mark every unread notification as read. */
export function useMarkAllRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
      if (error) {
        throw new Error(`[supabase:notifications] ${error.message}`)
      }
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(variables.userId) })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread(variables.userId) })
    },
  })
}

/** Delete a single notification. */
export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      deleteRow('notifications', id),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(variables.userId) })
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread(variables.userId) })
    },
  })
}
