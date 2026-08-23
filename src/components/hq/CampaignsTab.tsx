import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { Megaphone, CheckCircle2, Rocket, Loader2 } from 'lucide-react'

type Channel = {
  code: string
  name_en: string
  name_es: string
  active: boolean
}

type Campaign = {
  id: string
  name: string
  objective: string
  target_audience: string
  channels: string[]
  message_copy: string
  launch_date: string | null
  status: 'draft' | 'launched' | 'cancelled'
  launched_by: string | null
  launched_at: string | null
  created_at: string
}

/**
 * HQ OWNER/ADMIN lane — Campaign launch panel (PART B).
 * Only the owner/admin (role 'admin') can compose and launch a campaign.
 * Launching RECORDS the campaign in the platform via the SD RPC
 * launch_campaign (owner-gated in RLS + role check) — it does NOT auto-publish
 * to external social networks (that requires each platform's API/ads
 * credentials, which are owner-owned). The honest boundary is stated in UI.
 * The MD (role 'md') has NO access to this surface.
 */
export function CampaignsTab() {
  const { t, locale } = useI18n()
  const [channels, setChannels] = useState<Channel[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [form, setForm] = useState({ name: '', objective: '', audience: '', message: '', date: '' })
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setLoading(true)
    const catRes = await supabase.from('marketing_channels').select('*').order('sort')
    setChannels(((catRes.data as Channel[] | null) ?? []).filter((c) => c.active))
    // campaigns RLS is owner-only; a non-admin simply gets an empty array.
    const cRes = await supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    setCampaigns(((cRes.data as Campaign[] | null) ?? []))
    setLoading(false)
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const channelName = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of channels) map[c.code] = locale === 'es' && c.name_es ? c.name_es : c.name_en
    return map
  }, [channels, locale])

  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]))

  const launch = async () => {
    if (!form.name.trim()) {
      setError(t('hq.campaign.needName'))
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    const { error: rpcErr } = await supabase.rpc('launch_campaign', {
      p_name: form.name,
      p_objective: form.objective,
      p_target_audience: form.audience,
      p_channels: selected,
      p_message_copy: form.message,
      p_launch_date: form.date || null,
    })
    if (rpcErr) {
      setError(t('hq.campaign.error') + ' ' + rpcErr.message)
    } else {
      setNotice(t('hq.campaign.launched'))
      setForm({ name: '', objective: '', audience: '', message: '', date: '' })
      setSelected([])
      await load()
    }
    setBusy(false)
  }

  const statusLabel = (s: Campaign['status']) =>
    s === 'launched' ? t('hq.campaign.status.launched')
      : s === 'cancelled' ? t('hq.campaign.status.cancelled')
        : t('hq.campaign.status.draft')

  return (
    <div className="space-y-6">
      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-primary" /> {t('hq.campaign.title')}
            </CardTitle>
            <CardDescription>{t('hq.campaign.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              {t('hq.campaign.honestNote')}
            </p>
            {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600">{notice}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cam-name">{t('hq.campaign.name')}</Label>
                <Input id="cam-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cam-date">{t('hq.campaign.launchDate')}</Label>
                <Input id="cam-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cam-obj">{t('hq.campaign.objective')}</Label>
              <Input id="cam-obj" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cam-aud">{t('hq.campaign.targetAudience')}</Label>
              <Input id="cam-aud" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('hq.campaign.channels')}</Label>
              <div className="flex flex-wrap gap-2">
                {channels.map((c) => {
                  const on = selected.includes(c.code)
                  return (
                    <button
                      key={c.code}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(c.code)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                        on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {on && <CheckCircle2 className="size-3.5" />}
                      {channelName[c.code] || c.code}
                    </button>
                  )
                })}
                {!channels.length && <p className="text-sm text-muted-foreground">{t('hq.campaign.channelsNone')}</p>}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cam-msg">{t('hq.campaign.message')}</Label>
              <Textarea id="cam-msg" rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>
            <div>
              <Button disabled={busy} onClick={launch} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {busy ? t('hq.campaign.launching') : t('hq.campaign.launch')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn>
        <Card>
          <CardHeader>
            <CardTitle>{t('hq.campaign.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('hq.campaign.loading')}</p>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('hq.campaign.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {campaigns.map((c) => (
                  <li key={c.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{c.name || '(untitled)'}</p>
                      <Badge variant={c.status === 'launched' ? 'default' : 'secondary'}>{statusLabel(c.status)}</Badge>
                    </div>
                    {c.objective && <p className="mt-1 text-sm text-muted-foreground">{c.objective}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('hq.campaign.channels')}:{' '}
                      {c.channels.length ? c.channels.map((code) => channelName[code] || code).join(' · ') : t('hq.campaign.channelsNone')}
                    </p>
                    {c.launched_at && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('hq.campaign.launchedAt')}: {new Date(c.launched_at).toLocaleString()}
                      </p>
                    )}
                    {c.message_copy && <p className="mt-2 text-sm">{c.message_copy}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  )
}

/* A tiny local FadeIn (mirrors the pattern used in hq.tsx) so this component is
 * self-contained and doesn't depend on route-file internals. */
function FadeIn({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
