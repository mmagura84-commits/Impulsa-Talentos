/**
 * Interview-invite email (Gap 11). Pure function — no React, no I/O —
 * renders localized HTML + plain-text so it can be sent via
 * `blink.notifications.email` from the scheduling flow.
 */
import type { Job } from '@/types'

export type Locale = 'en' | 'es'

export interface InterviewEmailInput {
  locale: Locale
  job: Job
  companyName: string
  candidateName: string
  candidateEmail: string
  interviewLink?: string
  interviewDate?: string
  dashboardUrl: string
}

function formatDate(iso: string | undefined, locale: Locale): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(locale === 'es' ? 'es-CO' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}

export function buildInterviewEmail(
  input: InterviewEmailInput,
): { subject: string; html: string; text: string } {
  const en = input.locale === 'en'
  const dateText = formatDate(input.interviewDate, input.locale)

  const subject = en
    ? `Interview scheduled: ${input.job.title} @ ${input.companyName}`
    : `Entrevista agendada: ${input.job.title} @ ${input.companyName}`

  const heading = en
    ? `Great news — you've been invited to an interview`
    : `Buenas noticias — fuiste invitado a una entrevista`
  const intro = en
    ? `Hi ${input.candidateName}, the team at ${input.companyName} would like to interview you for the role of ${input.job.title}.`
    : `Hola ${input.candidateName}, el equipo de ${input.companyName} quiere entrevistarte para el cargo de ${input.job.title}.`
  const whenLabel = en ? 'When' : 'Cuando'
  const joinLabel = en ? 'Join the interview' : 'Unirse a la entrevista'
  const ctaLabel = en ? 'View application status' : 'Ver estado de la postulacion'
  const dashText = en
    ? 'You can track your application status any time from your dashboard.'
    : 'Puedes seguir el estado de tu postulacion en cualquier momento desde tu panel.'
  const signature = en
    ? 'Good luck! — The Impulsa Talentos team'
    : 'Mucha suerte! — El equipo de Impulsa Talentos'

  const linkBlock = input.interviewLink
    ? `<p style="margin:0 0 16px"><a href="${input.interviewLink}" style="background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${joinLabel}</a></p>`
    : ''
  const dateBlock = dateText
    ? `<p style="margin:0 0 8px;color:#374151"><strong>${whenLabel}:</strong> ${dateText}</p>`
    : ''

  const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="margin:0 0 12px">${heading}</h2>
  <p style="margin:0 0 16px;color:#374151">${intro}</p>
  ${dateBlock}
  ${linkBlock}
  <p style="margin:0 0 16px;color:#374151">${dashText}</p>
  <p style="margin:0 0 24px">
    <a href="${input.dashboardUrl}" style="color:#1d4ed8">${ctaLabel}</a>
  </p>
  <p style="margin:0;color:#6b7280;font-size:13px">${signature}</p>
</div>`

  const text = [
    heading,
    '',
    intro,
    dateText ? `${whenLabel}: ${dateText}` : null,
    input.interviewLink ? `${joinLabel}: ${input.interviewLink}` : null,
    '',
    dashText,
    `${ctaLabel}: ${input.dashboardUrl}`,
    '',
    signature,
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, html, text }
}
