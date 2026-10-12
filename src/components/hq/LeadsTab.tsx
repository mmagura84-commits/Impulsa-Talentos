/**
 * Sales leads (pricing page / for-employers forms). HQ and the MD can work
 * them: status pipeline new → contacted → converted / closed, plus notes.
 * Readable only by admin/MD (migration 041).
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Inbox, RefreshCw, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'

interface LeadRow {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  company: string | null
  source: string | null
  status: 'new' | 'contacted' | 'converted' | 'closed'
  notes: string | null
  created_at: string
}

const STATUSES: LeadRow['status'][] = ['new', 'contacted', 'converted', 'closed']

export function LeadsTab() {
  const { t } = useI18n()
  const [rows, setRows] = useState<LeadRow[]>([])
  const [filter, setFilter] = useState<'all' | LeadRow['status']>('all')
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows((data ?? []) as LeadRow[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const save = async (id: string, patch: Partial<Pick<LeadRow, 'status' | 'notes'>>) => {
    const { error } = await supabase.from('leads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select('id')
    if (error) { toast.error(error.message); return }
    toast.success(t('hq.leads.saved'))
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  const shown = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><Inbox className="size-4" />{t('hq.leadsTitle')}</CardTitle>
          <CardDescription>{t('hq.leads.desc')}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label={t('hq.leads.filter')} value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
            <option value="all">{t('hq.leads.all')}</option>
            {STATUSES.map(s => <option key={s} value={s}>{t(`hq.leads.${s}`)}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5"><RefreshCw className="size-3.5" />{t('hq.refresh')}</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hq.leads.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr className="border-b border-border">
                <th className="py-2 px-2">{t('hq.leads.colCreated')}</th>
                <th className="py-2 px-2">{t('hq.leads.colName')}</th>
                <th className="py-2 px-2">{t('hq.leads.colCompany')}</th>
                <th className="py-2 px-2">{t('hq.leads.colEmail')}</th>
                <th className="py-2 px-2">{t('hq.leads.colSource')}</th>
                <th className="py-2 px-2">{t('hq.leads.colStatus')}</th>
                <th className="py-2 px-2">{t('hq.leads.colNotes')}</th>
              </tr></thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="py-2 px-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-2 font-medium text-foreground">{r.name || '—'}</td>
                    <td className="py-2 px-2">{r.company || '—'}</td>
                    <td className="py-2 px-2">
                      {r.email ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={`mailto:${r.email}`}><Mail className="size-3" />{r.email}</a> : '—'}
                      {r.phone && <span className="block text-muted-foreground">{r.phone}</span>}
                    </td>
                    <td className="py-2 px-2">{r.source || '—'}</td>
                    <td className="py-2 px-2">
                      <select aria-label={t('hq.leads.colStatus')} value={r.status} onChange={e => void save(r.id, { status: e.target.value as LeadRow['status'] })} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs">
                        {STATUSES.map(s => <option key={s} value={s}>{t(`hq.leads.${s}`)}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-2 min-w-[12rem]">
                      <div className="flex gap-1">
                        <input aria-label={t('hq.leads.colNotes')} className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs" value={drafts[r.id] ?? r.notes ?? ''} onChange={e => setDrafts(d => ({ ...d, [r.id]: e.target.value }))} />
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={(drafts[r.id] ?? r.notes ?? '') === (r.notes ?? '')} onClick={() => void save(r.id, { notes: drafts[r.id] ?? '' })}>{t('common.save')}</Button>
                      </div>
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
