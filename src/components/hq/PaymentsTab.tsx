/**
 * HQ payments queue (migration 041): employers' bank-transfer / card payment
 * claims wait here until HQ checks the money arrived, then approve (credits +
 * plan limits applied, employer notified) or reject.
 */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, RefreshCw, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'

interface PaymentRow {
  id: string
  company_id: string
  company_name: string | null
  package_id: string
  amount_usd: number
  requested_credits: number
  status: 'pending_verification' | 'granted' | 'rejected'
  transaction_reference: string
  proof_note: string
  submitter_email: string | null
  created_at: string
  decided_at: string | null
}

const STATUS_CLASS: Record<PaymentRow['status'], string> = {
  pending_verification: 'border-amber-500/40 text-amber-700 bg-amber-500/10',
  granted: 'border-emerald-500/40 text-emerald-700 bg-emerald-500/10',
  rejected: 'border-destructive/40 text-destructive bg-destructive/10',
}

export function PaymentsTab() {
  const { t } = useI18n()
  const [rows, setRows] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ row: PaymentRow; approve: boolean } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_payments')
    if (error) toast.error(error.message)
    setRows((data ?? []) as PaymentRow[])
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const decide = async (row: PaymentRow, approve: boolean) => {
    setBusy(row.id)
    const { error } = await supabase.rpc(approve ? 'grant_company_credits' : 'reject_manual_payment', { p_payment_id: row.id })
    setBusy(null)
    setConfirm(null)
    if (error) { toast.error(error.message); return }
    toast.success(approve ? t('hq.payments.approved') : t('hq.payments.rejected'))
    void load()
  }

  const pending = rows.filter(r => r.status === 'pending_verification').length

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="size-4" />{t('hq.payments.title')}</CardTitle>
          <CardDescription>{t('hq.payments.desc')} {pending > 0 && <strong className="text-amber-700">{t('hq.payments.pendingCount', { n: pending })}</strong>}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5"><RefreshCw className="size-3.5" />{t('hq.refresh')}</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hq.payments.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 px-2">{t('hq.payments.col.date')}</th>
                  <th className="py-2 px-2">{t('hq.payments.col.company')}</th>
                  <th className="py-2 px-2">{t('hq.payments.col.plan')}</th>
                  <th className="py-2 px-2">{t('hq.payments.col.amount')}</th>
                  <th className="py-2 px-2">{t('hq.payments.col.reference')}</th>
                  <th className="py-2 px-2">{t('hq.payments.col.status')}</th>
                  <th className="py-2 px-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-border/60 align-top">
                    <td className="py-2.5 px-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2.5 px-2">
                      <span className="font-medium text-foreground">{r.company_name ?? '—'}</span>
                      {r.submitter_email && <span className="block text-muted-foreground">{r.submitter_email}</span>}
                    </td>
                    <td className="py-2.5 px-2">{r.package_id} · {t('hq.payments.credits', { n: r.requested_credits })}</td>
                    <td className="py-2.5 px-2 whitespace-nowrap">US$ {Number(r.amount_usd).toLocaleString()}</td>
                    <td className="py-2.5 px-2">
                      <span className="font-mono">{r.transaction_reference}</span>
                      {r.proof_note && <span className="block text-muted-foreground">{r.proof_note}</span>}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs sm:text-[10px] font-medium ${STATUS_CLASS[r.status]}`}>
                        {t(`hq.payments.status.${r.status}`)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 whitespace-nowrap">
                      {r.status === 'pending_verification' && (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 gap-1 text-xs sm:text-[11px]" disabled={busy === r.id} onClick={() => setConfirm({ row: r, approve: true })}>
                            <CheckCircle2 className="size-3" />{t('hq.payments.approve')}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs sm:text-[11px]" disabled={busy === r.id} onClick={() => setConfirm({ row: r, approve: false })}>
                            <XCircle className="size-3" />{t('hq.payments.reject')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirm(null)} />
          <div className="relative z-10 w-[min(92vw,26rem)] rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-1 font-serif text-lg font-bold text-foreground">
              {confirm.approve ? t('hq.payments.confirmApproveTitle') : t('hq.payments.confirmRejectTitle')}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">
              {confirm.approve
                ? t('hq.payments.confirmApproveDesc', { company: confirm.row.company_name ?? '', amount: confirm.row.amount_usd, ref: confirm.row.transaction_reference, n: confirm.row.requested_credits })
                : t('hq.payments.confirmRejectDesc', { company: confirm.row.company_name ?? '' })}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
              <Button variant={confirm.approve ? 'default' : 'destructive'} disabled={busy !== null} onClick={() => void decide(confirm.row, confirm.approve)}>
                {confirm.approve ? t('hq.payments.approve') : t('hq.payments.reject')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
