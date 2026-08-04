/**
 * Interview notification — emails the candidate when an employer saves
 * interview details (link/date) for their application. Fire-and-forget:
 * never throws, so a failed email never blocks the scheduling flow.
 */
import { sendEmail } from '@/lib/emailSender'
import { buildInterviewEmail, type Locale } from '@/lib/interviewEmail'
import type { Application, Job, Profile } from '@/types'

export async function sendInterviewNotification(ctx: {
  app: Application
  job: Job
  companyName: string
  candidateProfile: Profile | null
  locale: Locale
  dashboardUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  const candidateEmail = ctx.candidateProfile?.email?.trim()
  if (!candidateEmail) {
    return { ok: false, error: 'no candidate email on profile' }
  }
  // Respect the candidate's notification preferences (application updates).
  if (ctx.candidateProfile?.notificationPrefs?.applicationUpdates === false) {
    return { ok: false, error: 'candidate opted out of application emails' }
  }
  try {
    const email = buildInterviewEmail({
      locale: ctx.locale,
      job: ctx.job,
      companyName: ctx.companyName,
      candidateName: ctx.candidateProfile?.fullName?.trim() || 'Candidate',
      candidateEmail,
      interviewLink: ctx.app.interviewLink,
      interviewDate: ctx.app.interviewDate,
      dashboardUrl: ctx.dashboardUrl,
    })
    await sendEmail({
      to: candidateEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })
    return { ok: true }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notifyInterview] email failed', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
