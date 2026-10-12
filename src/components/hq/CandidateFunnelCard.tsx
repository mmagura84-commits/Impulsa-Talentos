/**
 * HQ › Campaigns: which channel brings candidates who finish a profile, upload
 * a CV and apply (admin_campaign_funnel, migration 047), plus a builder for the
 * tagged links to use in posts and ads.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, RefreshCw, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'

interface FunnelRow {
  source: string
  campaign: string
  signups: number
  profiles_completed: number
  cv_uploaded: number
  cv_read: number
  applied: number
}

const SOURCES = ['tiktok', 'instagram', 'facebook', 'whatsapp', 'linkedin', 'partner', 'referral'] as const
const MEDIUM: Record<(typeof SOURCES)[number], string> = {
  tiktok: 'social', instagram: 'social', facebook: 'social', whatsapp: 'messaging',
  linkedin: 'social', partner: 'partner', referral: 'referral',
}
const SITE = 'https://impulsatalentos.expert'
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : '—')
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function CandidateFunnelCard() {
  const { t } = useI18n()
  const [rows, setRows] = useState<FunnelRow[]>([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<(typeof SOURCES)[number]>('tiktok')
  const [campaign, setCampaign] = useState('lanzamiento-candidatos')
  const [page, setPage] = useState('/')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_campaign_funnel')
    if (error) toast.error(error.message)
    setRows(((data ?? []) as FunnelRow[]).map(r => ({ ...r, signups: Number(r.signups), profiles_completed: Number(r.profiles_completed), cv_uploaded: Number(r.cv_uploaded), cv_read: Number(r.cv_read), applied: Number(r.applied) })))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const link = `${SITE}${page.startsWith('/') ? page : `/${page}`}?utm_source=${source}&utm_medium=${MEDIUM[source]}&utm_campaign=${slug(campaign) || 'general'}`
  const total = rows.reduce((a, r) => ({ s: a.s + r.signups, c: a.c + r.cv_uploaded, ap: a.ap + r.applied }), { s: 0, c: 0, ap: 0 })

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> {t('hq.funnel.title')}</CardTitle>
          <CardDescription>{t('hq.funnel.desc')}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5"><RefreshCw className="size-3.5" />{t('hq.funnel.refresh')}</Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">{t('hq.funnel.source')}</th>
                <th className="py-2 pr-3 font-medium">{t('hq.funnel.campaign')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('hq.funnel.signups')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('hq.funnel.profiles')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('hq.funnel.cvs')}</th>
                <th className="py-2 pr-3 text-right font-medium">{t('hq.funnel.cvRead')}</th>
                <th className="py-2 text-right font-medium">{t('hq.funnel.applied')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">{loading ? t('hq.funnel.loading') : t('hq.funnel.empty')}</td></tr>
              )}
              {rows.map(r => (
                <tr key={`${r.source}|${r.campaign}`} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{r.source}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.campaign}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.signups}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.profiles_completed} <span className="text-xs text-muted-foreground">{pct(r.profiles_completed, r.signups)}</span></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.cv_uploaded} <span className="text-xs text-muted-foreground">{pct(r.cv_uploaded, r.signups)}</span></td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.cv_read}</td>
                  <td className="py-2 text-right tabular-nums">{r.applied} <span className="text-xs text-muted-foreground">{pct(r.applied, r.signups)}</span></td>
                </tr>
              ))}
            </tbody>
            {rows.length > 1 && (
              <tfoot className="text-xs text-muted-foreground">
                <tr><td className="pt-2" colSpan={2}>{t('hq.funnel.total')}</td><td className="pt-2 text-right">{total.s}</td><td /><td className="pt-2 text-right">{total.c} ({pct(total.c, total.s)})</td><td /><td className="pt-2 text-right">{total.ap} ({pct(total.ap, total.s)})</td></tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="rounded-xl border border-dashed p-4">
          <p className="text-sm font-medium">{t('hq.funnel.linkTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('hq.funnel.linkDesc')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_1fr]">
            <select value={source} onChange={e => setSource(e.target.value as (typeof SOURCES)[number])} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label={t('hq.funnel.source')}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <Input value={campaign} onChange={e => setCampaign(e.target.value)} aria-label={t('hq.funnel.campaign')} placeholder={t('hq.funnel.campaign')} />
            <Input value={page} onChange={e => setPage(e.target.value)} aria-label={t('hq.funnel.page')} placeholder="/jobs" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">{link}</code>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard?.writeText(link).then(() => toast.success(t('hq.funnel.copied'))) }}><Copy className="size-3.5" />{t('hq.funnel.copy')}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
