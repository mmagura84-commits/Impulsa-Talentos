import type { ApplicationStatus } from '@/types'

/**
 * Single source of truth for the 15-status application pipeline
 * (mirrors `ApplicationStatus` in src/types). Keeps pill colors, chart
 * hex colors, and status groupings consistent across employer, candidate,
 * and HQ UIs. Column-level grouping lives in PipelineKanban (KANBAN_COLUMNS).
 */

/** All 15 statuses in canonical flow order. */
export const APPLICATION_STATUS_FLOW: ApplicationStatus[] = [
  'draft',
  'applied',
  'under_review',
  'recruiter_screening',
  'interview_scheduled',
  'assessment_required',
  'assessment_submitted',
  'submitted_to_client',
  'client_interview',
  'final_interview',
  'offer',
  'hired',
  'not_selected',
  'position_closed',
  'withdrawn',
]

/** Pipeline-to-hire order (excludes draft + terminal reject statuses). */
export const PIPELINE_STATUSES: ApplicationStatus[] = [
  'applied',
  'under_review',
  'recruiter_screening',
  'interview_scheduled',
  'assessment_required',
  'assessment_submitted',
  'submitted_to_client',
  'client_interview',
  'final_interview',
  'offer',
  'hired',
]

/** Statuses that count as "in progress" (candidate-facing active set). */
export const ACTIVE_APPLICATION_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'applied',
  'under_review',
  'recruiter_screening',
  'interview_scheduled',
  'assessment_required',
  'assessment_submitted',
  'submitted_to_client',
  'client_interview',
  'final_interview',
])

const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  'not_selected',
  'position_closed',
  'withdrawn',
])

/** Tailwind pill classes per status (hues match PipelineKanban columns). */
export const STATUS_PILL_CLASSES: Record<ApplicationStatus, string> = {
  draft: 'border-slate-400/30 text-slate-500 bg-slate-400/5',
  applied: 'border-blue-500/30 text-blue-700 bg-blue-500/5',
  recruiter_screening: 'border-indigo-500/30 text-indigo-700 bg-indigo-500/5',
  under_review: 'border-cyan-500/30 text-cyan-700 bg-cyan-500/5',
  interview_scheduled: 'border-amber-500/30 text-amber-700 bg-amber-500/5',
  assessment_required: 'border-orange-500/30 text-orange-700 bg-orange-500/5',
  assessment_submitted: 'border-orange-500/30 text-orange-700 bg-orange-500/5',
  submitted_to_client: 'border-purple-500/30 text-purple-700 bg-purple-500/5',
  client_interview: 'border-purple-500/30 text-purple-700 bg-purple-500/5',
  final_interview: 'border-violet-500/30 text-violet-700 bg-violet-500/5',
  offer: 'border-pink-500/30 text-pink-700 bg-pink-500/5',
  hired: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/5',
  not_selected: 'border-destructive/30 text-destructive bg-destructive/5',
  position_closed: 'border-destructive/30 text-destructive bg-destructive/5',
  withdrawn: 'border-destructive/30 text-destructive bg-destructive/5',
}

/** Chart hex colors per status (hues match STATUS_PILL_CLASSES). */
export const STATUS_HEX_COLORS: Record<ApplicationStatus, string> = {
  draft: '#94a3b8',
  applied: '#3b82f6',
  recruiter_screening: '#6366f1',
  under_review: '#06b6d4',
  interview_scheduled: '#f59e0b',
  assessment_required: '#f97316',
  assessment_submitted: '#f97316',
  submitted_to_client: '#a855f7',
  client_interview: '#a855f7',
  final_interview: '#8b5cf6',
  offer: '#ec4899',
  hired: '#10b981',
  not_selected: '#ef4444',
  position_closed: '#ef4444',
  withdrawn: '#ef4444',
}

export function isActiveApplicationStatus(s: ApplicationStatus): boolean {
  return ACTIVE_APPLICATION_STATUSES.has(s)
}

export function isTerminalApplicationStatus(s: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.has(s)
}

/* ── Candidate view: five plain stages ─────────────────────────────────────
 * Employers work the full 15-status pipeline; candidates only need to know
 * where they stand and what happens next. Every status maps to one of five
 * stages, plus a one-line next step. (The email function keeps the same
 * mapping in supabase/functions/notification-email/templates.ts.) */
export const CANDIDATE_STAGES = ['applied', 'review', 'interviewing', 'offer', 'decision'] as const
export type CandidateStage = (typeof CANDIDATE_STAGES)[number]

const STAGE_OF: Record<string, CandidateStage> = {
  draft: 'applied',
  applied: 'applied',
  under_review: 'review',
  recruiter_screening: 'review',
  submitted_to_client: 'review',
  interview_scheduled: 'interviewing',
  assessment_required: 'interviewing',
  assessment_submitted: 'interviewing',
  client_interview: 'interviewing',
  final_interview: 'interviewing',
  offer: 'offer',
  hired: 'decision',
  not_selected: 'decision',
  position_closed: 'decision',
  withdrawn: 'decision',
}

export function candidateStage(status: string): CandidateStage {
  return STAGE_OF[status] ?? 'applied'
}

/** 0-based position of the stage, for a 5-step tracker. */
export function candidateStageIndex(status: string): number {
  return CANDIDATE_STAGES.indexOf(candidateStage(status))
}

/** Translation key of the stage's label, e.g. `candidateStage.review`. */
export function candidateStageLabelKey(status: string): string {
  const stage = candidateStage(status)
  if (stage !== 'decision') return `candidateStage.${stage}`
  return status === 'hired' ? 'candidateStage.hired' : status === 'withdrawn' ? 'candidateStage.withdrawn' : 'candidateStage.closed'
}

/** Translation key of the one-line "what happens next" for this status. */
export function candidateNextStepKey(status: string): string {
  if (status === 'assessment_required') return 'candidateNext.assessment'
  if (status === 'hired') return 'candidateNext.hired'
  if (status === 'not_selected') return 'candidateNext.notSelected'
  if (status === 'position_closed') return 'candidateNext.closed'
  if (status === 'withdrawn') return 'candidateNext.withdrawn'
  return `candidateNext.${candidateStage(status)}`
}

/** Good, neutral or ended — drives the colour of the candidate's stage pill. */
export function candidateStageTone(status: string): 'active' | 'good' | 'ended' {
  if (status === 'hired') return 'good'
  if (TERMINAL_STATUSES.has(status as ApplicationStatus)) return 'ended'
  return 'active'
}
