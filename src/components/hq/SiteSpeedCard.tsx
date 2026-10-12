/**
 * HQ › Campaigns › Site speed: how fast the site really is for visitors (75th
 * percentile of real page loads, from hq_web_vitals_summary — migration 051).
 * Google's "good" lines: main content ≤ 2.5 s, tap delay ≤ 200 ms, layout
 * shift ≤ 0.1. Our own target for the main content is 2 s.
 */
import { useEffect, useState } from 'react'
import { Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'

type Row = {
  page: string
  device: 'mobile' | 'desktop'
  samples: number
  lcp_p75_ms: number | null
  fcp_p75_ms: number | null
  ttfb_p75_ms: number | null
  inp_p75_ms: number | null
  cls_p75: number | null
  lcp_good_pct: number | null
}

const sec = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)} s`)
const tone = (ok: boolean | null) => (ok == null ? '' : ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')

export function SiteSpeedCard() {
  const { t } = useI18n()
  const [days, setDays] = useState(7)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    setRows(null)
    void supabase.rpc('hq_web_vitals_summary', { p_days: days }).then(({ data, error: e }) => {
      if (!active) return
      if (e) { setError(e.message); setRows([]) } else { setError(''); setRows((data ?? []) as Row[]) }
    })
    return () => { active = false }
  }, [days])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gauge className="size-4 text-primary" /> {t('hq.speed.title')}</CardTitle>
        <CardDescription>{t('hq.speed.desc')}</CardDescription>
        <div className="flex gap-1 pt-1">
          {[1, 7, 30].map((d) => (
            <Button key={d} size="sm" variant={d === days ? 'default' : 'outline'} className="h-7 px-2.5 text-xs" onClick={() => setDays(d)}>
              {t('hq.speed.days', { n: d })}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {rows == null ? <div className="h-24 animate-pulse rounded-md bg-muted" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hq.speed.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">{t('hq.speed.page')}</th>
                  <th className="py-2 pr-3 font-medium">{t('hq.speed.device')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('hq.speed.visits')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('hq.speed.main')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('hq.speed.first')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('hq.speed.tap')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('hq.speed.shift')}</th>
                  <th className="py-2 text-right font-medium">{t('hq.speed.good')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.page}|${r.device}`} className={`border-b last:border-0 ${r.page === '(all)' ? 'font-semibold' : ''}`}>
                    <td className="py-2 pr-3 font-mono text-xs">{r.page === '(all)' ? t('hq.speed.allPages') : r.page}</td>
                    <td className="py-2 pr-3">{r.device === 'mobile' ? t('hq.speed.phone') : t('hq.speed.desktop')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.samples}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${tone(r.lcp_p75_ms == null ? null : r.lcp_p75_ms <= 2000)}`}>{sec(r.lcp_p75_ms)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{sec(r.fcp_p75_ms)}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${tone(r.inp_p75_ms == null ? null : r.inp_p75_ms <= 200)}`}>{r.inp_p75_ms == null ? '—' : `${r.inp_p75_ms} ms`}</td>
                    <td className={`py-2 pr-3 text-right tabular-nums ${tone(r.cls_p75 == null ? null : Number(r.cls_p75) <= 0.1)}`}>{r.cls_p75 == null ? '—' : Number(r.cls_p75).toFixed(2)}</td>
                    <td className="py-2 text-right tabular-nums">{r.lcp_good_pct == null ? '—' : `${r.lcp_good_pct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t('hq.speed.note')}</p>
      </CardContent>
    </Card>
  )
}
