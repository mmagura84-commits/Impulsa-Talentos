import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AuthGate } from '@/components/AuthGate'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { logMdAudit } from '@/lib/mdAudit'
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'

type BankRow = {
  bank_name: string
  account_type: string
  account_number_last4: string
  titular_name: string
  nit_rust: string
  swift_code: string
  wompi_public_key: string
  wompi_private_key_last4: string
  wompi_webhook_last4: string
  wompi_payment_link_url: string
  status: string
  locked: boolean
}

type FieldState = {
  bankName: string
  accountType: string
  accountNumber: string
  accountNumberLast4: string
  titularName: string
  nitRust: string
  swiftCode: string
  wompiPublicKey: string
  wompiPrivateKey: string
  wompiPrivateKeyLast4: string
  wompiWebhook: string
  wompiWebhookLast4: string
  wompiPaymentLinkUrl: string
}

const emptyField: FieldState = {
  bankName: '', accountType: '', accountNumber: '', accountNumberLast4: '',
  titularName: '', nitRust: '', swiftCode: '', wompiPublicKey: '',
  wompiPrivateKey: '', wompiPrivateKeyLast4: '', wompiWebhook: '', wompiWebhookLast4: '',
  wompiPaymentLinkUrl: '',
}

export function Banking() {
  const { t } = useI18n()
  const { user } = useAuth()
  const ok = useIsMd()
  const nav = useNavigate()
  const [bank, setBank] = useState<BankRow | null>(null)
  const [bankId, setBankId] = useState('')
  const [form, setForm] = useState<FieldState>({ ...emptyField })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // change request
  const [crOpen, setCrOpen] = useState(false)
  const [cr, setCr] = useState({ bankName: '', accountType: '', titularName: '', nitRust: '', swiftCode: '', wompiPublicKey: '', wompiPrivateKey: '', wompiPrivateKeyLast4: '', wompiPaymentLinkUrl: '', reason: '' })

  useEffect(() => {
    if (!ok) nav({ to: '/dashboard', replace: true })
  }, [ok, nav])

  useEffect(() => {
    if (!user?.id) return
    reload()
  }, [user?.id])

  const reload = async () => {
    const { data: rows } = await supabase.rpc('list_my_banking')
    const arr = (rows as BankRow[]) ?? []
    if (arr.length) {
      setBank(arr[0])
      setForm({
        bankName: arr[0].bank_name, accountType: arr[0].account_type,
        accountNumber: '', accountNumberLast4: arr[0].account_number_last4,
        titularName: arr[0].titular_name, nitRust: arr[0].nit_rust,
        swiftCode: arr[0].swift_code, wompiPublicKey: arr[0].wompi_public_key,
        wompiPrivateKey: '', wompiPrivateKeyLast4: arr[0].wompi_private_key_last4,
        wompiWebhook: '', wompiWebhookLast4: arr[0].wompi_webhook_last4,
        wompiPaymentLinkUrl: arr[0].wompi_payment_link_url,
      })
    }
    // fetch the single frozen banking id for change-request targeting (own row via RLS)
    const { data: idRows } = await supabase.from('business_banking').select('id').limit(1)
    setBankId((idRows as { id: string }[])?.[0]?.id ?? '')
  }

  const set = (key: keyof FieldState, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'accountNumber') next.accountNumberLast4 = value ? value.slice(-4) : ''
      if (key === 'wompiPrivateKey') next.wompiPrivateKeyLast4 = value ? value.slice(-4) : ''
      if (key === 'wompiWebhook') next.wompiWebhookLast4 = value ? value.slice(-4) : ''
      return next
    })
  }

  const save = async () => {
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('submit_banking', {
      p_bank_name: form.bankName,
      p_account_type: form.accountType,
      p_account_number: form.accountNumber || null,
      p_account_number_last4: form.accountNumberLast4,
      p_titular_name: form.titularName,
      p_nit_rust: form.nitRust,
      p_swift_code: form.swiftCode,
      p_wompi_public_key: form.wompiPublicKey,
      p_wompi_private_key: form.wompiPrivateKey || null,
      p_wompi_private_key_last4: form.wompiPrivateKeyLast4,
      p_wompi_webhook_secret: form.wompiWebhook || null,
      p_wompi_webhook_last4: form.wompiWebhookLast4,
      p_wompi_payment_link_url: form.wompiPaymentLinkUrl,
    })
    if (error) {
      setError(t('md.banking.saveError') + ' ' + error.message)
    } else {
      setNotice(t('md.banking.saved'))
      await logMdAudit('credential_submitted', 'banking', '', { bank_name: form.bankName })
      await reload()
    }
    setBusy(false)
  }

  const updateCr = (key: keyof typeof cr, value: string) => {
    setCr((c) => {
      const next = { ...c, [key]: value }
      if (key === 'wompiPrivateKey') next.wompiPrivateKeyLast4 = value ? value.slice(-4) : ''
      return next
    })
  }

  const requestChange = async () => {
    if (!bankId) return
    setBusy(true)
    setError('')
    const { error } = await supabase.rpc('request_credential_change', {
      p_target_type: 'banking',
      p_target_id: bankId,
      p_requested_fields: {
        bank_name: cr.bankName, account_type: cr.accountType,
        titular_name: cr.titularName, nit_rust: cr.nitRust,
        swift_code: cr.swiftCode, wompi_public_key: cr.wompiPublicKey,
        wompi_payment_link_url: cr.wompiPaymentLinkUrl,
      },
      p_new_secret: cr.wompiPrivateKey || null,
      p_new_secret_last4: cr.wompiPrivateKeyLast4,
      p_reason: cr.reason,
    })
    if (error) {
      setError(t('md.request.error') + ' ' + error.message)
    } else {
      setNotice(t('md.request.submitted'))
      await logMdAudit('credential_change_requested', 'banking', bankId, {})
      setCr({ bankName: '', accountType: '', titularName: '', nitRust: '', swiftCode: '', wompiPublicKey: '', wompiPrivateKey: '', wompiPrivateKeyLast4: '', wompiPaymentLinkUrl: '', reason: '' })
      setCrOpen(false)
      await reload()
    }
    setBusy(false)
  }

  const locked = !!bank?.locked

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <div className="mx-auto max-w-2xl p-6">
        <MdNav />
        <h1 className="text-3xl font-bold">{t('md.banking.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('md.banking.description')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('md.freezeHint')}</p>
        {error && <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">{notice}</p>}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{locked ? t('md.banking.submitted') : t('md.banking.formTitle')}</span>
              {locked && (
                <Badge variant={bank?.status === 'change_requested' ? 'secondary' : 'default'}>
                  {bank?.status === 'change_requested' ? t('md.banking.changeRequested') : t('md.banking.locked')}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          {!locked ? (
            <CardContent className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="bankName">{t('md.banking.bankName')}</Label>
                <Input id="bankName" value={form.bankName} onChange={(e) => set('bankName', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="accountType">{t('md.banking.accountType')}</Label>
                <Input id="accountType" value={form.accountType} onChange={(e) => set('accountType', e.target.value)} placeholder={t('md.banking.accountTypePlaceholder')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="accountNumber">{t('md.banking.accountNumber')}</Label>
                <Input id="accountNumber" type="password" value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="titularName">{t('md.banking.titularName')}</Label>
                <Input id="titularName" value={form.titularName} onChange={(e) => set('titularName', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nitRust">{t('md.banking.nitRut')}</Label>
                <Input id="nitRust" value={form.nitRust} onChange={(e) => set('nitRust', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="swiftCode">{t('md.banking.swiftCode')}</Label>
                <Input id="swiftCode" value={form.swiftCode} onChange={(e) => set('swiftCode', e.target.value)} />
              </div>
              <div className="mt-2 rounded-md border p-3">
                <p className="mb-2 text-sm font-semibold">{t('md.banking.wompiSection')}</p>
                <div className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="wompiPublicKey">{t('md.banking.wompiPublicKey')}</Label>
                    <Input id="wompiPublicKey" value={form.wompiPublicKey} onChange={(e) => set('wompiPublicKey', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="wompiPrivateKey">{t('md.banking.wompiPrivateKey')}</Label>
                    <Input id="wompiPrivateKey" type="password" value={form.wompiPrivateKey} onChange={(e) => set('wompiPrivateKey', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="wompiWebhook">{t('md.banking.wompiWebhook')}</Label>
                    <Input id="wompiWebhook" type="password" value={form.wompiWebhook} onChange={(e) => set('wompiWebhook', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="wompiPaymentLinkUrl">{t('md.banking.wompiPaymentLinkUrl')}</Label>
                    <Input id="wompiPaymentLinkUrl" value={form.wompiPaymentLinkUrl} onChange={(e) => set('wompiPaymentLinkUrl', e.target.value)} placeholder="https://checkout.wompi.co/l/…" />
                  </div>
                </div>
              </div>
              <Button disabled={!ok || busy} onClick={save}>
                {busy ? t('md.banking.saving') : t('md.banking.submit')}
              </Button>
            </CardContent>
          ) : (
            <CardContent className="grid gap-2 text-sm">
              <p className="text-muted-foreground">{t('md.banking.bankName')}: <span className="text-foreground">{bank?.bank_name || '—'}</span></p>
              <p className="text-muted-foreground">{t('md.banking.accountType')}: <span className="text-foreground">{bank?.account_type || '—'}</span></p>
              <p className="text-muted-foreground">{t('md.banking.accountNumber')}: <span className="text-foreground">{t('md.marketing.maskedPrefix')}{bank?.account_number_last4 || ''}</span></p>
              <p className="text-muted-foreground">{t('md.banking.titularName')}: <span className="text-foreground">{bank?.titular_name || '—'}</span></p>
              <p className="text-muted-foreground">{t('md.banking.nitRut')}: <span className="text-foreground">{bank?.nit_rust || '—'}</span></p>
              <p className="text-muted-foreground">{t('md.banking.swiftCode')}: <span className="text-foreground">{bank?.swift_code || '—'}</span></p>
              <p className="text-muted-foreground">{t('md.banking.wompiPublicKey')}: <span className="break-all text-foreground">{bank?.wompi_public_key || '—'}</span></p>
              {bank?.wompi_payment_link_url && (
                <p className="text-muted-foreground">{t('md.banking.wompiPaymentLinkUrl')}: <span className="break-all text-foreground">{t('md.marketing.maskedPrefix')}{bank.wompi_payment_link_url.slice(-8)}</span></p>
              )}
              {bank?.wompi_private_key_last4 && (
                <p className="text-muted-foreground">{t('md.banking.wompiPrivateKey')}: <span className="text-foreground">{t('md.marketing.maskedPrefix')}{bank.wompi_private_key_last4}</span></p>
              )}
              {bank?.wompi_webhook_last4 && (
                <p className="text-muted-foreground">{t('md.banking.wompiWebhook')}: <span className="text-foreground">{t('md.marketing.maskedPrefix')}{bank.wompi_webhook_last4}</span></p>
              )}
              <div className="mt-2">
                {!crOpen ? (
                  <Button variant="outline" size="sm" disabled={!ok} onClick={() => setCrOpen(true)}>{t('md.request.button')}</Button>
                ) : (
                  <div className="grid gap-3 rounded-md border p-3">
                    <p className="text-sm font-medium">{t('md.request.title')}</p>
                    <Input aria-label={t('md.banking.bankName')} value={cr.bankName} onChange={(e) => updateCr('bankName', e.target.value)} placeholder={t('md.banking.bankName')} />
                    <Input aria-label={t('md.banking.accountType')} value={cr.accountType} onChange={(e) => updateCr('accountType', e.target.value)} placeholder={t('md.banking.accountType')} />
                    <Input aria-label={t('md.banking.titularName')} value={cr.titularName} onChange={(e) => updateCr('titularName', e.target.value)} placeholder={t('md.banking.titularName')} />
                    <Input aria-label={t('md.banking.nitRut')} value={cr.nitRust} onChange={(e) => updateCr('nitRust', e.target.value)} placeholder={t('md.banking.nitRut')} />
                    <Input aria-label={t('md.banking.swiftCode')} value={cr.swiftCode} onChange={(e) => updateCr('swiftCode', e.target.value)} placeholder={t('md.banking.swiftCode')} />
                    <Input aria-label={t('md.banking.wompiPublicKey')} value={cr.wompiPublicKey} onChange={(e) => updateCr('wompiPublicKey', e.target.value)} placeholder={t('md.banking.wompiPublicKey')} />
                    <Input aria-label={t('md.banking.wompiPaymentLinkUrl')} value={cr.wompiPaymentLinkUrl} onChange={(e) => updateCr('wompiPaymentLinkUrl', e.target.value)} placeholder={t('md.banking.wompiPaymentLinkUrl')} />
                    <Input aria-label={`${t('md.banking.wompiPrivateKey')} (${t('md.request.optional')})`} type="password" value={cr.wompiPrivateKey} onChange={(e) => updateCr('wompiPrivateKey', e.target.value)} placeholder={t('md.banking.wompiPrivateKey')} />
                    <Textarea aria-label={t('md.request.reason')} value={cr.reason} onChange={(e) => updateCr('reason', e.target.value)} placeholder={t('md.request.reason')} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!ok || busy} onClick={requestChange}>{busy ? t('md.request.submitting') : t('md.request.submit')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setCrOpen(false)}>{t('md.request.cancel')}</Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AuthGate>
  )
}
