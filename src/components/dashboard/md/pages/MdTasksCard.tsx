import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { CheckCircle2, Circle, Megaphone, Landmark, MessageSquare, ArrowRight, Lock, Rocket, CreditCard } from 'lucide-react'

type Channel = { code: string; active: boolean }
type Cred = { channel_code: string; locked: boolean }
type BankRow = { id?: string }

/**
 * MD "Tasks" panel — surfaces the MD's responsibilities as a clear, checked-off
 * task list (no confusion about MD responsibility vs owner control).
 *
 * Status is driven by the underlying frozen-credit data via the existing SD
 * RPCs (list_my_credentials / list_my_banking) — this is a UI/representation
 * layer ONLY. It never adds a path for the MD to edit frozen fields; the
 * freeze-on-submit, owner-only-change governance stays enforced by RLS/SD
 * wrappers (migrations 032/033). Role-gated to MD by the surrounding MdLayout.
 */
export function MdTasksCard() {
  const { t } = useI18n()
  const [done, setDone] = useState({ marketing: false, banking: false })
  const [progress, setProgress] = useState({ submitted: 0, total: 0 })

  useEffect(() => {
    ;(async () => {
      const [{ data: catalog }, { data: creds }, { data: bank }] = await Promise.all([
        supabase.from('marketing_channels').select('code, active'),
        supabase.rpc('list_my_credentials'),
        supabase.rpc('list_my_banking'),
      ])
      const activeChannels = ((catalog as Channel[] | null) ?? []).filter((c) => c.active).length
      const locked = ((creds as Cred[] | null) ?? []).filter((c) => c.locked).length
      const bankArr = (bank as BankRow[] | null) ?? []
      setProgress({ submitted: locked, total: activeChannels })
      setDone({ marketing: locked > 0, banking: bankArr.length > 0 })
    })().catch(() => {})
  }, [])

  const task = (
    doneFlag: boolean,
    icon: React.ReactNode,
    title: string,
    subtitle: string,
    href: string,
    statusKey?: string,
  ) => (
    <li className="flex items-start gap-3 rounded-xl border p-4">
      {doneFlag ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <p className="font-medium">{title}</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={doneFlag ? 'default' : 'secondary'}>
          {statusKey ? t(statusKey) : doneFlag ? t('md.tasks.done') : t('md.tasks.pending')}
        </Badge>
        <Link to={href as any} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {t('md.tasks.open')} <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {doneFlag && <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </li>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('md.tasks.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('md.tasks.subtitle')}</p>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 lg:grid-cols-3">
          {task(
            done.marketing,
            <Megaphone className="size-4 text-primary" />,
            t('md.tasks.marketing'),
            t('md.tasks.marketingProgress', { n: progress.submitted, m: progress.total }),
            '/md/marketing',
          )}
          {task(
            done.banking,
            <Landmark className="size-4 text-primary" />,
            t('md.tasks.banking'),
            t('md.tasks.bankingWompiHint'),
            '/md/banking',
          )}
          {task(
            false,
            <MessageSquare className="size-4 text-primary" />,
            t('md.tasks.messages'),
            t('md.tasks.messagesInfo'),
            '/md/messages',
            'md.tasks.informational',
          )}
          {task(
            false,
            <Rocket className="size-4 text-primary" />,
            t('md.tasks.goLive'),
            t('md.tasks.goLiveInfo'),
            '/md',
            'md.tasks.informational',
          )}
          {task(
            false,
            <CreditCard className="size-4 text-primary" />,
            t('md.tasks.payments'),
            t('md.tasks.paymentsInfo'),
            '/md/banking',
            'md.tasks.informational',
          )}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{t('md.tasks.lockedNote')}</p>
      </CardContent>
    </Card>
  )
}
