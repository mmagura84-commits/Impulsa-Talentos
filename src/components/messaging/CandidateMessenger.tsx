import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useApplicationMessages, useSendMessage } from '@/hooks/useMessages'
import { useI18n } from '@/i18n/I18nProvider'
import {
  Send,
  MessageSquare,
  ShieldAlert,
  X,
  Loader2,
} from 'lucide-react'

/* ── Time-ago formatter (lightweight, no locale switching needed) ─── */
function timeAgo(iso: string): string {
  if (!iso) return ''
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

/* ── Anti-scam banner ───────────────────────────────────────────── */
function AntiScamBanner({ t }: { t: (key: string, vars?: Record<string, string | number>) => string }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-700">
      <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
      <p className="flex-1 leading-relaxed">{t('messenger.antiScam')}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-500 hover:text-amber-700 cursor-pointer"
        aria-label={t('messenger.dismiss')}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/* ── Message bubble ─────────────────────────────────────────────── */
function MessageBubble({
  message,
  isOwn,
  senderName,
}: {
  message: { id: string; body: string; createdAt: string }
  isOwn: boolean
  senderName: string
}) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3.5 py-2.5 ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        }`}
      >
        {!isOwn && (
          <p className="text-[10px] font-semibold opacity-70 mb-0.5">{senderName}</p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        <p
          className={`text-[10px] mt-1 ${
            isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'
          }`}
        >
          {timeAgo(message.createdAt)}
        </p>
      </div>
    </div>
  )
}

/* ── CandidateMessenger ─────────────────────────────────────────── */
export function CandidateMessenger({
  applicationId,
  candidateId,
}: {
  applicationId: string
  candidateId: string
}) {
  const { t } = useI18n()
  const { data: messages, isLoading, isError, refetch } = useApplicationMessages(applicationId)
  const sendMessage = useSendMessage()

  const [body, setBody] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    setBody('')
    try {
      await sendMessage.mutateAsync({
        applicationId,
        senderId: candidateId,
        body: trimmed,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
      setBody(trimmed) // restore on failure
    }
  }, [body, applicationId, candidateId, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="flex flex-col h-[480px] sm:h-[520px]">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              {t('messenger.title')}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {t('messenger.subtitle')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 px-0 pb-0">
        {/* Anti-scam banner */}
        <div className="px-4 pb-2 shrink-0">
          <AntiScamBanner t={t} />
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-3 scrollbar-thin"
        >
          {isLoading ? (
            /* Loading skeleton */
            <div className="space-y-3 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`h-16 rounded-xl bg-muted animate-pulse ${
                      i % 2 === 0 ? 'w-[60%]' : 'w-[70%]'
                    }`}
                  />
                </div>
              ))}
            </div>
          ) : isError ? (
            /* Error state */
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <ShieldAlert className="size-8 text-destructive mb-2" />
              <p className="text-sm text-muted-foreground mb-3">{t('messenger.error')}</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : !messages || messages.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <MessageSquare className="size-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">{t('messenger.noMessages')}</p>
              <p className="text-xs text-muted-foreground">{t('messenger.startConversation')}</p>
            </div>
          ) : (
            /* Messages */
            messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.senderId === candidateId}
                senderName={msg.senderId === candidateId ? t('messenger.you') : t('messenger.recruiter')}
              />
            ))
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-border p-3 bg-card/50">
          <div className="flex items-end gap-2">
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('messenger.inputPlaceholder')}
              className="min-h-[40px] max-h-[120px] resize-none text-sm"
              rows={1}
              disabled={sendMessage.isPending}
            />
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!body.trim() || sendMessage.isPending}
              className="h-10 shrink-0 gap-1.5"
            >
              {sendMessage.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {t('messenger.send')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
