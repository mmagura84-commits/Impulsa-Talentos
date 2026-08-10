import { useState } from 'react'
import { useI18n } from '@/i18n/I18nProvider'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useIsCompanyAdmin } from '@/hooks/useTeamMembers'
import {
  useFeedbackForApplication,
  useCreateFeedback,
  useUpdateFeedback,
  useDeleteFeedback,
} from '@/hooks/useFeedback'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Star, Plus, Pencil, Trash2, MessageSquareText, Eye, Lock } from 'lucide-react'
import type { ApplicationFeedback, FeedbackVisibility } from '@/types'

interface FeedbackPanelProps {
  applicationId: string
  companyId: string
}

interface FeedbackDraft {
  stage: string
  rating: number | null
  strengths: string
  concerns: string
  nextSteps: string
  visibility: FeedbackVisibility
}

const EMPTY_DRAFT: FeedbackDraft = {
  stage: '',
  rating: null,
  strengths: '',
  concerns: '',
  nextSteps: '',
  visibility: 'internal',
}

function RatingStars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`size-3.5 ${i < value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
        />
      ))}
    </span>
  )
}

function fromEntry(f: ApplicationFeedback): FeedbackDraft {
  return {
    stage: f.stage ?? '',
    rating: f.rating ?? null,
    strengths: f.strengths ?? '',
    concerns: f.concerns ?? '',
    nextSteps: f.nextSteps ?? '',
    visibility: f.visibility,
  }
}

export function FeedbackPanel({ applicationId, companyId }: FeedbackPanelProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const isAdmin = useIsCompanyAdmin(companyId, user?.id)

  const { data: entries, isLoading } = useFeedbackForApplication(applicationId)
  const createFeedback = useCreateFeedback()
  const updateFeedback = useUpdateFeedback()
  const deleteFeedback = useDeleteFeedback()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<FeedbackDraft>(EMPTY_DRAFT)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canModify = isAdmin

  const startAdd = () => {
    setDraft(EMPTY_DRAFT)
    setEditingId(null)
    setAdding(true)
  }

  const startEdit = (f: ApplicationFeedback) => {
    setDraft(fromEntry(f))
    setEditingId(f.id)
    setAdding(true)
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  const save = async () => {
    if (!profile) return
    const payload = {
      stage: draft.stage.trim() || undefined,
      rating: draft.rating,
      strengths: draft.strengths.trim() || undefined,
      concerns: draft.concerns.trim() || undefined,
      nextSteps: draft.nextSteps.trim() || undefined,
      visibility: draft.visibility,
    }
    try {
      if (editingId) {
        await updateFeedback.mutateAsync({ id: editingId, data: payload })
      } else {
        await createFeedback.mutateAsync({
          applicationId,
          authorId: profile.id,
          companyId,
          ...payload,
        })
      }
      toast.success(t('feedback.saved'), { description: t('feedback.savedDesc') })
      cancel()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('feedback.error'))
    }
  }

  const remove = async (f: ApplicationFeedback) => {
    setDeletingId(f.id)
    try {
      await deleteFeedback.mutateAsync({ id: f.id, applicationId })
      toast.success(t('feedback.deleted'), { description: t('feedback.deletedDesc') })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('feedback.error'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <MessageSquareText className="size-3" /> {t('feedback.title')}
        </p>
        {canModify && !adding && (
          <Button size="sm" variant="ghost" onClick={startAdd} className="gap-1 h-7 px-2 text-xs">
            <Plus className="size-3" />
            {t('feedback.add')}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">{t('feedback.subtitle')}</p>

      {adding ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-stage">{t('feedback.stage')}</Label>
              <Input
                id="feedback-stage"
                value={draft.stage}
                onChange={e => setDraft(d => ({ ...d, stage: e.target.value }))}
                placeholder={t('feedback.stagePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('feedback.rating')}</Label>
              <div className="flex flex-wrap items-center gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    aria-label={t('feedback.ratingOutOf', { n })}
                    onClick={() => setDraft(d => ({ ...d, rating: d.rating === n ? null : n }))}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      (draft.rating ?? 0) >= n ? 'text-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'
                    }`}
                  >
                    <Star className={`size-5 ${(draft.rating ?? 0) >= n ? 'fill-amber-400' : ''}`} />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, rating: null }))}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {t('feedback.ratingNone')}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-strengths">{t('feedback.strengths')}</Label>
            <Textarea
              id="feedback-strengths"
              rows={2}
              value={draft.strengths}
              onChange={e => setDraft(d => ({ ...d, strengths: e.target.value }))}
              placeholder={t('feedback.strengthsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-concerns">{t('feedback.concerns')}</Label>
            <Textarea
              id="feedback-concerns"
              rows={2}
              value={draft.concerns}
              onChange={e => setDraft(d => ({ ...d, concerns: e.target.value }))}
              placeholder={t('feedback.concernsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feedback-next-steps">{t('feedback.nextSteps')}</Label>
            <Textarea
              id="feedback-next-steps"
              rows={2}
              value={draft.nextSteps}
              onChange={e => setDraft(d => ({ ...d, nextSteps: e.target.value }))}
              placeholder={t('feedback.nextStepsPlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('feedback.visibility')}</Label>
            <div className="flex gap-2">
              {(['internal', 'candidate_visible'] as const).map(v => {
                const Icon = v === 'internal' ? Lock : Eye
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraft(d => ({ ...d, visibility: v }))}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                      draft.visibility === v
                        ? 'border-primary/40 bg-primary/5 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {t(v === 'internal' ? 'feedback.visibilityInternal' : 'feedback.visibilityCandidate')}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={save} disabled={createFeedback.isPending || updateFeedback.isPending} className="gap-1.5">
              {(createFeedback.isPending || updateFeedback.isPending)
                ? t('feedback.saving')
                : t('feedback.save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={createFeedback.isPending || updateFeedback.isPending}>
              {t('feedback.cancel')}
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground animate-pulse">{t('feedback.loading')}</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t('feedback.empty')}</p>
      ) : (
        <div className="space-y-3">
          {entries.map(f => {
            const isOwn = !!profile && f.authorId === profile.id
            return (
              <div key={f.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {f.rating != null && <RatingStars value={f.rating} />}
                    {f.stage && (
                      <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {f.stage}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        f.visibility === 'candidate_visible'
                          ? 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5'
                          : 'border-border text-muted-foreground bg-muted/40'
                      }`}
                    >
                      {f.visibility === 'candidate_visible' ? <Eye className="size-3" /> : <Lock className="size-3" />}
                      {t(f.visibility === 'candidate_visible' ? 'feedback.visibilityCandidate' : 'feedback.visibilityInternal')}
                    </span>
                  </div>
                  {canModify && isOwn && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(f)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                        aria-label={t('feedback.edit')}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(f)}
                        disabled={deletingId === f.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                        aria-label={t('feedback.delete')}
                      >
                        {deletingId === f.id ? (
                          <span className="block size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {f.strengths && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('feedback.strengths')}</p>
                    <p className="text-xs text-foreground whitespace-pre-line">{f.strengths}</p>
                  </div>
                )}
                {f.concerns && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('feedback.concerns')}</p>
                    <p className="text-xs text-foreground whitespace-pre-line">{f.concerns}</p>
                  </div>
                )}
                {f.nextSteps && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t('feedback.nextSteps')}</p>
                    <p className="text-xs text-foreground whitespace-pre-line">{f.nextSteps}</p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {new Date(f.updatedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {f.updatedAt !== f.createdAt ? ` · ${t('feedback.editedLabel')}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
