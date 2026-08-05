import { useRef, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { Job, Application } from '@/types'

/* ── Shared animation wrapper ──────────────────────────── */
export function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Shared stat card ──────────────────────────────────── */
export function StatCard({ icon: Icon, label, value, trend, delay }: {
  icon: React.ElementType
  label: string
  value: string
  trend?: string
  delay?: number
  accent?: 'gold' | 'navy' | 'ink'
}) {
  return (
    <FadeIn delay={delay}>
      <Card className={`hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${accent === 'gold' ? 'border-t-2 border-amber-500/50' : accent === 'navy' ? 'border-t-2 border-primary/40' : accent === 'ink' ? 'bg-slate-950 text-white border-t-2 border-amber-400/60' : ''}`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className={`text-xs font-medium uppercase tracking-wider ${accent === 'ink' ? 'text-white/70' : 'text-muted-foreground'}`}>{label}</p>
              <p className={`text-2xl font-bold font-serif ${accent === 'ink' ? 'text-white' : 'text-foreground'}`}>{value}</p>
            </div>
            <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${accent === 'gold' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'}`}>
              <Icon className="size-5" />
            </div>
          </div>
          {trend && (
            <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="size-3 text-primary" /> {trend}
            </p>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

/* ── Shared formatters ─────────────────────────────────── */
export function formatSalary(job: Job, locale: 'en' | 'es'): string {
  if (!job.salaryMin && !job.salaryMax) return '—'
  const min = job.salaryMin ? job.salaryMin.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const max = job.salaryMax ? job.salaryMax.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US') : '?'
  const ccy = job.currency || 'COP'
  return `${ccy} ${min} - ${max}`
}

export function formatPosted(iso: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (!iso) return t('time.recent')
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return t('time.today')
  if (days === 1) return t('time.yesterday')
  if (days < 7) return t('time.daysAgo', { n: days })
  if (days < 30) return t('time.weeksAgo', { n: Math.floor(days / 7) })
  return t('time.monthsAgo', { n: Math.floor(days / 30) })
}

export function statusLabel(s: Application['status'], t: (k: string) => string): string {
  const map: Record<Application['status'], string> = {
    pending: t('dashboard.status.pending'),
    reviewed: t('dashboard.status.reviewed'),
    interview: t('dashboard.status.interview'),
    offered: t('dashboard.status.offered'),
    hired: t('dashboard.status.hired'),
    rejected: t('dashboard.status.rejected'),
  }
  return map[s] ?? s
}
