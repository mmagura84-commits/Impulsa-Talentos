import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'

type Ccr = {
  id: string
  target_type: 'marketing' | 'banking'
  target_id?: string
  requested_by?: string
  requested_fields?: Record<string, unknown> | null
  new_secret_last4?: string
  new_webhook_last4?: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
}

/**
 * HQ admin lane: MD frozen-credentials governance.
 * Lists credential_change_requests (append-only ledger). The live credential
 * stays locked until an admin approves; rejects leave it locked too. Full
 * secrets are never in these public rows — an admin may verify a stored secret
 * via admin_read_credential_secret (SD, admin-only, returns decrypted text).
 */
export function CredentialApprovalsTab() {
  const { t } = useI18n()
  const [rows, setRows] = useState<Ccr[]>([])
  const [loading, setLoading] = useState(true)
  const [secret, setSecret] = useState('')
  const [secretTarget, setSecretTarget] = useState<Ccr | null>(null)

  const load = () => {
    setLoading(true)
    supabase
      .from('credential_change_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        setRows(((error ? [] : data) ?? []) as Ccr[])
        setLoading(false)
      })
  }
  useEffect(load, [])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    const { error } = await supabase.rpc(
      action === 'approve' ? 'approve_credential_change' : 'reject_credential_change',
      { p_request_id: id },
    )
    if (!error) load()
  }

  const verifySecret = async (r: Ccr, field: string) => {
    setSecret('')
    const { data, error } = await supabase.rpc('admin_read_credential_secret', {
      p_target_type: r.target_type,
      p_target_id: r.target_id,
      p_field: field,
    })
    if (error) setSecret(`ERR: ${error.message}`)
    else setSecret((data as string) ?? '')
  }

  const pending = rows.filter(r => r.status === 'pending')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hq.cred.title')}</CardTitle>
        <CardDescription>{t('hq.cred.desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hq.cred.none')}</p>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('hq.cred.pending')}</h3>
              <div className="space-y-3">
                {pending.length === 0 && <p className="text-sm text-muted-foreground">{t('hq.cred.noPending')}</p>}
                {pending.map(r => (
                  <div key={r.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{r.target_type === 'banking' ? t('hq.cred.banking') : t('hq.cred.marketing')}</p>
                        <p className="text-sm text-muted-foreground">{t('hq.cred.by')} {r.requested_by ?? '—'}</p>
                        {r.reason && <p className="mt-1 text-sm">{t('hq.cred.reason')}: {r.reason}</p>}
                        {r.new_secret_last4 && <p className="mt-1 text-xs text-muted-foreground">{t('hq.cred.newSecret')}: …{r.new_secret_last4}</p>}
                        {r.new_webhook_last4 && <p className="text-xs text-muted-foreground">{t('hq.cred.newWebhook')}: …{r.new_webhook_last4}</p>}
                        {r.requested_fields && typeof r.requested_fields === 'object' && (
                          <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">{String(JSON.stringify(r.requested_fields, null, 2))}</pre>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => decide(r.id, 'approve')}>{t('hq.cred.approve')}</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(r.id, 'reject')}>{t('hq.cred.reject')}</Button>
                      </div>
                    </div>
                    {/* Admin secret verification (read-only) */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('hq.cred.verifySecret')}:</span>
                      {r.target_type === 'banking' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => verifySecret(r, 'wompi_private_key')}>{t('hq.cred.wompiKey')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => verifySecret(r, 'wompi_webhook_secret')}>{t('hq.cred.wompiWebhook')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => verifySecret(r, 'account_number')}>{t('hq.cred.account')}</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => verifySecret(r, 'secret')}>{t('hq.cred.secret')}</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {rows.some(r => r.status !== 'pending') && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('hq.cred.history')}</h3>
                <div className="space-y-1">
                  {rows.filter(r => r.status !== 'pending').map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <span>{r.target_type === 'banking' ? t('hq.cred.banking') : t('hq.cred.marketing')} · {t('hq.cred.by')} {r.requested_by ?? '—'}</span>
                      <span className="text-xs capitalize text-muted-foreground">{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {secretTarget && secret !== '' && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{t('hq.cred.verifiedSecret')}</p>
                <p className="break-all font-mono text-xs">{secret}</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => { setSecret(''); setSecretTarget(null) }}>{t('hq.cred.close')}</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Direct-edit affordance kept as an RPC-based path: an admin may UPDATE the
// frozen rows directly via the admin UPDATE policy already certified in 032
// (probe: admin direct-edit OK). The UI above focuses on the change-request
// governance flow; direct-edit of the live secret is intentionally gated to the
// admin_read_credential_secret verification read, not a plaintext write.
