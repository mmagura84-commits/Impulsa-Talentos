import { createFileRoute, Link } from '@tanstack/react-router'
import { FormEvent, useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PublicHeader } from '@/components/PublicHeader'
import { useI18n } from '@/i18n/I18nProvider'
import { sendEmail } from '@/lib/emailSender'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
  head: () => ({ meta: [{ title: 'Contact — Impulsa Talentos' }, { name: 'description', content: 'Get in touch with the Impulsa Talentos team.' }] }),
})

export default function ContactPage() {
  const { t } = useI18n()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSending(true); setError(false)
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    const subject = String(form.get('subject') ?? '').trim()
    const message = String(form.get('message') ?? '').trim()
    if (!name || !email || !subject || !message) { setSending(false); setError(true); return }
    try {
      await sendEmail({
        to: 'info@impulsatalentos.expert',
        subject: `[Website contact] ${subject}`,
        text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        html: `<h2>Website contact</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      })
      setSent(true); event.currentTarget.reset(); toast.success(t('contact.success'))
    } catch { setError(true); toast.error(t('contact.error')) }
    finally { setSending(false) }
  }
  return <div className="min-h-screen bg-background text-foreground"><PublicHeader transparentOnTop={false} /><main id="main" className="mx-auto max-w-3xl px-5 py-12 sm:py-16"><div className="mb-8 text-center"><p className="text-sm font-semibold uppercase tracking-wider text-primary">{t('contact.kicker')}</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{t('contact.title')}</h1><p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t('contact.subtitle')}</p></div><Card><CardHeader><CardTitle>{t('contact.formTitle')}</CardTitle></CardHeader><CardContent>{sent ? <div className="flex flex-col items-center gap-4 py-10 text-center"><CheckCircle2 className="size-12 text-emerald-500" /><h2 className="text-xl font-semibold">{t('contact.success')}</h2><p className="text-muted-foreground">{t('contact.successDetail')}</p><Button variant="outline" onClick={() => { setSent(false); setError(false) }}>{t('contact.sendAnother')}</Button></div> : <form onSubmit={submit} className="space-y-5"><div className="grid gap-5 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium"><span>{t('contact.name')}</span><Input name="name" required autoComplete="name" /></label><label className="space-y-2 text-sm font-medium"><span>{t('contact.email')}</span><Input name="email" type="email" required autoComplete="email" /></label></div><label className="block space-y-2 text-sm font-medium"><span>{t('contact.subject')}</span><Input name="subject" required /></label><label className="block space-y-2 text-sm font-medium"><span>{t('contact.message')}</span><Textarea name="message" required rows={6} /></label>{error && <p role="alert" className="text-sm text-destructive">{t('contact.error')}</p>}<Button type="submit" disabled={sending} className="w-full sm:w-auto"><Send className="mr-2 size-4" />{sending ? t('contact.sending') : t('contact.submit')}</Button></form>}</CardContent></Card></main></div>
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)) }
