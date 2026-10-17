import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { CheckCircle2, Circle, Megaphone, Landmark, MessageSquare, ArrowRight, Lock, Rocket, CreditCard, ShieldCheck, Timer } from 'lucide-react'

type Channel = { code: string; active: boolean }
type Cred = { channel_code: string; locked: boolean }
type BankRow = { id?: string }

/** The MD has 2 days from the request (Sat 17 Oct 2026, 2:15 pm Pacific) to finish the required tasks. */
export const MD_TASKS_DUE_AT = Date.parse('2026-10-19T21:15:00Z')

const STEP_COUNTS = { marketing: 5, banking: 5, messages: 4, goLive: 4, payments: 3, wompiProd: 3 } as const
type StepKey = keyof typeof STEP_COUNTS

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

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
  const now = useNow()
  const { locale } = useI18n()
  const remaining = Math.max(0, MD_TASKS_DUE_AT - now)
  const requiredDone = (done.marketing ? 1 : 0) + (done.banking ? 1 : 0)
  const allDone = requiredDone === 2
  const overdue = !allDone && now >= MD_TASKS_DUE_AT
  const dueText = new Date(MD_TASKS_DUE_AT).toLocaleString(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const left = { d: Math.floor(remaining / 86_400_000), h: Math.floor((remaining % 86_400_000) / 3_600_000), m: Math.floor((remaining % 3_600_000) / 60_000) }

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
    stepKey?: StepKey,
    required?: boolean,
  ) => (
    <li className="flex flex-wrap items-start gap-3 rounded-xl border p-4 sm:flex-nowrap">
      {doneFlag ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-hidden />
      ) : (
        <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <p className="font-medium">{title}</p>
          {required && <Badge variant="outline" className="text-xs">{t('md.tasks.required')}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {stepKey && (
          <details className="group mt-2">
            <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">{t('md.tasks.howTo')}</summary>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              {Array.from({ length: STEP_COUNTS[stepKey] }, (_, i) => <li key={i}>{t(`md.tasks.steps.${stepKey}.${i + 1}`)}</li>)}
            </ol>
          </details>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge variant={doneFlag ? 'default' : 'secondary'}>
          {statusKey ? t(statusKey) : doneFlag ? t('md.tasks.done') : t('md.tasks.pending')}
        </Badge>
        <Link to={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
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
        <div
          className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border p-4 ${allDone ? 'border-emerald-500/40 bg-emerald-500/5' : overdue ? 'border-destructive/40 bg-destructive/5' : 'border-amber-500/40 bg-amber-500/5'}`}
        >
          {allDone ? <CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> : <Timer className={`size-5 ${overdue ? 'text-destructive' : 'text-amber-600'}`} aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-medium">{allDone ? t('md.tasks.allDone') : overdue ? t('md.tasks.overdue') : t('md.tasks.dueTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('md.tasks.requiredProgress', { n: requiredDone })} {!allDone && t('md.tasks.dueBy', { date: dueText })}</p>
          </div>
          {!allDone && !overdue && (
            <p className="text-lg font-semibold tabular-nums" aria-label={t('md.tasks.dueLeft', left)}>{t('md.tasks.dueLeft', left)}</p>
          )}
        </div>
        <ul className="grid gap-3 lg:grid-cols-2">
          {task(
            done.marketing,
            <Megaphone className="size-4 text-primary" />,
            t('md.tasks.marketing'),
            t('md.tasks.marketingProgress', { n: progress.submitted, m: progress.total }),
            '/md/marketing',
            undefined,
            'marketing',
            true,
          )}
          {task(
            done.banking,
            <Landmark className="size-4 text-primary" />,
            t('md.tasks.banking'),
            t('md.tasks.bankingHint'),
            '/md/banking',
            undefined,
            'banking',
            true,
          )}
          {task(
            false,
            <MessageSquare className="size-4 text-primary" />,
            t('md.tasks.messages'),
            t('md.tasks.messagesInfo'),
            '/md/messages',
            'md.tasks.informational',
            'messages',
          )}
          {task(
            false,
            <Rocket className="size-4 text-primary" />,
            t('md.tasks.goLive'),
            t('md.tasks.goLiveInfo'),
            '/md',
            'md.tasks.informational',
            'goLive',
          )}
          {task(
            false,
            <CreditCard className="size-4 text-primary" />,
            t('md.tasks.payments'),
            t('md.tasks.paymentsInfo'),
            '/md/banking',
            'md.tasks.informational',
            'payments',
          )}
          {task(
            done.banking,
            <ShieldCheck className="size-4 text-primary" />,
            t('md.tasks.wompiProd'),
            t('md.tasks.wompiProdInfo'),
            '/md/banking',
            undefined,
            'wompiProd',
          )}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{t('md.tasks.lockedNote')}</p>
      </CardContent>
    </Card>
  )
}
