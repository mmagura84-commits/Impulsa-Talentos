/**
 * Application notifications — fires the candidate confirmation email
 * and a lightweight heads-up to jobs@ after a successful apply.
 *
 * Employers are NEVER emailed directly. They review applications
 * exclusively through their Impulsa Talentos dashboard.
 *
 * Designed to be fire-and-forget — a failed notification never blocks
 * the candidate's confirmation flow.
 */
import { sendEmail } from '@/lib/emailSender'
import {
  buildCandidateEmail,
  type CandidateEmailInput,
} from '@/lib/emailTemplates'
import type { Application, Job, Company } from '@/types'
import { getRow, countRows, supabase } from '@/lib/supabase'
import type { Locale } from '@/lib/emailTemplates'
import type { Locale as I18nLocale } from '@/i18n/types'

const JOBS_EMAIL = 'jobs@impulsatalentos.expert'

// Re-export for callers
export type { Locale }

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
 * Dispatch the candidate confirmation email + jobs@ notification.
 * Always returns an outcome object — never throws.
 */
export async function sendApplicationNotifications(
  ctx: NotificationContext,
): Promise<SendOutcome> {
  const out: SendOutcome = { candidate: { ok: false } }

  try {
    const candidateName = ctx.candidateProfile?.fullName?.trim() || 'Candidate'
    const candidateEmail = ctx.candidateProfile?.email?.trim() || undefined
    const candidateOptedOut = ctx.candidateProfile?.notificationPrefs?.applicationUpdates === false
    const resolvedResumeUrl = await resolveResumeUrl(ctx.resumeUrl)

    // pt email copy is pending — fall back to Spanish (closest supported language)
    const emailLocale: Locale = ctx.locale === 'en' ? 'en' : 'es'
    // 1. Candidate confirmation
    if (candidateEmail && !candidateOptedOut) {
      const input: CandidateEmailInput = {
        locale: emailLocale, app: ctx.app, job: ctx.job,
        companyName: await resolveCompanyName(ctx.job.companyId),
        candidateName, candidateEmail,
        resumeUrl: resolvedResumeUrl, coverNote: ctx.coverNote,
        dashboardUrl: ctx.dashboardUrl, jobsUrl: ctx.jobsUrl,
      }
      try {
        await sendEmail({ to: candidateEmail, subject: buildCandidateEmail(input).subject, html: buildCandidateEmail(input).html, text: buildCandidateEmail(input).text })
        out.candidate = { ok: true }
      } catch (err) {
        out.candidate = { ok: false, error: err instanceof Error ? err.message : String(err) }
        console.warn('[notifyApplication] candidate email failed', err)
      }
    }

    // 2. jobs@ notification (fire-and-forget)
    const companyName = await resolveCompanyName(ctx.job.companyId)
    const total = await countApplicationsForJob(ctx.job.id)
    sendEmail({
      to: JOBS_EMAIL,
      subject: `[New Application] ${candidateName} → ${ctx.job.title} at ${companyName}`,
      text: `${candidateName} applied for "${ctx.job.title}" at ${companyName}. Total apps: ${total}.`,
      html: `<p><strong>${candidateName}</strong> applied for <strong>${ctx.job.title}</strong> at ${companyName}.</p><p>Total: ${total}</p>`,
    }).catch(e => console.warn('[notifyApplication] jobs@ notification failed', e))
  } catch (err) {
    console.warn('[notifyApplication] unexpected error', err)
  }
  return out
}

async function fetchCompany(companyId: string): Promise<Company | null> {
  try { return (await getRow<Company>('companies', companyId)) ?? null } catch { return null }
}
async function countApplicationsForJob(jobId: string): Promise<number> {
  try { return await countRows('applications', { jobId }) } catch { return 1 }
}
async function resolveCompanyName(companyId: string): Promise<string> {
  const c = await fetchCompany(companyId); return c?.name || 'the company'
}

async function resolveResumeUrl(value: string | null): Promise<string | null> {
  if (!value || !value.startsWith('storage:cvs:')) return value
  const path = value.slice('storage:cvs:'.length)
  const { data, error } = await supabase.storage.from('cvs').createSignedUrl(path, 60 * 60)
  return error ? null : data?.signedUrl ?? null
}
