/**
 * SaveJobButton — heart toggle for job bookmarks.
 * Two visual sizes: `icon` (inline) and `chip` (text + icon for the
 * job detail page). Falls back to a sign-in prompt when the user is
 * not authenticated.
 */
import { useState, type ReactNode } from 'react'
import { Heart, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import {
  useSavedJobIds,
  useSaveJob,
  useUnsaveJob,
} from '@/hooks/useSavedJobs'
import { useI18n } from '@/i18n/I18nProvider'
import { toast } from 'sonner'

interface SaveJobButtonProps {
  jobId: string
  /** `icon` = heart-only chip; `chip` = labeled button (for job detail). */
  variant?: 'icon' | 'chip'
  className?: string
}

export function SaveJobButton({ jobId, variant = 'icon', className }: SaveJobButtonProps) {
  const { t } = useI18n()
  const { user, isAuthenticated } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const candidateId = profile?.id ?? null
  const savedIds = useSavedJobIds(candidateId ?? undefined)
  const save = useSaveJob()
  const unsave = useUnsaveJob()
  const [busy, setBusy] = useState(false)

  const isSaved = savedIds.has(jobId)
  const pending = save.isPending || unsave.isPending || busy

  const handle = async (e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (!isAuthenticated || !candidateId) {
      toast.info(t('savedJobs.signInToSave'))
      return
    }
    setBusy(true)
    try {
      if (isSaved) {
        await unsave.mutateAsync({ candidateId, jobId })
      } else {
        await save.mutateAsync({ candidateId, jobId })
        toast.success(t('savedJobs.saved'), { duration: 1800 })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      // Only silently ignore genuine unique-constraint violations.
      if (/unique constraint|UNIQUE constraint/i.test(msg)) {
        // Already saved — treat as success without an extra toast.
      } else {
        toast.error(msg || t('common.retry'))
      }
    } finally {
      setBusy(false)
    }
  }

  const tooltip = isSaved ? t('savedJobs.unsave') : t('savedJobs.save')
  const baseAria = isSaved ? t('savedJobs.unsave') : t('savedJobs.save')

  if (variant === 'chip') {
    return (
      <Button
        type="button"
        variant={isSaved ? 'default' : 'outline'}
        size="lg"
        onClick={handle}
        disabled={pending}
        aria-pressed={isSaved}
        aria-label={baseAria}
        className={cn('gap-2 font-medium shrink-0', className)}
      >
        <Heart
          className={cn('size-4 transition-colors', isSaved && 'fill-current')}
        />
        {isSaved ? t('savedJobs.saved') : t('savedJobs.save')}
      </Button>
    )
  }

  const button: ReactNode = (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      aria-pressed={isSaved}
      aria-label={baseAria}
      className={cn(
        'inline-flex items-center justify-center h-9 w-9 rounded-full border transition-all cursor-pointer',
        isSaved
          ? 'border-pink-500/40 bg-pink-500/10 text-pink-600'
          : 'border-border bg-card text-muted-foreground hover:text-pink-600 hover:border-pink-500/40 hover:bg-pink-500/5',
        'hover:scale-110',
        className,
      )}
    >
      <Heart
        className={cn(
          'size-4 transition-all',
          isSaved && 'fill-current scale-110',
        )}
      />
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
