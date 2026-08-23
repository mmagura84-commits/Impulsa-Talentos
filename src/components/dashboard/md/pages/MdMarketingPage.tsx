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
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'

type Catalog = {
  id: string
  code: string
  audience: 'candidate' | 'employer'
  name_en: string
  name_es: string
  active: boolean
  sort: number
}

type Cred = {
  channel_code: string
  business_name: string
  account_handle: string
  profile_url: string
  secret_last4: string
  status: string
  locked: boolean
}

type CredRow = { id: string; channel_code: string }

type FieldState = { businessName: string; accountHandle: string; profileUrl: string; secret: string; secretLast4: string }

const emptyField: FieldState = { businessName: '', accountHandle: '', profileUrl: '', secret: '', secretLast4: '' }

export function Marketing() {
  const { t, locale } = useI18n()
  const { user } = useAuth()
  const ok = useIsMd()
  const nav = useNavigate()
  const [catalog, setCatalog] = useState<Catalog[]>([])
  const [creds, setCreds] = useState<Record<string, Cred>>({})
  const [credId, setCredId] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<Record<string, FieldState>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // change-request (frozen live stays locked until owner/admin approves)
  const [crOpen, setCrOpen] = useState<Record<string, boolean>>({})
  const [crForm, setCrForm] = useState<Record<string, FieldState & { reason: string }>>({})

  useEffect(() => {
    if (!ok) nav({ to: '/dashboard', replace: true })
  }, [ok, nav])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: cat } = await supabase
        .from('marketing_channels')
        .select('*')
        .order('sort')
      setCatalog((cat ?? []).filter((c: Catalog) => c.active))
      const { data: myCreds } = await supabase.rpc('list_my_credentials')
      const map: Record<string, Cred> = {}
      ;((myCreds as Cred[]) ?? []).forEach((c) => { map[c.channel_code] = c })
      setCreds(map)
      // MD may only see their own rows via RLS — fetch the id for change-request targeting.
      const { data: ids } = await supabase
        .from('marketing_credentials')
        .select('id, channel_code')
      const idMap: Record<string, string> = {}
      ;((ids as CredRow[]) ?? []).forEach((r) => { idMap[r.channel_code] = r.id })
      setCredId(idMap)
    })().catch(() => setError(t('md.marketing.loadError')))
  }, [user?.id, t])

  const setField = (code: string, key: keyof FieldState, value: string) => {
    setFields((f) => {
      const cur = f[code] ?? { ...emptyField }
      const next = { ...cur, [key]: value }
      if (key === 'secret') next.secretLast4 = value ? value.slice(-4) : ''
      return { ...f, [code]: next }
    })
  }

  const save = async (code: string) => {
    setBusy(code)
    setError('')
    const f = fields[code] ?? { ...emptyField }
    const { error } = await supabase.rpc('submit_marketing_credential', {
      p_channel_code: code,
      p_business_name: f.businessName,
      p_account_handle: f.accountHandle,
      p_profile_url: f.profileUrl,
      p_secret: f.secret || null,
      p_secret_last4: f.secretLast4,
    })
    if (error) {
      setError(t('md.marketing.saveError') + ' ' + error.message)
    } else {
      setNotice(t('md.marketing.saved'))
      setFields((x) => ({ ...x, [code]: { ...emptyField } }))
      await reload()
    }
    setBusy('')
  }

  const reload = async () => {
    const { data: myCreds } = await supabase.rpc('list_my_credentials')
    const map: Record<string, Cred> = {}
    ;((myCreds as Cred[]) ?? []).forEach((c) => { map[c.channel_code] = c })
    setCreds(map)
    const { data: ids } = await supabase
      .from('marketing_credentials')
      .select('id, channel_code')
    const idMap: Record<string, string> = {}
    ;((ids as CredRow[]) ?? []).forEach((r) => { idMap[r.channel_code] = r.id })
    setCredId(idMap)
  }

  const setC = (code: string, key: keyof (FieldState & { reason: string }), value: string) => {
    setCrForm((f) => {
      const cur = f[code] ?? { ...emptyField, reason: '' }
      const next = { ...cur, [key]: value }
      if (key === 'secret') next.secretLast4 = value ? value.slice(-4) : ''
      return { ...f, [code]: next }
    })
  }

  const requestChange = async (code: string) => {
    const id = credId[code]
    if (!id) return
    setBusy(code + ':cr')
    setError('')
    const f = crForm[code] ?? { ...emptyField, reason: '' }
    const targetId = id // uuid string
    const { error } = await supabase.rpc('request_credential_change', {
      p_target_type: 'marketing',
      p_target_id: targetId,
      p_requested_fields: { business_name: f.businessName, account_handle: f.accountHandle, profile_url: f.profileUrl },
      p_new_secret: f.secret || null,
      p_new_secret_last4: f.secretLast4,
      p_reason: f.reason,
    })
    if (error) {
      setError(t('md.request.error') + ' ' + error.message)
    } else {
      setNotice(t('md.request.submitted'))
      setCrForm((x) => ({ ...x, [code]: { ...emptyField, reason: '' } }))
      setCrOpen((x) => ({ ...x, [code]: false }))
      await reload()
    }
    setBusy('')
  }

  const name = (c: Catalog) => (locale === 'es' && c.name_es ? c.name_es : c.name_en)

  const renderCard = (c: Catalog) => {
    const row = creds[c.code]
    const locked = !!row?.locked
    const f = fields[c.code] ?? { ...emptyField }
    const open = crOpen[c.code]
    const cf = crForm[c.code] ?? { ...emptyField, reason: '' }

    return (
      <Card key={c.code}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>{name(c)}</span>
            {locked && (
              <span className="flex items-center gap-2">
                <Badge variant={row?.status === 'change_requested' ? 'secondary' : 'default'}>
                  {row?.status === 'change_requested' ? t('md.marketing.changeRequested') : t('md.marketing.locked')}
                </Badge>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        {!locked ? (
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`bn-${c.code}`}>{t('md.marketing.businessName')}</Label>
              <Input id={`bn-${c.code}`} value={f.businessName}
                onChange={(e) => setField(c.code, 'businessName', e.target.value)} placeholder={t('md.marketing.businessName')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`ah-${c.code}`}>{t('md.marketing.accountHandle')}</Label>
              <Input id={`ah-${c.code}`} value={f.accountHandle}
                onChange={(e) => setField(c.code, 'accountHandle', e.target.value)} placeholder={t('md.marketing.accountHandle')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`pu-${c.code}`}>{t('md.marketing.profileUrl')}</Label>
              <Input id={`pu-${c.code}`} value={f.profileUrl}
                onChange={(e) => setField(c.code, 'profileUrl', e.target.value)} placeholder={t('md.marketing.url')} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`sc-${c.code}`}>{t('md.marketing.secret')}</Label>
              <Input id={`sc-${c.code}`} type="password" value={f.secret}
                onChange={(e) => setField(c.code, 'secret', e.target.value)} placeholder={t('md.marketing.secretPlaceholder')} />
            </div>
            <Button disabled={!ok || busy === c.code} onClick={() => save(c.code)}>
              {busy === c.code ? t('md.marketing.saving') : t('md.marketing.submit')}
            </Button>
          </CardContent>
        ) : (
          <CardContent className="grid gap-2 text-sm">
            <p className="text-muted-foreground">{t('md.marketing.businessName')}: <span className="text-foreground">{row?.business_name || '—'}</span></p>
            <p className="text-muted-foreground">{t('md.marketing.accountHandle')}: <span className="text-foreground">{row?.account_handle || '—'}</span></p>
            <p className="text-muted-foreground">{t('md.marketing.profileUrl')}: <span className="break-all text-foreground">{row?.profile_url || '—'}</span></p>
            {row?.secret_last4 && (
              <p className="text-muted-foreground">{t('md.marketing.secret')}: <span className="text-foreground">{t('md.marketing.maskedPrefix')}{row.secret_last4}</span></p>
            )}
            <div className="mt-2">
              {!open ? (
                <Button variant="outline" size="sm" disabled={!ok} onClick={() => setCrOpen((x) => ({ ...x, [c.code]: true }))}>
                  {t('md.request.button')}
                </Button>
              ) : (
                <div className="grid gap-3 rounded-md border p-3">
                  <p className="text-sm font-medium">{t('md.request.title')}</p>
                  <Input aria-label={t('md.marketing.businessName')} value={cf.businessName}
                    onChange={(e) => setC(c.code, 'businessName', e.target.value)} placeholder={t('md.marketing.businessName')} />
                  <Input aria-label={t('md.marketing.accountHandle')} value={cf.accountHandle}
                    onChange={(e) => setC(c.code, 'accountHandle', e.target.value)} placeholder={t('md.marketing.accountHandle')} />
                  <Input aria-label={t('md.marketing.profileUrl')} value={cf.profileUrl}
                    onChange={(e) => setC(c.code, 'profileUrl', e.target.value)} placeholder={t('md.marketing.url')} />
                  <Input aria-label={`${t('md.marketing.secret')} (${t('md.request.optional')})`} type="password" value={cf.secret}
                    onChange={(e) => setC(c.code, 'secret', e.target.value)} placeholder={t('md.marketing.secretPlaceholder')} />
                  <Textarea aria-label={t('md.request.reason')} value={cf.reason}
                    onChange={(e) => setC(c.code, 'reason', e.target.value)} placeholder={t('md.request.reason')} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!ok || busy === c.code + ':cr'} onClick={() => requestChange(c.code)}>
                      {busy === c.code + ':cr' ? t('md.request.submitting') : t('md.request.submit')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCrOpen((x) => ({ ...x, [c.code]: false }))}>
                      {t('md.request.cancel')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  }

  const candidate = catalog.filter((c) => c.audience === 'candidate')
  const employer = catalog.filter((c) => c.audience === 'employer')

  const group = (titleKey: string, items: Catalog[]) => (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{t(titleKey)}</h2>
      <div className="grid gap-3 md:grid-cols-2">{items.map(renderCard)}</div>
    </section>
  )

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <div className="mx-auto max-w-5xl p-6">
        <MdNav />
        <h1 className="text-3xl font-bold">{t('md.marketing.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('md.marketing.description')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('md.freezeHint')}</p>
        {error && <p role="alert" className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mt-3 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">{notice}</p>}
        <div className="mt-6 space-y-8">
          {group('md.marketing.candidateGroup', candidate)}
          {group('md.marketing.employerGroup', employer)}
        </div>
      </div>
    </AuthGate>
  )
}
