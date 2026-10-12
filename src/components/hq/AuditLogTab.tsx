/**
 * HQ audit log (migration 041): every privileged change — role/approval
 * changes, company verification and credits, moderation, payment decisions,
 * secret reveals, MD assignments, data erasure — recorded by the database.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { History, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import type { Profile } from '@/types'

interface AuditRow {
  id: string
  actor_user_id: string | null
  actor_role: string | null
  action: string
  target_type: string
  target_id: string | null
  before_json: Record<string, unknown> | null
  after_json: Record<string, unknown> | null
  created_at: string
}

export function AuditLogTab({ profiles }: { profiles: Profile[] }) {
  const { t } = useI18n()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const nameOf = (uid: string | null) => {
    if (!uid) return t('hq.audit.system')
    const p = profiles.find(x => x.userId === uid)
    return p ? (p.fullName || p.email || uid) : uid
  }
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) toast.error(error.message)
    setRows((data ?? []) as AuditRow[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])
  const fmt = (o: Record<string, unknown> | null) => (o ? Object.entries(o).map(([k, v]) => `${k}: ${String(v)}`).join(', ') : '')
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><History className="size-4" />{t('hq.audit.title')}</CardTitle>
          <CardDescription>{t('hq.audit.desc')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5"><RefreshCw className="size-3.5" />{t('hq.refresh')}</Button>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hq.audit.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr className="border-b border-border">
                <th className="py-2 px-2">{t('hq.audit.col.when')}</th>
                <th className="py-2 px-2">{t('hq.audit.col.who')}</th>
                <th className="py-2 px-2">{t('hq.audit.col.action')}</th>
                <th className="py-2 px-2">{t('hq.audit.col.change')}</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="py-2 px-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 px-2">{nameOf(r.actor_user_id)}{r.actor_role && <span className="block text-muted-foreground">{r.actor_role}</span>}</td>
                    <td className="py-2 px-2"><span className="font-mono">{r.action}</span><span className="block text-muted-foreground">{r.target_type} {r.target_id ? `· ${r.target_id.slice(0, 8)}` : ''}</span></td>
                    <td className="py-2 px-2 text-muted-foreground">
                      {r.before_json && <span className="block">{t('hq.audit.before')}: {fmt(r.before_json)}</span>}
                      {r.after_json && <span className="block text-foreground">{t('hq.audit.after')}: {fmt(r.after_json)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
