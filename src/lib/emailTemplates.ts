/**
 * Application notification emails.
 *
 * Renders localized HTML + plain-text versions of two transactional emails:
 *   1. Candidate confirmation — "we got your application, here's the receipt"
 *   2. Employer notification — "you have a new candidate, here's the resume"
 *
 * The function is intentionally pure (no React, no I/O) so it can be unit
 * tested or reused from a backend queue in the future.
 */
import type { Job, Application } from '@/types'

/* ── Localization helpers ───────────────────────────────── */
type Locale = 'en' | 'es'

export type { Locale }

type CandidateEmailCopy = {
  subject: string
  preview: string
  heading: string
  thanks: (title: string) => string
  body: string
  receiptTitle: string
  receiptId: string
  job: string
  company: string
  status: string
  submittedOn: (date: string) => string
  resume: string
  attached: string
  notAttached: string
  coverNote: string
  whatNext: string
  next1: string
  next2: string
  ctaDashboard: string
  ctaBrowse: string
  signature: string
  tagline: string
}

type EmployerEmailCopy = {
  subject: (title: string) => string
  preview: string
  heading: (title: string) => string
  body: (count: number) => string
  candidateCard: string
  name: string
  email: string
  phone: string
  location: string
  languages: string
  resume: string
  openResume: string
  coverNote: string
  noNote: string
  notAttached: string
  jobSummary: string
  level: string
  modality: string
  languages_: string
  applied: string
  ctaReview: (title: string) => string
  signature: string
  tagline: string
}

const candidateCopy: Record<Locale, CandidateEmailCopy> = {
  en: {
    subject: 'We received your application — Impulsa Talentos',
    preview: 'Your application is now in the employer\'s queue.',
    heading: 'Application received!',
    thanks: (title) => `Thanks for applying to ${title}.`,
    body: 'Your application is now in the employer\'s queue. They typically respond within 3–5 business days. You can track your application status in real time from your dashboard.',
    receiptTitle: 'Application receipt',
    receiptId: 'Confirmation ID',
    job: 'Job',
    company: 'Company',
    status: 'Status',
    submittedOn: (date) => `Submitted on ${date}`,
    resume: 'Resume',
    attached: 'Attached',
    notAttached: 'Not attached',
    coverNote: 'Your message',
    whatNext: 'What happens next',
    next1: 'The employer reviews your resume and profile.',
    next2: 'If there\'s a fit, they\'ll reach out via email to schedule an interview.',
    ctaDashboard: 'View my applications',
    ctaBrowse: 'Browse more jobs',
    signature: 'The Impulsa Talentos team',
    tagline: 'Connecting bilingual talent with the world.',
  },
  es: {
    subject: 'Recibimos tu postulación — Impulsa Talentos',
    preview: 'Tu postulación ya está en la cola del empleador.',
    heading: '¡Postulación recibida!',
    thanks: (title) => `Gracias por postularte a ${title}.`,
    body: 'Tu postulación ya está en la cola del empleador. Normalmente responden en 3–5 días hábiles. Puedes seguir el estado de tu postulación en tiempo real desde tu dashboard.',
    receiptTitle: 'Comprobante de postulación',
    receiptId: 'ID de confirmación',
    job: 'Vacante',
    company: 'Empresa',
    status: 'Estado',
    submittedOn: (date) => `Enviada el ${date}`,
    resume: 'CV',
    attached: 'Adjunto',
    notAttached: 'No adjunto',
    coverNote: 'Tu mensaje',
    whatNext: 'Qué sigue ahora',
    next1: 'El empleador revisa tu CV y perfil.',
    next2: 'Si hay match, te contactarán por correo para agendar una entrevista.',
    ctaDashboard: 'Ver mis postulaciones',
    ctaBrowse: 'Ver más vacantes',
    signature: 'El equipo de Impulsa Talentos',
    tagline: 'Conectando talento bilingüe con el mundo.',
  },
}

