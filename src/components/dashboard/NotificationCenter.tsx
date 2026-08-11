import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nProvider'
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllRead,
  useDeleteNotification,
} from '@/hooks/useNotifications'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, Trash2, Inbox, AlertCircle } from 'lucide-react'
import type { Notification, NotificationType } from '@/types'

const TYPE_KEYS: Record<NotificationType, string> = {
  application_received: 'notifications.type.application_received',
  status_changed: 'notifications.type.status_changed',
  message_received: 'notifications.type.message_received',
  interview_scheduled: 'notifications.type.interview_scheduled',
  feedback_added: 'notifications.type.feedback_added',
  team_invite: 'notifications.type.team_invite',
}

/** Resolve a notification to a route where the employer can act on it. */
function notificationLink(n: Notification): string | undefined {
  const data = (n.data ?? {}) as Record<string, unknown>
  const jobId = typeof data.job_id === 'string' ? data.job_id : undefined
  switch (n.type) {
    case 'team_invite':
      return '/employer/team'
    case 'application_received':
    case 'status_changed':
    case 'message_received':
    case 'interview_scheduled':
    case 'feedback_added':
      if (jobId) return `/employer/manage/${jobId}`
      return '/employer/applications'
    default:
      return '/employer/jobs'
  }
}

/** Compact relative time using the shared time helper keys. */
function relativeTime(iso: string, t: (k: string, p?: Record<string, string | number>) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs) || diffMs < 0) return t('notifications.justNow')
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return t('notifications.justNow')
  if (minutes < 60) return t('notifications.minutesAgo', { n: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('notifications.hoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('notifications.daysAgo', { n: days })
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function NotificationCenter() {
  const { user } = useAuth()
  const { t } = useI18n()
  const { data: notifications, isLoading, isError, refetch } = useNotifications(user?.id)
  const { data: unreadCount = 0 } = useUnreadCount(user?.id)
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllRead()
  const deleteNotification = useDeleteNotification()

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [open])

  const userId = user?.id
  const items = notifications ?? []
  const unread = items.filter((n) => !n.readAt)

  const handleOpen = (n: Notification) => {
    setOpen(false)
    if (!n.readAt && userId) {
      markRead.mutate({ id: n.id, userId })
    }
  }

  const handleMarkAll = () => {
    if (!userId) return
    markAllRead.mutate({ userId })
  }

  const handleDelete = (e: React.MouseEvent, n: Notification) => {
    e.preventDefault()
    e.stopPropagation()
    if (!userId) return
    deleteNotification.mutate({ id: n.id, userId })
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notifications.open')}
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Bell className="size-3.5 text-primary" />
              {t('notifications.title')}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={handleMarkAll}
              disabled={markAllRead.isPending || unread.length === 0}
            >
              <CheckCheck className="size-3.5" />
              {t('notifications.markAllRead')}
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-6 text-center">
                <AlertCircle className="size-5 text-destructive mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">{t('notifications.error')}</p>
                <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => refetch()}>
                  {t('notifications.retry')}
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center">
                <Inbox className="size-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">{t('notifications.empty')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('notifications.emptyDesc')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const link = notificationLink(n)
                  const deleteBtn = (
                    <button
                      type="button"
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                      onClick={(e) => handleDelete(e, n)}
                      aria-label={t('notifications.delete')}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )
                  const body = (
                    <span className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className={`mt-1.5 size-1.5 rounded-full shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-primary'}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-xs ${n.readAt ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {n.title || t(TYPE_KEYS[n.type] ?? 'notifications.type.application_received')}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">{n.body}</span>
                        <span className="block text-[10px] text-muted-foreground/70 mt-0.5">
                          {relativeTime(n.createdAt, t)}
                        </span>
                      </span>
                    </span>
                  )
                  const cls = `flex items-start gap-1 px-3 py-2.5 transition-colors ${n.readAt ? 'bg-card' : 'bg-primary/[0.03]'} hover:bg-accent/40`
                  return (
                    <li key={n.id} className={cls}>
                      {link ? (
                        <Link
                          to={link}
                          className="flex items-start gap-2.5 min-w-0 flex-1"
                          onClick={() => handleOpen(n)}
                        >
                          {body}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="flex items-start gap-2.5 min-w-0 flex-1 text-left"
                          onClick={() => handleOpen(n)}
                        >
                          {body}
                        </button>
                      )}
                      {deleteBtn}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
