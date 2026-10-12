// Email copy for notification-email. Pure TypeScript (no Deno APIs) so it can
// be unit-tested with bun/node: `bun test supabase/functions/notification-email`.

export type Lang = 'es' | 'en' | 'pt'
export type Role = 'candidate' | 'employer' | 'md' | 'admin' | string

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
}

export interface EmailContent {
  subject: string
  heading: string
  intro: string
  detail: string
  cta: string
  url: string
  html: string
  text: string
}

/** Pipeline emails the person can switch off ("application updates"). */
export function isApplicationUpdate(type: string): boolean {
  return (
    type.startsWith('application_') ||
    type.startsWith('interview_') ||
    type.startsWith('offer_') ||
    type === 'message_received' ||
    type === 'status_changed' ||
    type === 'feedback_added'
  )
}

export function pickLang(value: unknown): Lang {
  return value === 'en' || value === 'pt' ? value : 'es'
}

const STATUS: Record<Lang, Record<string, string>> = {
  en: {
    applied: 'Applied', under_review: 'Under review', recruiter_screening: 'Recruiter screening',
    interview_scheduled: 'Interview scheduled', assessment_required: 'Assessment required',
    assessment_submitted: 'Assessment submitted', submitted_to_client: 'Submitted to client',
    client_interview: 'Client interview', final_interview: 'Final interview', offer: 'Offer',
    hired: 'Hired', not_selected: 'Not selected', position_closed: 'Position closed', withdrawn: 'Withdrawn',
  },
  es: {
    applied: 'Postulada', under_review: 'En revisión', recruiter_screening: 'Evaluación de reclutador',
    interview_scheduled: 'Entrevista programada', assessment_required: 'Evaluación requerida',
    assessment_submitted: 'Evaluación enviada', submitted_to_client: 'Enviada al cliente',
    client_interview: 'Entrevista con cliente', final_interview: 'Entrevista final', offer: 'Oferta',
    hired: 'Contratado', not_selected: 'No seleccionada', position_closed: 'Vacante cerrada', withdrawn: 'Retirada',
  },
  pt: {
    applied: 'Candidatura enviada', under_review: 'Em análise', recruiter_screening: 'Triagem do recrutador',
    interview_scheduled: 'Entrevista agendada', assessment_required: 'Avaliação necessária',
    assessment_submitted: 'Avaliação enviada', submitted_to_client: 'Enviada ao cliente',
    client_interview: 'Entrevista com cliente', final_interview: 'Entrevista final', offer: 'Oferta',
    hired: 'Contratado', not_selected: 'Não selecionado', position_closed: 'Vaga encerrada', withdrawn: 'Retirada',
  },
}

/** [subject, intro] per type. `{t}` is replaced with the notification title. */
const COPY: Record<Lang, Record<string, [string, string]>> = {
  en: {
    application_received: ['New applicant: {t}', 'Someone applied to one of your jobs.'],
    application_withdrawn: ['{t}', 'A candidate withdrew their application.'],
    application_status: ['Update on your application: {t}', 'The status of your application changed.'],
    offer_received: ['{t}', 'You received a job offer. Review it and reply from your dashboard.'],
    offer_accepted: ['{t}', 'Your offer was accepted.'],
    offer_declined: ['{t}', 'Your offer was declined.'],
    interview_scheduled: ['{t}', 'An interview was scheduled (or its time changed).'],
    interview_no_show: ['{t}', 'Your interview was marked as missed. Contact the company if this is wrong.'],
    interview_cancelled: ['{t}', 'Your interview was cancelled.'],
    interview_completed: ['{t}', 'Your interview was marked as completed.'],
    message_received: ['{t}', 'You have a new message.'],
    company_verified: ['Your company is verified', 'You can now publish jobs on Impulsa Talentos.'],
    payment_granted: ['Payment confirmed', 'We confirmed your payment and added your job credits.'],
    payment_rejected: ['Payment not confirmed', 'We could not confirm your transfer. Reply to this email and we will help.'],
    team_invite: ['{t}', 'You were invited to join a company team.'],
    deletion_requested: ['{t}', 'An account deletion request needs review.'],
    _hq: ['[HQ] {t}', 'Something is waiting for HQ.'],
    _default: ['{t}', 'You have a new notification.'],
  },
  es: {
    application_received: ['Nuevo postulante: {t}', 'Alguien se postuló a una de tus vacantes.'],
    application_withdrawn: ['{t}', 'Un candidato retiró su postulación.'],
    application_status: ['Novedades de tu postulación: {t}', 'El estado de tu postulación cambió.'],
    offer_received: ['{t}', 'Recibiste una oferta de trabajo. Revísala y responde desde tu panel.'],
    offer_accepted: ['{t}', 'Tu oferta fue aceptada.'],
    offer_declined: ['{t}', 'Tu oferta fue rechazada.'],
    interview_scheduled: ['{t}', 'Se programó una entrevista (o cambió su horario).'],
    interview_no_show: ['{t}', 'Tu entrevista se marcó como no asistida. Contacta a la empresa si es un error.'],
    interview_cancelled: ['{t}', 'Tu entrevista fue cancelada.'],
    interview_completed: ['{t}', 'Tu entrevista se marcó como completada.'],
    message_received: ['{t}', 'Tienes un mensaje nuevo.'],
    company_verified: ['Tu empresa está verificada', 'Ya puedes publicar vacantes en Impulsa Talentos.'],
    payment_granted: ['Pago confirmado', 'Confirmamos tu pago y agregamos tus créditos de publicación.'],
    payment_rejected: ['Pago no confirmado', 'No pudimos confirmar tu transferencia. Responde este correo y te ayudamos.'],
    team_invite: ['{t}', 'Te invitaron a unirte al equipo de una empresa.'],
    deletion_requested: ['{t}', 'Una solicitud de eliminación de cuenta requiere revisión.'],
    _hq: ['[HQ] {t}', 'Hay algo pendiente para HQ.'],
    _default: ['{t}', 'Tienes una notificación nueva.'],
  },
  pt: {
    application_received: ['Novo candidato: {t}', 'Alguém se candidatou a uma das suas vagas.'],
    application_withdrawn: ['{t}', 'Um candidato retirou a candidatura.'],
    application_status: ['Atualização da sua candidatura: {t}', 'O status da sua candidatura mudou.'],
    offer_received: ['{t}', 'Você recebeu uma oferta de emprego. Revise e responda pelo seu painel.'],
    offer_accepted: ['{t}', 'Sua oferta foi aceita.'],
    offer_declined: ['{t}', 'Sua oferta foi recusada.'],
    interview_scheduled: ['{t}', 'Uma entrevista foi agendada (ou o horário mudou).'],
    interview_no_show: ['{t}', 'Sua entrevista foi marcada como ausência. Fale com a empresa se for um erro.'],
    interview_cancelled: ['{t}', 'Sua entrevista foi cancelada.'],
    interview_completed: ['{t}', 'Sua entrevista foi marcada como concluída.'],
    message_received: ['{t}', 'Você tem uma nova mensagem.'],
    company_verified: ['Sua empresa foi verificada', 'Agora você pode publicar vagas na Impulsa Talentos.'],
    payment_granted: ['Pagamento confirmado', 'Confirmamos seu pagamento e adicionamos seus créditos.'],
    payment_rejected: ['Pagamento não confirmado', 'Não conseguimos confirmar sua transferência. Responda este e-mail e ajudaremos.'],
    team_invite: ['{t}', 'Você foi convidado para a equipe de uma empresa.'],
    deletion_requested: ['{t}', 'Uma solicitação de exclusão de conta precisa de revisão.'],
    _hq: ['[HQ] {t}', 'Há algo aguardando o HQ.'],
    _default: ['{t}', 'Você tem uma nova notificação.'],
  },
}