const employerCopy: Record<Locale, EmployerEmailCopy> = {
  en: {
    subject: (title) => `New candidate for ${title}`,
    preview: 'A bilingual candidate just applied — review their resume.',
    heading: (title) => `New application: ${title}`,
    body: (count) => `You have ${count} new ${count === 1 ? 'application' : 'applications'} to review. Bilingual candidates are pre-screened for the language and skill requirements you set.`,
    candidateCard: 'Candidate',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    location: 'Location',
    languages: 'Languages',
    resume: 'Resume',
    openResume: 'Open resume',
    coverNote: 'Message from the candidate',
    noNote: 'No cover note provided.',
    notAttached: 'Not attached',
    jobSummary: 'Job details',
    level: 'Level',
    modality: 'Modality',
    languages_: 'Required languages',
    applied: 'Applied',
    ctaReview: (title) => `Review applications for ${title}`,
    signature: 'The Impulsa Talentos team',
    tagline: 'Bilingual recruitment powered by our proprietary technology.',
  },
  es: {
    subject: (title) => `Nuevo candidato para ${title}`,
    preview: 'Un candidato bilingüe acaba de postularse — revisa su CV.',
    heading: (title) => `Nueva postulación: ${title}`,
    body: (count) => `Tienes ${count} ${count === 1 ? 'postulación nueva' : 'postulaciones nuevas'} para revisar. Los candidatos bilingües ya están pre-filtrados según los requisitos de idioma y habilidades que configuraste.`,
    candidateCard: 'Candidato',
    name: 'Nombre',
    email: 'Correo',
    phone: 'Teléfono',
    location: 'Ubicación',
    languages: 'Idiomas',
    resume: 'CV',
    openResume: 'Abrir CV',
    coverNote: 'Mensaje del candidato',
    noNote: 'El candidato no incluyó nota de presentación.',
    notAttached: 'No adjunto',
    jobSummary: 'Detalles de la vacante',
    level: 'Nivel',
    modality: 'Modalidad',
    languages_: 'Idiomas requeridos',
    applied: 'Postulado',
    ctaReview: (title) => `Revisar postulaciones de ${title}`,
    signature: 'El equipo de Impulsa Talentos',
    tagline: 'Reclutamiento bilingüe con nuestra tecnología propietaria.',
  },
}

/* ── Inputs ────────────────────────────────────────────── */
export interface CandidateEmailInput {
  locale: Locale
  app: Application
  job: Job
  companyName: string
  candidateName: string
  candidateEmail: string
  resumeUrl: string | null
  coverNote: string
  dashboardUrl: string
  jobsUrl: string
}

export interface EmployerEmailInput {
  locale: Locale
  app: Application
  job: Job
  companyName: string
  candidate: {
    fullName: string
    email: string
    phone: string
    location: string
    languages: string
  }
  resumeUrl: string | null
  coverNote: string
  /** Total open applications for the same job — used in subject line. */
  totalApplications: number
  reviewUrl: string
}

