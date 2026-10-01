/**
 * Application email notifications.
 *
 * AS OF MIGRATION 030 (email notification system, owner item 3):
 * Application-related emails are the SINGLE SOURCE OF TRUTH of the DB layer —
 * the AFTER-INSERT trigger on `applications` (migration 030) enqueues
 * `candidate_confirm` (to the applicant) and `employer_alert` (to the job
 * owner + optional assignee, deduped) into `public.email_outbox`. The
 * `send-email` Edge Function drains the outbox and sends through Resend.
 *
 * Therefore this module no longer sends directly from the client (which would
 * DOUBLE-SEND every application email once the outbox pipeline is live). Its
 * callers (`apply.$id.tsx`, `m/jobs.$id.tsx`) remain: they call this as a
 * fire-and-forget no-op so the migration/edge-function is the sole sender and
 * the legacy `jobs@` catchall (which never had a mailbox) is retired.
 *
 * If migration 030 is NOT yet applied on a surface, these emails are simply
 * skipped (no error) — the outbox is added during this same launch, so there
 * is no email-loss window.
 */
import type { Application, Job } from '@/types'
import type { Locale as I18nLocale } from '@/i18n/types'

export type { I18nLocale as Locale }
export interface NotificationContext {
  app: Application
  job: Job
  candidateProfile: { fullName?: string; email?: string; notificationPrefs?: { applicationUpdates?: boolean } } | null
  locale: I18nLocale
  dashboardUrl: string
  jobsUrl: string
  resumeUrl: string | null
  coverNote: string
}
interface SendOutcome {
  candidate: { ok: boolean; error?: string }
}
/**
 * Dispatch point for application emails.
 *
 * Currently a guarded no-op: application emails are sent by the migration-030
 * trigger + send-email edge function (single source of truth). Kept as an
 * explicit call site so future interactive sends can be added here without
 * touching the apply routes.
 *
 * Always returns an outcome object — never throws.
 */
export async function sendApplicationNotifications(
  _ctx: NotificationContext,
): Promise<SendOutcome> {
  // Emails are enqueued by migration 030's applications trigger and sent by the
  // send-email edge function. No client-side send here (avoids double-send).
  return { candidate: { ok: true } }
}