const CTA: Record<Lang, string> = { en: 'Open Impulsa Talentos', es: 'Abrir Impulsa Talentos', pt: 'Abrir Impulsa Talentos' }
const FOOTER: Record<Lang, string> = {
  en: 'You get this email because of activity on your Impulsa Talentos account. Turn off application updates in your profile.',
  es: 'Recibes este correo por actividad en tu cuenta de Impulsa Talentos. Puedes desactivar las novedades de postulaciones en tu perfil.',
  pt: 'Você recebe este e-mail por atividade na sua conta Impulsa Talentos. Desative as atualizações de candidaturas no seu perfil.',
}

/** Same routing as the in-app NotificationCenter. */
export function linkPath(n: NotificationRow, role: Role): string {
  const data = n.data ?? {}
  const jobId = typeof data.job_id === 'string' ? data.job_id : undefined
  const t = n.type
  if (t.startsWith('hq_') || t === 'deletion_requested') return '/hq'
  if (role === 'candidate') return '/candidate/applications'
  switch (t) {
    case 'team_invite': return '/employer/team'
    case 'company_verified': return '/employer/post-job'
    case 'payment_granted':
    case 'payment_rejected': return '/pricing'
    case 'offer_accepted':
    case 'offer_declined': return '/employer/offers'
    default:
      if (isApplicationUpdate(t)) return jobId ? `/employer/manage/${jobId}` : '/employer/applications'
      return role === 'md' ? '/md' : '/employer/jobs'
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function buildEmail(n: NotificationRow, lang: Lang, role: Role, siteUrl: string): EmailContent {
  const copy = COPY[lang]
  const [subjectTpl, intro] = copy[n.type] ?? (n.type.startsWith('hq_') ? copy._hq : copy._default)
  const title = (n.title || '').trim()
  const subject = subjectTpl.replace('{t}', title).slice(0, 180) || 'Impulsa Talentos'
  // Status changes carry the raw status key as body: show its label.
  const detail = n.type === 'application_status' ? (STATUS[lang][n.body] ?? n.body) : (n.body || '')
  const heading = title || subject
  const url = siteUrl.replace(/\/+$/, '') + linkPath(n, role)
  const cta = CTA[lang]
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td style="font-size:13px;font-weight:bold;color:#1f3a8a;letter-spacing:.04em">IMPULSA TALENTOS</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:bold">${escapeHtml(heading)}</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</td></tr>
${detail ? `<tr><td style="padding-top:12px;font-size:15px;line-height:1.5;color:#374151"><strong>${escapeHtml(detail)}</strong></td></tr>` : ''}
<tr><td style="padding-top:22px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1f3a8a;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:14px">${escapeHtml(cta)}</a></td></tr>
<tr><td style="padding-top:26px;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(FOOTER[lang])}</td></tr>
</table></td></tr></table></body></html>`
  const text = [heading, '', intro, detail, '', `${cta}: ${url}`, '', FOOTER[lang]].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n')
  return { subject, heading, intro, detail, cta, url, html, text }
}
