import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useI18n } from '@/i18n/I18nProvider'
import { useUpcomingInterviews } from '@/hooks/useInterviews'
import { useAllProfiles } from '@/hooks/useProfile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarClock, ArrowRight } from 'lucide-react'

/** Compact "Upcoming interviews" list for the employer dashboard home. */
export function UpcomingInterviewsWidget({ companyId }: { companyId: string | undefined }) {
  const { t } = useI18n()
  const { data: interviews, isLoading } = useUpcomingInterviews(companyId)
  const { data: allProfiles = [] } = useAllProfiles()

  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of allProfiles) if (p.id) m[p.id] = p.fullName || p.email || p.id.slice(0, 8)
    return m
  }, [allProfiles])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            {t('interviews.upcoming.title')}
          </CardTitle>
          <CardDescription>{t('interviews.upcoming.desc')}</CardDescription>
        </div>
        <Button size="sm" variant="outline" className="gap-1" asChild>
          <Link to="/employer/jobs">
            {t('interviews.upcoming.viewAll')}
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : !interviews || interviews.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('interviews.upcoming.empty')}</p>
        ) : (
          <div className="space-y-2">
            {interviews.slice(0, 5).map((iv) => (
              <div
                key={iv.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {nameById[iv.candidateId] ?? t('interviews.upcoming.candidate')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`interviews.type.${iv.type}`)} · {t('interviews.duration', { minutes: iv.durationMinutes })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-foreground">
                    {new Date(iv.scheduledAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(iv.scheduledAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
