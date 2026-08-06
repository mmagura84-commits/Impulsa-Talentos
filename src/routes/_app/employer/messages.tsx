import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useProfileById } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useCompanyJobs } from '@/hooks/useJobs'
import { useApplicationsByCompany } from '@/hooks/useApplications'
import { useMessagesByApplication, useSendMessage } from '@/hooks/useMessages'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthGate } from '@/components/AuthGate'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageSquare, Send, ArrowRight, Loader2, ChevronLeft } from 'lucide-react'
import type { Application, Message } from '@/types'

export const Route = createFileRoute('/_app/employer/messages')({
  component: EmployerMessagesPage,
})

function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function EmployerMessagesPage() {
  const { user } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { data: company } = useCompany(user?.id)
  const { data: jobs } = useCompanyJobs(company?.id)
  const jobIds = jobs?.map(j => j.id) ?? []
  const { data: applications, isLoading: appsLoading } = useApplicationsByCompany(jobIds.length > 0 ? jobIds : undefined)
  const { t } = useI18n()
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)

  if (!user || !profile) {
    return (
      <AuthGate>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AuthGate>
    )
  }

  const selectedApp = applications?.find(a => a.id === selectedAppId)

  return (
    <AuthGate
      fallbackKey="auth.fallback.employerDashboard"
      fallbackDescKey="auth.fallback.employerDashboardDesc"
    >
      <div className="p-6 max-w-5xl mx-auto">
        {selectedApp ? (
          <MessageThread
            application={selectedApp}
            profileId={profile.id}
            onBack={() => setSelectedAppId(null)}
            t={t}
          />
        ) : (
          <>
            <FadeIn>
              <div className="mb-8">
                <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('messages.kicker')}</p>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="size-7 text-primary" />
                  {t('messages.title')}
                </h1>
              </div>
            </FadeIn>
            {appsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : !applications || applications.length === 0 ? (
              <FadeIn delay={0.05}>
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="size-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-foreground">{t('messages.empty')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('messages.emptyDesc')}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ) : (
              <FadeIn delay={0.05}>
                <div className="space-y-2">
                  {applications.map(app => (
                    <MessageRow
                      key={app.id}
                      application={app}
                      onClick={() => setSelectedAppId(app.id)}
                      t={t}
                    />
                  ))}
                </div>
              </FadeIn>
            )}
          </>
        )}
      </div>
    </AuthGate>
  )
}

function MessageRow({ application, onClick, t }: { application: Application; onClick: () => void; t: (k: string, p?: Record<string, unknown>) => string }) {
  const { data: candidate } = useProfileById(application.candidateId as string)
  const { data: messages } = useMessagesByApplication(application.id)
  const last = messages?.[messages.length - 1]
  const initials = candidate?.fullName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <Avatar className="size-10 shrink-0">
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">
            {candidate?.fullName ?? t('messages.unknownCandidate')}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {last ? last.body.slice(0, 80) : t('messages.noMessages')}
          </p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
      </CardContent>
    </Card>
  )
}

function MessageThread({
  application,
  profileId,
  onBack,
  t,
}: {
  application: Application
  profileId: string
  onBack: () => void
  t: (k: string, p?: Record<string, unknown>) => string
}) {
  const { data: messages, isLoading } = useMessagesByApplication(application.id)
  const { data: candidate } = useProfileById(application.candidateId as string)
  const sendMessage = useSendMessage()
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const handleSend = async () => {
    if (!draft.trim() || sendMessage.isPending) return
    await sendMessage.mutateAsync({
      applicationId: application.id,
      senderId: profileId,
      body: draft.trim(),
    })
    setDraft('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  return (
    <div>
      <FadeIn>
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ChevronLeft className="size-4" />
            {t('common.back')}
          </Button>
          <h2 className="font-serif text-xl font-bold text-foreground">
            {candidate?.fullName ?? t('messages.unknownCandidate')}
          </h2>
        </div>
      </FadeIn>

      <Card className="mb-4">
        <CardContent className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !messages?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('messages.startConversation')}</p>
          ) : (
            messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === profileId} t={t} />
            ))
          )}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder={t('messages.placeholder')}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          disabled={sendMessage.isPending}
        />
        <Button onClick={handleSend} disabled={sendMessage.isPending || !draft.trim()} className="gap-2 shrink-0">
          {sendMessage.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {t('messages.send')}
        </Button>
      </div>
    </div>
  )
}

function MessageBubble({ message, isOwn, t }: { message: Message; isOwn: boolean; t: (k: string, p?: Record<string, unknown>) => string }) {
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-2 text-sm ${
          isOwn
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}