/* ── Shared HTML shell ────────────────────────────────── */
function shell(preview: string, content: string, copy: { signature: string; tagline: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Impulsa Talentos</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#1f3a8a 0%,#3b82f6 100%);padding:24px 28px;">
            <span style="display:inline-block;font-family:'Lora',Georgia,serif;font-weight:700;font-size:22px;color:#ffffff;letter-spacing:-0.2px;">
              Impulsa <span style="color:#facc15;">Talentos</span>
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">${content}</td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;line-height:1.5;">
            <p style="margin:0 0 4px;font-weight:600;color:#0f172a;">${escapeHtml(copy.signature)}</p>
            <p style="margin:0;">${escapeHtml(copy.tagline)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function formatDate(iso: string, locale: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'es' ? 'es-CO' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch {
    return iso
  }
}

function ctaButton(href: string, label: string, locale: Locale): string {
  const dir = locale === 'es' ? 'ltr' : 'ltr'
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
  <tr>
    <td bgcolor="#1f3a8a" style="border-radius:8px;" align="center">
      <a href="${escapeAttr(href)}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 22px;font-family:inherit;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;direction:${dir};">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`
}

/* ── Candidate email ──────────────────────────────────── */
export function buildCandidateEmail(input: CandidateEmailInput): { subject: string; html: string; text: string } {
  const { locale, app, job, companyName, candidateName, candidateEmail, resumeUrl, coverNote, dashboardUrl, jobsUrl } = input
  const c = candidateCopy[locale]
  const submittedOn = formatDate(app.createdAt, locale)

  const htmlBody = `
    <h1 style="margin:0 0 12px;font-family:'Lora',Georgia,serif;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">
      ${escapeHtml(c.heading)}
    </h1>
    <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">
      <strong>${escapeHtml(candidateName)},</strong> ${escapeHtml(c.thanks(job.title))}
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
      ${escapeHtml(c.body)}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${escapeHtml(c.receiptTitle)}</p>
        <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;font-family:ui-monospace,monospace;">${escapeHtml(c.receiptId)}: ${escapeHtml(app.id)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#0f172a;">
          <tr><td style="padding:4px 0;color:#64748b;width:120px;">${escapeHtml(c.job)}</td><td style="padding:4px 0;"><strong>${escapeHtml(job.title)}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">${escapeHtml(c.company)}</td><td style="padding:4px 0;">${escapeHtml(companyName)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">${escapeHtml(c.status)}</td><td style="padding:4px 0;">${escapeHtml(c.submittedOn(submittedOn))}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;">${escapeHtml(c.resume)}</td><td style="padding:4px 0;">${resumeUrl ? `<a href="${escapeAttr(resumeUrl)}" style="color:#1f3a8a;text-decoration:underline;">${escapeHtml(c.attached)}</a>` : escapeHtml(c.notAttached)}</td></tr>
        </table>
      </td></tr>
    </table>

    ${coverNote ? `
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${escapeHtml(c.coverNote)}</p>
    <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #3b82f6;background:#eff6ff;border-radius:0 8px 8px 0;font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-line;">${escapeHtml(coverNote)}</blockquote>
    ` : ''}

    <p style="margin:24px 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${escapeHtml(c.whatNext)}</p>
    <ol style="margin:0 0 8px;padding-left:20px;font-size:14px;color:#475569;line-height:1.7;">
      <li>${escapeHtml(c.next1)}</li>
      <li>${escapeHtml(c.next2)}</li>
    </ol>

    ${ctaButton(dashboardUrl, c.ctaDashboard, locale)}
    <p style="margin:8px 0 0;font-size:13px;">
      <a href="${escapeAttr(jobsUrl)}" style="color:#1f3a8a;text-decoration:underline;">${escapeHtml(c.ctaBrowse)}</a>
    </p>
  `

  const text = [
    `${c.heading}`,
    ``,
    `${candidateName}, ${c.thanks(job.title)}`,
    ``,
    c.body,
    ``,
    `--- ${c.receiptTitle} ---`,
    `${c.receiptId}: ${app.id}`,
    `${c.job}: ${job.title}`,
    `${c.company}: ${companyName}`,
    `${c.status}: ${c.submittedOn(submittedOn)}`,
    `${c.resume}: ${resumeUrl ?? c.notAttached}`,
    ``,
    coverNote ? `${c.coverNote}:\n${coverNote}\n` : '',
    c.whatNext,
    `  1. ${c.next1}`,
    `  2. ${c.next2}`,
    ``,
    `${c.ctaDashboard}: ${dashboardUrl}`,
    `${c.ctaBrowse}: ${jobsUrl}`,
    ``,
    c.signature,
    c.tagline,
  ].filter(Boolean).join('\n')

  return {
    subject: c.subject,
    html: shell(c.preview, htmlBody, c),
    text,
  }
}

/* ── Employer email ───────────────────────────────────── */
export function buildEmployerEmail(input: EmployerEmailInput): { subject: string; html: string; text: string } {
  const { locale, app, job, companyName, candidate, resumeUrl, coverNote, totalApplications, reviewUrl } = input
  const c = employerCopy[locale]
  const appliedOn = formatDate(app.createdAt, locale)

  const htmlBody = `
    <h1 style="margin:0 0 12px;font-family:'Lora',Georgia,serif;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">
      ${escapeHtml(c.heading(job.title))}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.6;">
      ${escapeHtml(c.body(totalApplications))}
    </p>

    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${escapeHtml(c.candidateCard)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:16px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(candidate.fullName)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#0f172a;">
          <tr><td style="padding:3px 0;color:#64748b;width:120px;">${escapeHtml(c.email)}</td><td style="padding:3px 0;"><a href="mailto:${escapeAttr(candidate.email)}" style="color:#1f3a8a;text-decoration:underline;">${escapeHtml(candidate.email)}</a></td></tr>
          ${candidate.phone ? `<tr><td style="padding:3px 0;color:#64748b;">${escapeHtml(c.phone)}</td><td style="padding:3px 0;">${escapeHtml(candidate.phone)}</td></tr>` : ''}
          ${candidate.location ? `<tr><td style="padding:3px 0;color:#64748b;">${escapeHtml(c.location)}</td><td style="padding:3px 0;">${escapeHtml(candidate.location)}</td></tr>` : ''}
          ${candidate.languages ? `<tr><td style="padding:3px 0;color:#64748b;">${escapeHtml(c.languages)}</td><td style="padding:3px 0;">${escapeHtml(candidate.languages)}</td></tr>` : ''}
          <tr><td style="padding:3px 0;color:#64748b;">${escapeHtml(c.resume)}</td><td style="padding:3px 0;">${resumeUrl ? `<a href="${escapeAttr(resumeUrl)}" style="color:#1f3a8a;text-decoration:underline;font-weight:600;">${escapeHtml(c.openResume)} →</a>` : `<span style="color:#94a3b8;">${escapeHtml(c.notAttached)}</span>`}</td></tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${escapeHtml(c.jobSummary)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:16px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(job.title)}</p>
        <p style="margin:0 0 12px;font-size:12px;color:#64748b;">${escapeHtml(companyName)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;color:#475569;">
          ${job.level ? `<tr><td style="padding:2px 0;color:#64748b;width:120px;">${escapeHtml(c.level)}</td><td style="padding:2px 0;">${escapeHtml(job.level)}</td></tr>` : ''}
          <tr><td style="padding:2px 0;color:#64748b;">${escapeHtml(c.modality)}</td><td style="padding:2px 0;">${escapeHtml(job.locationType)}</td></tr>
          ${job.languagesRequired ? `<tr><td style="padding:2px 0;color:#64748b;">${escapeHtml(c.languages_)}</td><td style="padding:2px 0;">${escapeHtml(job.languagesRequired)}</td></tr>` : ''}
          <tr><td style="padding:2px 0;color:#64748b;">${escapeHtml(c.applied)}</td><td style="padding:2px 0;">${escapeHtml(appliedOn)}</td></tr>
        </table>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;">${escapeHtml(c.coverNote)}</p>
    <blockquote style="margin:0 0 24px;padding:12px 16px;border-left:3px solid #3b82f6;background:#eff6ff;border-radius:0 8px 8px 0;font-size:14px;color:#0f172a;line-height:1.6;white-space:pre-line;">${coverNote ? escapeHtml(coverNote) : escapeHtml(c.noNote)}</blockquote>

    ${ctaButton(reviewUrl, c.ctaReview(job.title), locale)}
  `

  const text = [
    c.heading(job.title),
    ``,
    c.body(totalApplications),
    ``,
    `--- ${c.candidateCard} ---`,
    `${c.name}: ${candidate.fullName}`,
    `${c.email}: ${candidate.email}`,
    candidate.phone ? `${c.phone}: ${candidate.phone}` : '',
    candidate.location ? `${c.location}: ${candidate.location}` : '',
    candidate.languages ? `${c.languages}: ${candidate.languages}` : '',
    `${c.resume}: ${resumeUrl ?? c.notAttached}`,
    ``,
    `--- ${c.jobSummary} ---`,
    `${job.title} — ${companyName}`,
    job.level ? `${c.level}: ${job.level}` : '',
    `${c.modality}: ${job.locationType}`,
    job.languagesRequired ? `${c.languages_}: ${job.languagesRequired}` : '',
    `${c.applied}: ${appliedOn}`,
    ``,
    `--- ${c.coverNote} ---`,
    coverNote || c.noNote,
    ``,
    `${c.ctaReview(job.title)}: ${reviewUrl}`,
    ``,
    c.signature,
    c.tagline,
  ].filter(Boolean).join('\n')

  return {
    subject: c.subject(job.title),
    html: shell(c.preview, htmlBody, c),
    text,
  }
}
