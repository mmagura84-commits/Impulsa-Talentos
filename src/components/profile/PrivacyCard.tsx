/**
 * Data & privacy (Ley 1581 de 2012 — habeas data):
 *  - explicit authorization to process personal data (required to use the platform)
 *  - optional marketing emails, separate from the authorization
 *  - download my data (export_my_data) and request deletion (request_account_deletion)
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Download, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import type { Profile } from '@/types'

export function PrivacyCard({
  profile,
  dataConsent,
  setDataConsent,
  marketingConsent,
  setMarketingConsent,
}: {
  profile: Profile | null
  dataConsent: boolean
  setDataConsent: (v: boolean) => void
  marketingConsent: boolean
  setMarketingConsent: (v: boolean) => void
}) {
  const { t, locale } = useI18n()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const acceptedAt = profile?.dataProcessingConsentAt
  const requestedAt = profile?.deletionRequestedAt

  const download = async () => {
    setBusy(true)
    const { data, error } = await supabase.rpc('export_my_data')
    setBusy(false)
    if (error) { toast.error(error.message); return }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `impulsa-talentos-my-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const requestDeletion = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('request_account_deletion')
    setBusy(false)
    setConfirmDelete(false)
    if (error) { toast.error(error.message); return }
    toast.success(t('privacy.deletionRequested'))
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', { dateStyle: 'medium' })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="size-4" />{t('privacy.cardTitle')}</CardTitle>
        <CardDescription>{t('privacy.cardDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {acceptedAt ? (
          <p className="text-sm text-muted-foreground">{t('privacy.acceptedOn', { date: fmt(acceptedAt) })} <Link to="/privacy" className="text-primary underline">{t('privacy.policyLink')}</Link></p>
        ) : (
          <div className="flex items-start gap-2 text-sm">
            <input id="data-consent" type="checkbox" checked={dataConsent} onChange={e => setDataConsent(e.target.checked)} className="mt-1" />
            <label htmlFor="data-consent" className="text-foreground">
              {t('privacy.authorization')} <Link to="/privacy" className="text-primary underline">{t('privacy.policyLink')}</Link>
            </label>
          </div>
        )}
        <div className="flex items-start gap-2 text-sm">
          <input id="consent" type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="mt-1" />
          <label htmlFor="consent" className="text-muted-foreground">{t('marketing.consent')} <span className="text-xs">({t('privacy.optional')})</span></label>
        </div>
        {profile && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => void download()}>
              <Download className="size-3.5" />{t('privacy.download')}
            </Button>
            {requestedAt ? (
              <span className="self-center text-xs text-amber-700">{t('privacy.deletionPending', { date: fmt(requestedAt) })}</span>
            ) : confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2 text-xs">
                {t('privacy.deleteConfirm')}
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => void requestDeletion()}>{t('privacy.deleteYes')}</Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
              </span>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-3.5" />{t('privacy.delete')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
