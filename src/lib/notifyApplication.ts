/**
 * Application notifications — fires the candidate confirmation email
 * after a successful apply.
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
import { getRow } from '@/lib/supabase'
import type { Locale } from '@/lib/emailTemplates'

// Re-export for callers
export type { Locale }

export interface NotificationContext {
  app: Application
  job: Job
  /** Lookup of the candidate's profile. */
  candidateProfile: { fullName?: string; email?: string; notificationPrefs?: { applicationUpdates?: boolean } } | null
  /** Locale to render the emails in. */
  locale: Locale
  /** Public dashboard URL for the candidate. */
  dashboardUrl: string
  /** Public jobs list URL. */
  jobsUrl: string
  /** Resume public URL (file upload or link) if any. */
  resumeUrl: string | null
  /** Cover note as the candidate typed it. */
  coverNote: string
}

interface SendOutcome {
  candidate: { ok: boolean; error?: string }
}

/**
 * Dispatch the candidate confirmation email.
 * Always returns an outcome object — never throws.
 *
 * Employers are NOT emailed. They discover applications in their dashboard.
 * The platform (partners@) is NOT notified — that inbox is for employer
 * correspondence only (lead capture, inquiries).
 */
export async function sendApplicationNotifications(
  ctx: NotificationContext,
): Promise<SendOutcome> {
  const out: SendOutcome = {
    candidate: { ok: false },
  }

  try {
    const candidateName =
      ctx.candidateProfile?.fullName?.trim() ||
      'Candidate'
    const candidateEmail = ctx.candidateProfile?.email?.trim() || undefined
    const candidateOptedOut =
      ctx.candidateProfile?.notificationPrefs?.applicationUpdates === false

    if (candidateEmail && !candidateOptedOut) {
      const input: CandidateEmailInput = {
        locale: ctx.locale,
        app: ctx.app,
        job: ctx.job,
        companyName: await resolveCompanyName(ctx.job.companyId),
        candidateName,
        candidateEmail,
        resumeUrl: ctx.resumeUrl,
        coverNote: ctx.coverNote,
        dashboardUrl: ctx.dashboardUrl,
        jobsUrl: ctx.jobsUrl,
      }
      const email = buildCandidateEmail(input)
      try {
        await sendEmail({
          to: candidateEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })
        out.candidate = { ok: true }
      } catch (err) {
        out.candidate = { ok: false, error: err instanceof Error ? err.message : String(err) }
        console.warn('[notifyApplication] candidate email failed', err)
      }
    } else if (candidateEmail) {
      out.candidate = { ok: false, error: 'candidate opted out of application emails' }
    } else {
      out.candidate = { ok: false, error: 'no candidate email on profile' }
    }
  } catch (err) {
    console.warn('[notifyApplication] unexpected error', err)
  }
  return out
}

/* ── Internal data lookups ─────────────────────────────── */
async function fetchCompany(companyId: string): Promise<Company | null> {
  try {
    return (await getRow<Company>('companies', companyId)) ?? null
  } catch {
    return null
  }
}

async function resolveCompanyName(companyId: string): Promise<string> {
  const c = await fetchCompany(companyId)
  return c?.name || 'the company'
}
