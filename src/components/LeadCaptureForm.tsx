import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
import { supabase } from '@/lib/supabase'
import { sendEmail } from '@/lib/emailSender'

const NOTIFY_EMAIL = 'info@impulsatalentos.expert'

function buildLeadEmail(form: { email: string; phone: string; name: string; company: string }) {
  const name = form.name || '(not provided)'
  const company = form.company || '(not provided)'
  const phone = form.phone || '(not provided)'
  return {
    to: NOTIFY_EMAIL,
    subject: `[New Lead] ${name} from ${company} requested pricing`,
    text: [
      `New employer lead from the pricing page:`,
      `Name:    ${name}`,
      `Email:   ${form.email}`,
      `Company: ${company}`,
      `Phone:   ${phone}`,
      ``,
      `View all leads: https://impulsatalentos.expert/hq/leads`,
    ].join('\n'),
    html: [
      `<h2>New employer lead</h2>`,
      `<table cellpadding="4" style="border-collapse:collapse">`,
      `<tr><td><strong>Name:</strong></td><td>${escapeHtml(name)}</td></tr>`,
      `<tr><td><strong>Email:</strong></td><td>${escapeHtml(form.email)}</td></tr>`,
      `<tr><td><strong>Company:</strong></td><td>${escapeHtml(company)}</td></tr>`,
      `<tr><td><strong>Phone:</strong></td><td>${escapeHtml(phone)}</td></tr>`,
      `</table>`,
      `<br><p><a href="https://impulsatalentos.expert/hq/leads">View all leads →</a></p>`,
    ].join('\n'),
  }
}

export function LeadCaptureForm({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ email: '', phone: '', name: '', company: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email.trim()) return
    setBusy(true)
    setError('')

    try {
      // 1. Save to Supabase leads table
      const { error: err } = await supabase.from('leads').insert({
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        name: form.name.trim() || null,
        company: form.company.trim() || null,
        source: 'pricing',
        status: 'new',
      })
      if (err) throw err

      // 2. Fire notification email (fire-and-forget — don't block the user)
      sendEmail(buildLeadEmail(form)).catch(e =>
        console.warn('[LeadCapture] notification email failed:', e)
      )

      // 3. Unlock pricing for this browser
      sessionStorage.setItem('impulsa_pricing_lead', '1')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pricing.leadError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-2xl">{t('pricing.leadTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-email">{t('pricing.leadEmail')} *</Label>
            <Input id="lead-email" required type="email" value={form.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-name">{t('pricing.leadName')}</Label>
              <Input id="lead-name" value={form.name} onChange={e => update('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-company">{t('pricing.leadCompany')}</Label>
              <Input id="lead-company" value={form.company} onChange={e => update('company', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-phone">{t('pricing.leadPhone')}</Label>
            <Input id="lead-phone" type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? t('pricing.leadSubmitting') : t('pricing.leadSubmit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
  )
}
