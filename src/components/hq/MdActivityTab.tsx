import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listRows, updateRow } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import {
  Mail,
  KeyRound,
  UserCheck,
  Users,
  Activity,
  ShieldAlert,
  Megaphone,
  CheckCircle2,
  XCircle,
  ListChecks,
  Loader2,
} from 'lucide-react'
import type { Profile } from '@/types'

/**
 * HQ OWNER/ADMIN lane — "MD Activity / Oversight".
 *
 * Owner request: "From my HQ dashboard I want full visibility over what the MD
 * role is doing and working on. Currently I only have the MD Approvals option."
 *
 * This tab is READ-ONLY (owner/admin) and surfaces every piece of MD activity
 * that is actually RECORDED in the database. It adds NO new write permissions
 * and NO new data model changes by itself (the md_audit_log lane from migration
 * 037 is the one addition owned by this feature). Sources (all admin-readable
 * via existing RLS + the audit SD RPC):
 *   - MD accounts: profiles where role='md' (status pending|active|rejected)
 *   - Messages outbox: md_list_messages() SD RPC — admin=all
 *   - Frozen-credential change requests: credential_change_requests ledger
 *   - MD action audit log: md_list_audit() SD RPC — admin=all (migration 037)
 *   - Responsibility summary: marketing_channels active set + counts derived
 *     from the recorded ledgers above
 * The pending-MD-account approve/reject capability from MdApprovalsTab is
 * preserved here (the one existing admin write, unchanged permissions).
 *
 * Honest gap note (also in the PR): action-level MD dashboard activity is now
 * logged (migration 037). Passive "page views / browsing" by the MD is still NOT
 * logged today, so "full visibility" of raw browsing would require an additional
 * client-side view-event capture layer. This tab shows everything that is
 * recorded, including the new action audit log.
 */

type MdMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  recipient_email?: string
  subject?: string
  body?: string
  status: 'queued' | 'delivered' | 'failed'
  created_at: string
}

