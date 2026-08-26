import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/AuthGate'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { logMdAudit } from '@/lib/mdAudit'
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'

type MdMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  recipient_email?: string
  subject?: string
  body?: string
  status: 'queued' | 'delivered' | 'failed'
  created_at: string
}

export function Messages() {
  const { t } = useI18n()
  const { user } = useAuth()
  const ok = useIsMd()
  const nav = useNavigate()
  useEffect(() => { if (!ok) nav({ to: '/dashboard', replace: true }) }, [ok, nav])
  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox')
  const [rows, setRows] = useState<MdMessage[]>([])
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = async () => {
    const { data, error } = await supabase.rpc('md_list_messages')
    if (error) { setErr(error.message); return }
    setRows((data ?? []) as MdMessage[])
  }
  useEffect(() => { if (ok) load() }, [ok])

  const submit = async () => {
    setBusy(true); setErr('')
    const { data, error } = await supabase.rpc('md_submit_outbox', {
      p_recipient_email: to.trim(),
      p_subject: subject.trim(),
      p_body: body,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    // New row queued (id = data). Outbox is append-only: queued, not "sent".
    await logMdAudit('message_composed', 'message', data ?? '', { recipient: to.trim() })
    setTo(''); setSubject(''); setBody('')
    setTab('inbox')
    load()
  }

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <div className="mx-auto max-w-3xl p-6">
        <MdNav />
        <h1 className="text-3xl font-bold">{t('md.messages.title')}</h1>
        <div className="mt-6 flex gap-2">
          <Button variant={tab === 'inbox' ? 'default' : 'outline'} onClick={() => setTab('inbox')}>{t('md.messages.inbox')}</Button>
          <Button variant={tab === 'compose' ? 'default' : 'outline'} onClick={() => setTab('compose')}>{t('md.messages.compose')}</Button>
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        {tab === 'inbox' ? (
          <Card className="mt-4">
            <CardHeader><CardTitle>{t('md.messages.all')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="rounded border p-3">
                  <div className="flex justify-between">
                    <strong>{r.subject || t('md.messages.noSubject')}</strong>
                    <span className="text-xs text-muted-foreground">{r.direction}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.recipient_email ?? user?.email} · {r.status}</p>
                  <p className="mt-1 text-sm">{r.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </div>
              ))}
              {!rows.length && <p className="text-muted-foreground">{t('md.messages.empty')}</p>}
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader><CardTitle>{t('md.messages.compose')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <Input placeholder={t('md.messages.email')} value={to} onChange={e => setTo(e.target.value)} />
              <Input placeholder={t('md.messages.subject')} value={subject} onChange={e => setSubject(e.target.value)} />
              <textarea className="min-h-40 rounded-md border bg-background p-3" placeholder={t('md.messages.body')} value={body} onChange={e => setBody(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('md.messages.outboxNote')}</p>
              <Button disabled={!ok || busy || !to.trim() || !subject.trim() || !body} onClick={submit}>
                {t('md.messages.queue')}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthGate>
  )
}
