import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Company, Job, Profile } from '@/types'
import { useProfileCompletion } from '@/hooks/useProfileCompletion'

/**
 * Onboarding state machine — tracks the guided first-run steps a new
 * user sees on their dashboard. Persisted to localStorage so progress
 * and dismissal survive reloads.
 *
 * Step completion is DERIVED from real data where possible:
 *   candidate: profile fields filled (from useProfileCompletion),
 *              CV uploaded (cvUrl), browsed jobs (visit flag)
 *   employer:  company created (row exists), first job posted (jobs),
 *              reviewed applications (visit flag)
 * Visit-based flags are set when the user clicks the step's CTA, so we
 * don't need to instrument other routes.
 */

export const ONBOARDING_STORAGE_KEY = 'it_onboarding'

export interface OnboardingState {
  dismissed: boolean
  visitedJobs: boolean
  visitedManage: boolean
}

export interface OnboardingStep {
  id: string
  titleKey: string
  descKey: string
  href: string
  /** Optional route params (e.g. `/manage/$id`). */
  params?: Record<string, string>
  done: boolean
}

const DEFAULT_STATE: OnboardingState = {
  dismissed: false,
  visitedJobs: false,
  visitedManage: false,
}

function loadState(): OnboardingState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
    return raw ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<OnboardingState>) } : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

export function useOnboarding(opts: {
  role: 'candidate' | 'employer'
  profile?: Profile | null
  company?: Company | null
  /** Jobs posted by this employer (employer flow only). */
  jobs?: Job[]
}) {
  const [state, setState] = useState<OnboardingState>(loadState)
  const completion = useProfileCompletion(opts.profile)

  // Persist on every change.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* storage unavailable — state stays in-memory for the session */
    }
  }, [state])

  const dismiss = useCallback(() => setState((s) => ({ ...s, dismissed: true })), [])
  const markVisited = useCallback((key: 'jobs' | 'manage') => {
    setState((s) =>
      key === 'jobs' ? { ...s, visitedJobs: true } : { ...s, visitedManage: true },
    )
  }, [])

  const steps = useMemo<OnboardingStep[]>(() => {
    if (opts.role === 'candidate') {
      const profile = opts.profile
      const field = (key: string) => completion.fields.find((f) => f.key === key)?.filled ?? false
      return [
        {
          id: 'candidate-profile',
          titleKey: 'onboarding.candidate.profile.title',
          descKey: 'onboarding.candidate.profile.desc',
          href: '/profile',
          done: field('fullName') && field('bio') && field('languages') && field('location'),
        },
        {
          id: 'candidate-cv',
          titleKey: 'onboarding.candidate.cv.title',
          descKey: 'onboarding.candidate.cv.desc',
          href: '/profile',
          done: field('cvUrl'),
        },
        {
          id: 'candidate-jobs',
          titleKey: 'onboarding.candidate.jobs.title',
          descKey: 'onboarding.candidate.jobs.desc',
          href: '/jobs',
          done: state.visitedJobs,
        },
      ]
    }

    // employer
    const myJobs = opts.jobs ?? []
    return [
      {
        id: 'employer-company',
        titleKey: 'onboarding.employer.company.title',
        descKey: 'onboarding.employer.company.desc',
        href: '/post-job',
        done: !!opts.company,
      },
      {
        id: 'employer-job',
        titleKey: 'onboarding.employer.job.title',
        descKey: 'onboarding.employer.job.desc',
        href: '/post-job',
        done: myJobs.length > 0,
      },
      {
        id: 'employer-apps',
        titleKey: 'onboarding.employer.apps.title',
        descKey: 'onboarding.employer.apps.desc',
        href: myJobs[0] ? '/manage/$id' : '/dashboard',
        params: myJobs[0] ? { id: myJobs[0].id } : undefined,
        done: state.visitedManage,
      },
    ]
  }, [opts.role, opts.profile, opts.company, opts.jobs, completion.fields, state.visitedJobs, state.visitedManage])

  const doneCount = steps.filter((s) => s.done).length
  const allDone = steps.length > 0 && doneCount === steps.length
  const visible = !state.dismissed && !allDone && steps.length > 0

  return { steps, doneCount, allDone, visible, dismiss, markVisited }
}
