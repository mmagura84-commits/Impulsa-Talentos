/**
 * HQ › Campaigns › Social accounts: the accounts to create (src/lib/socialAccounts.ts)
 * and a form per account that saves it via hq_save_social_account (migration 049).
 * Passwords are optional and stored only encrypted (Vault); they are never read back.
 */
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Share2, Copy, ExternalLink, CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { SOCIAL_ACCOUNTS, type SocialAccount } from '@/lib/socialAccounts'

type Saved = { channel_code: string; business_name: string; account_handle: string; profile_url: string; login_email: string; secret_id: string | null }
type Form = { name: string; handle: string; url: string; email: string; password: string }

function CopyButton({ text }: { text: string }) {
  const { t } = useI18n()
  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"
      onClick={() => { void navigator.clipboard?.writeText(text).then(() => toast.success(t('hq.social.copied'), { duration: 1200 })) }}>
      <Copy className="size-3" />{t('hq.social.copy')}
    </Button>
  )
}

function AccountRow({ a, saved, onSaved }: { a: SocialAccount; saved?: Saved; onSaved: () => void }) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<Form>({
    name: saved?.business_name || a.name, handle: saved?.account_handle || '', url: saved?.profile_url || '',
    email: saved?.login_email || '', password: '',
  })
  useEffect(() => {
    if (saved) setForm(f => ({ ...f, name: saved.business_name || a.name, handle: saved.account_handle, url: saved.profile_url, email: saved.login_email }))
  }, [saved, a.name])
  const es = locale === 'es'
  const id = (k: string) => `soc-${a.code}-${k}`

  const save = async () => {
    if (form.url && !/^https:\/\//i.test(form.url.trim())) { toast.error(t('hq.social.f.url')); return }
    setBusy(true)
    const { error } = await supabase.rpc('hq_save_social_account', {
      p_channel_code: a.code, p_display_name: form.name.trim(), p_handle: form.handle.trim(),
      p_profile_url: form.url.trim(), p_login_email: form.email.trim(), p_secret: form.password || null,
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setForm(f => ({ ...f, password: '' }))
    toast.success(t('hq.social.savedToast'), { duration: 1800 })
    onSaved()
  }

  return (
    <div className="rounded-lg border border-border">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-accent/30">
        {saved ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{a.platform}</p>
          <p className="truncate text-xs text-muted-foreground">{saved?.account_handle || saved?.profile_url || (es ? a.kind.es : a.kind.en)}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">{t(`hq.social.priority.${a.priority}`)}</Badge>
        {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
      </button>
      {open && (
        <div className="grid gap-4 border-t border-border p-3 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{es ? a.kind.es : a.kind.en}</p>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={a.createUrl} target="_blank" rel="noopener noreferrer">{t('hq.social.create')} <ExternalLink className="size-3.5" /></a>
            </Button>
            {a.handles.length > 0 && (
              <p><span className="text-xs text-muted-foreground">{t('hq.social.suggestedHandle')}:</span>{' '}
                <code className="rounded bg-muted px-1">@{a.handles[0]}</code>
                {a.handles.length > 1 && <span className="text-xs text-muted-foreground"> · {t('hq.social.orIfTaken')} {a.handles.slice(1).map(h => `@${h}`).join(', ')}</span>}
              </p>
            )}
            {a.bio && (
              <div>
                <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t('hq.social.bio')} · {t('hq.social.chars', { n: [...a.bio].length, max: a.bioLimit })}</span><CopyButton text={a.bio} /></div>
                <p className="rounded-md bg-muted/50 p-2 text-xs">{a.bio}</p>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t('hq.social.link')}</span><CopyButton text={a.link} /></div>
              <p className="break-all rounded-md bg-muted/50 p-2 font-mono text-[11px]">{a.link}</p>
            </div>
            <p className="text-xs"><span className="text-muted-foreground">{t('hq.social.needs')}:</span> {es ? a.needs.es : a.needs.en}</p>
          </div>
          <form className="grid content-start gap-2.5" onSubmit={e => { e.preventDefault(); void save() }}>
            <div className="grid gap-1"><Label htmlFor={id('name')} className="text-xs">{t('hq.social.f.name')}</Label>
              <Input id={id('name')} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid gap-1"><Label htmlFor={id('handle')} className="text-xs">{t('hq.social.f.handle')}</Label>
              <Input id={id('handle')} value={form.handle} placeholder={a.handles[0] ? `@${a.handles[0]}` : ''} onChange={e => setForm({ ...form, handle: e.target.value })} /></div>
            <div className="grid gap-1"><Label htmlFor={id('url')} className="text-xs">{t('hq.social.f.url')}</Label>
              <Input id={id('url')} type="url" inputMode="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} /></div>
            <div className="grid gap-1"><Label htmlFor={id('email')} className="text-xs">{t('hq.social.f.email')}</Label>
              <Input id={id('email')} type="email" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid gap-1"><Label htmlFor={id('pw')} className="text-xs">{t('hq.social.f.password')}</Label>
              <Input id={id('pw')} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">{saved?.secret_id ? `${t('hq.social.passwordSaved')}. ` : ''}{t('hq.social.f.passwordHint')}</p></div>
            <Button type="submit" size="sm" disabled={busy} className="justify-self-start gap-1.5">
              {busy && <Loader2 className="size-3.5 animate-spin" />}{t('hq.social.save')}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}

export function SocialAccountsCard() {
  const { t } = useI18n()
  const [saved, setSaved] = useState<Record<string, Saved>>({})
  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_credentials')
      .select('channel_code, business_name, account_handle, profile_url, login_email, secret_id')
    setSaved(Object.fromEntries(((data ?? []) as Saved[]).map(r => [r.channel_code, r])))
  }, [])
  useEffect(() => { void load() }, [load])
  const done = SOCIAL_ACCOUNTS.filter(a => saved[a.code]).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Share2 className="size-4 text-primary" /> {t('hq.social.title')}</CardTitle>
        <CardDescription>{t('hq.social.desc')}</CardDescription>
        <p className="text-xs font-medium">{t('hq.social.progress', { n: done, total: SOCIAL_ACCOUNTS.length })}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">{t('hq.social.tip')}</p>
        {SOCIAL_ACCOUNTS.map(a => <AccountRow key={a.code} a={a} saved={saved[a.code]} onSaved={load} />)}
      </CardContent>
    </Card>
  )
}
