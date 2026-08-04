/**
 * Application notifications — fires the candidate + employer emails
 * after a successful apply. Designed to be fire-and-forget so a failed
 * notification never blocks the candidate's confirmation flow.
 *
 * Strategy:
 *   1. Read the candidate's profile (already in the auth session, used
 *      for the candidate's own email + cover-letter context).
 *   2. Read the company so we have the company's name + (when
 *      available) a contact email.
 *   3. Build localized HTML + plain-text emails.
 *   4. Submit both via `sendEmail` (POST /api/email) in parallel.
 *   5. Swallow + log any errors — the apply flow already succeeded.
 */
import { sendEmail } from '@/lib/emailSender'
import {
  buildCandidateEmail,
  buildEmployerEmail,
  type CandidateEmailInput,
  type EmployerEmailInput,
} from '@/lib/emailTemplates'
import type { Application, Job, Company, Profile } from '@/types'
import { listRows, getRow, countRows } from '@/lib/supabase'
import type { Locale } from '@/lib/emailTemplates'

// Re-export for callers
export type { Locale }

export interface NotificationContext {
  app: Application
  job: Job
  /** Lookup of the candidate's profile (always present in normal flow). */
  candidateProfile: Profile | null
  /** Locale to render the emails in. */
  locale: Locale
  /** Public dashboard URL for the candidate. */
  dashboardUrl: string
  /** Public jobs list URL. */
  jobsUrl: string
  /** URL to the employer's applications review screen. */
  reviewUrl: string
  /** Resume public URL (file upload or link) if any. */
  resumeUrl: string | null
  /** Cover note as the candidate typed it. */
  coverNote: string
}

interface SendOutcome {
  candidate: { ok: boolean; error?: string }
  employer: { ok: boolean; error?: string; email?: string }
}

/**
 * Dispatch the two application emails. Always returns an outcome
 * object — never throws — so callers can safely fire-and-forget.
 */
export async function sendApplicationNotifications(
  ctx: NotificationContext,
): Promise<SendOutcome> {
  const out: SendOutcome = {
    candidate: { ok: false },
    employer: { ok: false },
  }

  try {
    // ── 1) Candidate email ────────────────────────────
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
        // eslint-disable-next-line no-console
        console.warn('[notifyApplication] candidate email failed', err)
      }
    } else if (candidateEmail) {
      // Respect the user's notification preferences — skip the email.
      out.candidate = { ok: false, error: 'candidate opted out of application emails' }
    } else {
      out.candidate = { ok: false, error: 'no candidate email on profile' }
    }

    // ── 2) Employer email ─────────────────────────────
    const company = await fetchCompany(ctx.job.companyId)
    if (!company) {
      out.employer = { ok: false, error: 'no company for job' }
      return out
    }

    // The employer's notification inbox is stored on the company row as
    // `contactEmail`. It is required on company creation and editable
    // from the employer dashboard (and HQ), so this always resolves for
    // companies created after the field was added.
    const employerEmail = await resolveEmployerEmail(company)
    if (!employerEmail) {
      out.employer = { ok: false, error: 'no employer email resolvable' }
      return out
    }
    out.employer.email = employerEmail

    // Respect the employer's notification preferences (profile → prefs).
    const employerProfile = await fetchProfileByUserId(company.employerId)
    if (employerProfile?.notificationPrefs?.applicationUpdates === false) {
      out.employer = { ok: false, error: 'employer opted out of application emails' }
      return out
    }

    const totalApplications = await countApplicationsForJob(ctx.job.id)

    const input: EmployerEmailInput = {
      locale: ctx.locale,
      app: ctx.app,
      job: ctx.job,
      companyName: company.name,
      candidate: {
        fullName: candidateName,
        email: candidateEmail ?? '',
        phone: ctx.candidateProfile?.phone ?? '',
        location: ctx.candidateProfile?.location ?? '',
        languages: ctx.candidateProfile?.languages ?? '',
      },
      resumeUrl: ctx.resumeUrl,
      coverNote: ctx.coverNote,
      totalApplications,
      reviewUrl: ctx.reviewUrl,
    }
    const email = buildEmployerEmail(input)
    try {
      await sendEmail({
        to: employerEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })
      out.employer = { ok: true }
    } catch (err) {
      out.employer = { ok: false, error: err instanceof Error ? err.message : String(err) }
      // eslint-disable-next-line no-console
      console.warn('[notifyApplication] employer email failed', err)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
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

/**
 * Resolve a user's profile by their Supabase auth userId (profiles are keyed
 * by row id; the auth id lives on `Profile.userId`).
 */
async function fetchProfileByUserId(userId: string): Promise<Profile | null> {
  try {
    const results = await listRows<Profile>('profiles', {
      where: { userId },
      limit: 1,
    })
    return results[0] ?? null
  } catch {
    return null
  }
}

async function countApplicationsForJob(jobId: string): Promise<number> {
  try {
    return await countRows('applications', { jobId })
  } catch {
    return 1
  }
}

async function resolveCompanyName(companyId: string): Promise<string> {
  const c = await fetchCompany(companyId)
  return c?.name || 'the company'
}

/**
 * Resolve the employer's application-inbox email from the company row.
 *
 * The `contactEmail` field is captured on the company-creation flow and
 * editable from the employer dashboard / HQ. If it's still missing we
 * return undefined — the candidate still receives the receipt and we
 * silently skip the employer notification rather than spam the wrong
 * address.
 */
async function resolveEmployerEmail(
  company: Company,
): Promise<string | undefined> {
  const fromCompany = company.contactEmail?.trim()
  return fromCompany || undefined
}
