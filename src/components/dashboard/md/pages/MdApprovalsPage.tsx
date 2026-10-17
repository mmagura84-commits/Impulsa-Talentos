import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { BadgeCheck, CheckCircle2, XCircle } from 'lucide-react'
import { AuthGate } from '@/components/AuthGate'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'

interface PendingJob { id: string; title: string; company_id: string; created_at: string }
interface PendingCompany { id: string; name: string; created_at: string; verification_requested: boolean | null }

/**
 * Managing Director approvals: job postings waiting for review and businesses
 * waiting for verification. Both go through narrow database functions
 * (migration 053) that only the MD (and the audit log) can use.
 */
export function Approvals() {
  const { t, locale } = useI18n()
  const [jobs, setJobs] = useState<PendingJob[]>([])
  const [companies, setCompanies] = useState<PendingCompany[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [j, c] = await Promise.all([
      supabase.from('jobs').select('id, title, company_id, created_at').eq('moderation_status', 'pending').order('created_at', { ascending: true }),
      supabase.from('companies').select('id, name, created_at, verification_requested').eq('verified', false).order('created_at', { ascending: true }),
    ])
    if (j.error) toast.error(`${t('md.approvals.error')} ${j.error.message}`)
    if (c.error) toast.error(`${t('md.approvals.error')} ${c.error.message}`)
    const jobRows = (j.data ?? []) as PendingJob[]
    const compRows = (c.data ?? []) as PendingCompany[]
    setJobs(jobRows)
    setCompanies(compRows)
    const ids = [...new Set(jobRows.map(r => r.company_id))].filter(id => !compRows.some(x => x.id === id))
    const map: Record<string, string> = Object.fromEntries(compRows.map(x => [x.id, x.name]))
    if (ids.length) {
      const { data } = await supabase.from('companies').select('id, name').in('id', ids)
      for (const r of (data ?? []) as { id: string; name: string }[]) map[r.id] = r.name
    }
    setNames(map)
    setLoading(false)
  }, [t])
  useEffect(() => { void load() }, [load])

  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const moderate = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(id)
    const { error } = await supabase.rpc('md_moderate_job', { p_job_id: id, p_status: status, p_reason: status === 'rejected' ? reason : null })
    setBusy(null)
    if (error) { toast.error(`${t('md.approvals.error')} ${error.message}`); return }
    toast.success(status === 'approved' ? t('md.approvals.jobApproved') : t('md.approvals.jobRejected'))
    setRejecting(null)
    setReason('')
    void load()
  }

  const verify = async (id: string) => {
    setBusy(id)
    const { error } = await supabase.rpc('md_set_company_verified', { p_company_id: id, p_verified: true })
    setBusy(null)
    if (error) { toast.error(`${t('md.approvals.error')} ${error.message}`); return }
    toast.success(t('md.approvals.verifiedToast'))
    void load()
  }

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('md.approvals.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('md.approvals.desc')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {t('md.approvals.jobsTitle')}
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">{jobs.length}</span>
            </CardTitle>
            <CardDescription>{t('md.approvals.jobsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('md.approvals.jobsEmpty')}</p>
            ) : jobs.map(j => (
              <div key={j.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to="/jobs/$id" params={{ id: j.id }} className="text-sm font-medium text-foreground hover:text-primary hover:underline">{j.title}</Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">{names[j.company_id] ?? '—'} · {t('md.approvals.posted', { date: date(j.created_at) })}</p>
                  </div>
                  {rejecting !== j.id && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" className="h-10 gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/5 sm:h-9" disabled={busy === j.id} onClick={() => void moderate(j.id, 'approved')}>
                        <CheckCircle2 className="size-4" />{t('md.approvals.approve')}
                      </Button>
                      <Button size="sm" variant="outline" className="h-10 gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5 sm:h-9" disabled={busy === j.id} onClick={() => { setRejecting(j.id); setReason('') }}>
                        <XCircle className="size-4" />{t('md.approvals.reject')}
                      </Button>
                    </div>
                  )}
                </div>
                {rejecting === j.id && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input autoFocus aria-label={t('md.approvals.reasonPlaceholder')} value={reason} onChange={e => setReason(e.target.value)} placeholder={t('md.approvals.reasonPlaceholder')} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base sm:text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="h-10" disabled={busy === j.id} onClick={() => void moderate(j.id, 'rejected')}>{t('md.approvals.confirmReject')}</Button>
                      <Button size="sm" variant="ghost" className="h-10" onClick={() => setRejecting(null)}>{t('md.approvals.cancel')}</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {t('md.approvals.bizTitle')}
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700">{companies.length}</span>
            </CardTitle>
            <CardDescription>{t('md.approvals.bizDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('md.approvals.bizEmpty')}</p>
            ) : companies.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {date(c.created_at)}{c.verification_requested ? ` · ${t('md.approvals.verifyRequested')}` : ''}
                  </p>
                </div>
                <Button size="sm" className="h-10 gap-1.5 sm:h-9" disabled={busy === c.id} onClick={() => void verify(c.id)}>
                  <BadgeCheck className="size-4" />{t('md.approvals.verify')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AuthGate>
  )
}
