import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Inbox,
  CalendarClock,
  ShieldAlert,
  FileEdit,
  Users,
  CheckCircle2,
  ArrowRight,
  Building2,
} from 'lucide-react'
import type { Application, Interview, Job } from '@/types'

/** Statuses where the candidate is waiting on the employer to review or act. */
const AWAITING_REVIEW: Application['status'][] = ['applied', 'under_review', 'recruiter_screening']

/** Statuses where a candidate is mid-process and needs a decision. */
const AWAITING_DECISION: Application['status'][] = [
  'interview_scheduled',
  'assessment_required',
  'assessment_submitted',
  'submitted_to_client',
  'client_interview',
  'final_interview',
]

interface ActionCenterProps {
  companyId: string | undefined
  companyName: string | undefined
  jobs: Job[] | undefined
  applications: Application[] | undefined
  upcomingInterviews: Interview[] | undefined
  isLoading: boolean
}

interface Action {
  key: string
  icon: typeof Inbox
  title: string
  desc: string
  to: string
}

export function ActionCenter({
  companyId,
  companyName,
  jobs = [],
  applications = [],
  upcomingInterviews = [],
  isLoading,
}: ActionCenterProps) {
  const { t } = useI18n()

  const actions = useMemo<Action[]>(() => {
    if (!companyId) {
      return [
        {
          key: 'register-company',
          icon: Building2,
          title: t('dashboard.actions.registerCompany'),
          desc: t('dashboard.actions.registerCompanyDesc'),
          to: '/employer/post-job',
        },
      ]
    }

    const list: Action[] = []

    const pendingModeration = jobs.filter((j) => j.moderationStatus === 'pending').length
    if (pendingModeration > 0) {
      list.push({
        key: 'jobs-pending',
        icon: ShieldAlert,
        title: t('dashboard.actions.jobsPending', {
          count: pendingModeration,
          s: pendingModeration === 1 ? '' : 's',
        }),
        desc: t('dashboard.actions.jobsPendingDesc'),
        to: '/employer/jobs',
      })
    }

    const toReview = applications.filter((a) => AWAITING_REVIEW.includes(a.status)).length
    if (toReview > 0) {
      list.push({
        key: 'review-applicants',
        icon: Inbox,
        title: t('dashboard.actions.reviewApplicants', {
          count: toReview,
          s: toReview === 1 ? '' : 's',
        }),
        desc: t('dashboard.actions.reviewApplicantsDesc'),
        to: '/employer/applications',
      })
    }

    if (upcomingInterviews.length > 0) {
      const firstJobId = upcomingInterviews[0].jobId
      list.push({
        key: 'interviews',
        icon: CalendarClock,
        title: t('dashboard.actions.interviews', {
          count: upcomingInterviews.length,
          s: upcomingInterviews.length === 1 ? '' : 's',
        }),
        desc: t('dashboard.actions.interviewsDesc'),
        to: firstJobId ? `/employer/manage/${firstJobId}` : '/employer/jobs',
      })
    }

    const awaitingDecision = applications.filter((a) => AWAITING_DECISION.includes(a.status)).length
    if (awaitingDecision > 0) {
      list.push({
        key: 'awaiting-decision',
        icon: Users,
        title: t('dashboard.actions.interviewStage', {
          count: awaitingDecision,
          s: awaitingDecision === 1 ? '' : 's',
        }),
        desc: t('dashboard.actions.interviewStageDesc'),
        to: '/employer/applications',
      })
    }

    const drafts = jobs.filter((j) => j.status === 'draft').length
    if (drafts > 0) {
      list.push({
        key: 'draft-jobs',
        icon: FileEdit,
        title: t('dashboard.actions.draftJobs', {
          count: drafts,
          s: drafts === 1 ? '' : 's',
        }),
        desc: t('dashboard.actions.draftJobsDesc'),
        to: '/employer/jobs',
      })
    }

    return list.slice(0, 4)
  }, [companyId, jobs, applications, upcomingInterviews, t])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            {t('dashboard.actions.title')}
          </CardTitle>
          <CardDescription>
            {companyName ? t('dashboard.actions.desc', { company: companyName }) : t('dashboard.actions.descNoCompany')}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" asChild className="shrink-0 gap-1">
          <Link to="/employer/post-job">
            {t('dashboard.actions.postJob')}
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
        ) : actions.length === 0 ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="size-5 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">{t('dashboard.actions.allCaughtUp')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.actions.allCaughtUpDesc')}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {actions.map((a) => (
              <Link
                key={a.key}
                to={a.to}
                className="group flex items-center gap-3 rounded-lg border border-border p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <span className="shrink-0 rounded-md bg-primary/10 text-primary p-2">
                  <a.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{a.title}</span>
                  <span className="block text-xs text-muted-foreground">{a.desc}</span>
                </span>
                <ArrowRight className="size-3.5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
