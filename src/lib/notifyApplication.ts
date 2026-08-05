/**
 * Application notifications — fires the candidate confirmation email
 * and a platform heads-up after a successful apply.
 *
 * Employers are NEVER emailed directly. They review applications
 * exclusively through their Impulsa Talentos dashboard. The platform
 * team (partners@) receives a lightweight notification so they know
 * activity is happening.
 *
 * Designed to be fire-and-forget — a failed notification never blocks
 * the candidate's confirmation flow.
 */
import { sendEmail } from '@/lib/emailSender'
import {
  buildCandidateEmail,
  type CandidateEmailInput,
} from '@/lib/emailTemplates'
import type { Application, Job, Company, Profile } from '@/types'
import { listRows, getRow, countRows } from '@/lib/supabase'
import type { Locale } from '@/lib/emailTemplates'

const PLATFORM_EMAIL = 'partners@impulsatalentos.expert'

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
  /** URL to the employer's applications review screen (used in platform notification). */
  reviewUrl: string
  /** Resume public URL (file upload or link) if any. */
  resumeUrl: string | null
  /** Cover note as the candidate typed it. */
  coverNote: string
}

interface SendOutcome {
  candidate: { ok: boolean; error?: string }
  platform: { ok: boolean; error?: string }
}

/**
 * Dispatch the candidate confirmation email and a platform notification.
 * Always returns an outcome object — never throws — so callers can safely
 * fire-and-forget.
 *
 * Employers are NOT emailed. They discover applications in their dashboard.
 */
export async function sendApplicationNotifications(
  ctx: NotificationContext,
): Promise<SendOutcome> {
  const out: SendOutcome = {
    candidate: { ok: false },
    platform: { ok: false },
  }

  try {
    // ── 1) Candidate confirmation email ──────────────────
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

    // ── 2) Platform notification (partners@) ─────────────
    // Employers are NOT emailed — they review applications in their dashboard.
    const company = await fetchCompany(ctx.job.companyId)
    const companyName = company?.name || 'a company'
    const totalApplications = await countApplicationsForJob(ctx.job.id)

    try {
      await sendEmail({
        to: PLATFORM_EMAIL,
        subject: `[New Application] ${candidateName} applied for ${ctx.job.title}`,
        text: [
          `${candidateName} applied for "${ctx.job.title}" at ${companyName}.`,
          `Total applications for this job: ${totalApplications}`,
          ``,
          `Employer review: ${ctx.reviewUrl}`,
          `HQ view: https://impulsatalentos.expert/hq`,
        ].join('\n'),
        html: [
          `<h2>New job application</h2>`,
          `<p><strong>${escapeHtml(candidateName)}</strong> applied for <strong>${escapeHtml(ctx.job.title)}</strong> at ${escapeHtml(companyName)}.</p>`,
          `<p>Total applications for this job: <strong>${totalApplications}</strong></p>`,
          `<p><em>Employers review applications in their dashboard — no direct email is sent.</em></p>`,
          `<p><a href="${escapeAttr(ctx.reviewUrl)}">Employer review →</a></p>`,
          `<p><a href="https://impulsatalentos.expert/hq">View in HQ →</a></p>`,
        ].join('\n'),
      })
      out.platform = { ok: true }
    } catch (err) {
      out.platform = { ok: false, error: err instanceof Error ? err.message : String(err) }
      console.warn('[notifyApplication] platform notification failed', err)
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c)
  )
}

function escapeAttr(value: string) {
  return value.replace(/"/g, '&quot;')
}
