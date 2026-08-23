import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AuthGate } from '@/components/AuthGate'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { createRow, listRows } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'

type MailRow = {
  id: string
  senderId?: string
  recipientEmail?: string
  subject?: string
  body?: string
  direction?: 'inbound' | 'outbound'
  status?: string
  createdAt?: string
}

export function Messages() {
  const { t } = useI18n()
  const { user } = useAuth()
  const ok = useIsMd()
  const nav = useNavigate()
  useEffect(() => { if (!ok) nav({ to: '/dashboard', replace: true }) }, [ok, nav])

  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox')
  const [rows, setRows] = useState<MailRow[]>([])
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // The owner assigns an email to this MD person; that address is their inbox.
  // Today it resolves to the account email. A dedicated business mailbox is NOT
  // yet provisioned (plan inbox limit reached at 3) — surfaced honestly below.
  const assignedInbox = user?.email ?? ''

  const load = () =>
    listRows<MailRow>('messages', { orderBy: { createdAt: 'desc' } })
      .then((all) => {
        // Show only this MD's mailbox: messages addressed to their inbox or sent by them.
        const mine = assignedInbox
          ? all.filter((r) => r.recipientEmail === assignedInbox || (r.direction === 'outbound' && r.senderId === user?.id))
          : []
        setRows(mine)
      })
      .catch(() => setRows([]))

  useEffect(() => { if (ok) load() }, [ok, assignedInbox])
  useEffect(() => { if (!saved && !error) return; const id = setTimeout(() => { setSaved(false); setError('') }, 4000); return () => clearTimeout(id) }, [saved, error])

  const canSend = ok && !!to && !!subject && !!body && !!assignedInbox

  const submit = async () => {
    setSaved(false); setError('')
    try {
      // Write the outbound message row (direction outbound). Delivery is NOT
      // claimed: email sending is disabled until the send pipeline is enabled
      // and a mailbox is provisioned, so we mark it 'queued' and never 'sent'.
      await createRow<MailRow>('messages', {
        senderId: user?.id,
        recipientEmail: to,
        subject,
        body,
        direction: 'outbound',
        status: 'queued',
        createdAt: new Date().toISOString(),
      })
      setTo(''); setSubject(''); setBody('')
      setSaved(true)
      setTab('inbox')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const statusTone = (s?: string) =>
    s === 'sent' ? 'bg-emerald-500 text-white' :
    s === 'queued' ? 'bg-amber-500 text-white' :
    s === 'failed' ? 'bg-destructive text-white' :
    'bg-secondary text-secondary-foreground'

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <main className="mx-auto max-w-3xl p-6">
        <MdNav />
        <h1 className="text-3xl font-bold">{t('md.messages.title')}</h1>

        {/* Assigned-inbox state */}
        <Card className="mt-5">
          <CardContent className="p-5">
            {assignedInbox ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge className="bg-emerald-500 text-white">{t('md.messages.inboxConfigured')}</Badge>
                <span className="text-muted-foreground">{t('md.messages.inboxLabel')}:</span>
                <strong>{assignedInbox}</strong>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline">{t('md.messages.inboxUnconfigured')}</Badge>
                <span className="text-muted-foreground">{t('md.messages.inboxUnconfiguredHint')}</span>
              </div>
            )}
            {/* Honest sending-disabled note */}
            <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-muted-foreground">
              {t('md.messages.sendingDisabled')}
            </p>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-2">
          <Button variant={tab === 'inbox' ? 'default' : 'outline'} onClick={() => setTab('inbox')}>{t('md.messages.inbox')}</Button>
          <Button variant={tab === 'compose' ? 'default' : 'outline'} onClick={() => { setTab('compose'); setSaved(false); setError('') }}>{t('md.messages.compose')}</Button>
        </div>

        {saved && <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">{t('md.messages.savedQueued')}</p>}
        {error && <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}

        {tab === 'inbox' ? (
          <Card className="mt-4">
            <CardHeader><CardTitle>{t('md.messages.all')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="min-w-0 truncate">{r.subject || t('md.messages.emptySubject')}</strong>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={statusTone(r.status)}>{r.status || '—'}</Badge>
                      <span className="text-xs text-muted-foreground">{r.direction === 'outbound' ? t('md.messages.out') : t('md.messages.in')}</span>
                    </div>
                  </div>
                  {r.recipientEmail && <p className="text-sm text-muted-foreground">{r.recipientEmail}</p>}
                  {r.body && <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>}
                </div>
              ))}
              {!rows.length && <p className="text-muted-foreground">{t('md.messages.empty')}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader><CardTitle>{t('md.messages.compose')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Input placeholder={t('md.messages.email')} value={to} onChange={(e) => setTo(e.target.value)} autoComplete="off" />
              <Input placeholder={t('md.messages.subject')} value={subject} onChange={(e) => setSubject(e.target.value)} />
              <textarea className="min-h-40 rounded-md border bg-background p-3" placeholder={t('md.messages.body')} value={body} onChange={(e) => setBody(e.target.value)} />
              <Button disabled={!canSend} onClick={submit}>{t('md.messages.send')}</Button>
              <p className="text-xs text-muted-foreground">{t('md.messages.composeHint')}</p>
            </CardContent>
          </Card>
        )}
      </main>
    </AuthGate>
  )
}