type Ccr = {
  id: string
  target_type: 'marketing' | 'banking'
  requested_by?: string
  new_secret_last4?: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

type ActivityEvent = {
  id: string
  kind: 'message' | 'credential'
  ts: string
  title: string
  sub: string
  status: string
  statusTone: 'ok' | 'warn' | 'err' | 'muted'
}

type AuditRow = {
  id: string
  action: string
  entity_type: string
  entity_ref: string
  metadata: Record<string, unknown> | null
  created_at: string
}
const fmt = (s?: string) => (s ? new Date(s).toLocaleString() : '—')

export function MdActivityTab() {
  const { t } = useI18n()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [messages, setMessages] = useState<MdMessage[]>([])
  const [ccrs, setCcrs] = useState<Ccr[]>([])
  const [channelsActive, setChannelsActive] = useState(0)
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [profilesRes, msgRes, ccrRes, chRes, auditRes] = await Promise.all([
        listRows<Profile>('profiles', { where: { role: 'md' } }).catch(() => [] as Profile[]),
        supabase.rpc('md_list_messages').then(r => (r.error ? ([] as MdMessage[]) : ((r.data ?? []) as MdMessage[]))),
        supabase.from('credential_change_requests').select('*').then(r => (r.error ? ([] as Ccr[]) : ((r.data ?? []) as Ccr[]))),
        supabase.from('marketing_channels').select('code, active').then(r => (r.error ? 0 : (r.data ?? []).filter((c: { active: boolean }) => c.active).length)),
        supabase.rpc('md_list_audit').then(r => (r.error ? ([] as AuditRow[]) : ((r.data ?? []) as AuditRow[]))),
      ])
      setProfiles(profilesRes)
      setMessages(msgRes)
      setCcrs(ccrs)
      setChannelsActive(chRes)
      setAudit(auditRes)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const events = useMemo<ActivityEvent[]>(() => {
    const ev: ActivityEvent[] = []
    for (const m of messages) {
      ev.push({
        id: `msg-${m.id}`,
        kind: 'message',
        ts: m.created_at,
        title: m.subject || t('hq.mdact.noSubject'),
        sub: `${m.direction} · ${m.recipient_email ?? m.id}`,
        status: m.status,
        statusTone: m.status === 'delivered' ? 'ok' : m.status === 'failed' ? 'err' : 'warn',
      })
    }
    for (const c of ccrs) {
      ev.push({
        id: `ccr-${c.id}`,
        kind: 'credential',
        ts: c.created_at || '',
        title: `${t('hq.mdact.credRequest')} — ${t(c.target_type === 'banking' ? 'hq.cred.banking' : 'hq.cred.marketing')}`,
        sub: c.requested_by ? `${t('hq.cred.by')}: ${c.requested_by}` : '',
        status: c.status,
        statusTone: c.status === 'approved' ? 'ok' : c.status === 'rejected' ? 'err' : 'warn',
      })
    }
    ev.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))
    return ev
  }, [messages, ccrs, t])

  const pendingProfiles = profiles.filter(p => p.profileStatus === 'pending')

  const decide = async (id: string, status: 'active' | 'rejected') => {
    await updateRow('profiles', id, { profileStatus: status, updatedAt: new Date().toISOString() }).catch(() => {})
    load()
  }

  if (loading) {
    return (
      <Card><CardContent className="flex items-center gap-2 py-10 justify-center text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t('common.loading')}</CardContent></Card>
    )
  }

  const sentCount = messages.filter(m => m.direction === 'outbound').length
  const pendingCreds = ccrs.filter(c => c.status === 'pending').length
  const approvedCreds = ccrs.filter(c => c.status === 'approved').length

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Summary icon={Users} label={t('hq.mdact.mdAccounts')} value={profiles.length} />
        <Summary icon={Mail} label={t('hq.mdact.messagesSent')} value={sentCount} />
        <Summary icon={KeyRound} label={t('hq.mdact.pendingCreds')} value={pendingCreds} />
        <Summary icon={Megaphone} label={t('hq.mdact.channelsActive')} value={channelsActive} />
      </div>

      {/* MD accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck className="size-4 text-primary" />{t('hq.mdact.accounts')}</CardTitle>
          <CardDescription>{t('hq.mdact.accountsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.mdact.noAccounts')}</p>
          ) : (
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{p.fullName || p.email}</p>
                    <p className="text-sm text-muted-foreground">{p.email}</p>
                    <p className="text-xs text-muted-foreground">{t('hq.mdact.created')}: {fmt(p.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.profileStatus === 'active' ? 'default' : p.profileStatus === 'rejected' ? 'destructive' : 'secondary'}>
                      {t(`hq.mdact.status.${p.profileStatus || 'active'}`)}
                    </Badge>
                    {p.profileStatus === 'active' && <span className="text-xs text-muted-foreground">{t('hq.mdact.activeUser')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending approvals (preserved capability) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4 text-primary" />{t('hq.mdApprovals')}</CardTitle>
          <CardDescription>{t('hq.mdact.pendingDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.mdNoPending')}</p>
          ) : (
            <div className="space-y-2">
              {pendingProfiles.map(r => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{r.fullName || '—'}</p>
                    <p className="text-sm text-muted-foreground">{r.email}</p>
                    <p className="text-xs text-muted-foreground">{fmt(r.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(r.id, 'active')}><CheckCircle2 className="size-4" />{t('hq.mdApprove')}</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r.id, 'rejected')}><XCircle className="size-4" />{t('hq.mdReject')}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activity feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="size-4 text-primary" />{t('hq.mdact.feed')}</CardTitle>
          <CardDescription>{t('hq.mdact.feedDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.mdact.noActivity')}</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 25).map(e => (
                <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-0.5 shrink-0">{e.kind === 'message' ? <Mail className="size-4 text-primary" /> : <KeyRound className="size-4 text-accent" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{e.title}</p>
                    {e.sub && <p className="text-xs text-muted-foreground truncate">{e.sub}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(e.ts)}</p>
                  </div>
                  <Badge variant={e.statusTone === 'ok' ? 'default' : e.statusTone === 'err' ? 'destructive' : e.statusTone === 'warn' ? 'secondary' : 'outline'}>
                    {t(`hq.mdact.feed.${e.status}`)}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit log (action-level, migration 037) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListChecks className="size-4 text-primary" />{t('hq.mdact.auditTitle')}</CardTitle>
          <CardDescription>{t('hq.mdact.auditDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('hq.mdact.noAudit')}</p>
          ) : (
            <div className="space-y-2">
              {audit.slice(0, 50).map(a => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-0.5 shrink-0"><ListChecks className="size-4 text-primary" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{t(`hq.mdact.audit.${a.action}`)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{a.entity_type}{a.entity_ref ? ` · ${a.entity_ref}` : ''}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmt(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Honest gap note */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">{t('hq.mdact.gapNote')}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Summary({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-5" /></div>
        <div className="min-w-0"><p className="text-2xl font-bold leading-none">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  )
}
