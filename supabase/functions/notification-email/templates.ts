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

/** Candidates see five plain stages (same mapping as src/lib/applicationStatus.ts). */
const STAGE_OF: Record<string, string> = {
  draft: 'applied', applied: 'applied',
  under_review: 'review', recruiter_screening: 'review', submitted_to_client: 'review',
  interview_scheduled: 'interviewing', assessment_required: 'interviewing', assessment_submitted: 'interviewing',
  client_interview: 'interviewing', final_interview: 'interviewing',
  offer: 'offer', hired: 'hired', not_selected: 'closed', position_closed: 'closed', withdrawn: 'withdrawn',
}
const STAGE: Record<Lang, Record<string, string>> = {
  en: { applied: 'Applied', review: 'In review', interviewing: 'Interviewing', offer: 'Offer', hired: 'Hired', closed: 'Not moving forward', withdrawn: 'Withdrawn' },
  es: { applied: 'Postulado', review: 'En revisión', interviewing: 'Entrevistas', offer: 'Oferta', hired: 'Contratado', closed: 'No continúa', withdrawn: 'Retirada' },
  pt: { applied: 'Enviada', review: 'Em análise', interviewing: 'Entrevistas', offer: 'Oferta', hired: 'Contratado', closed: 'Não segue', withdrawn: 'Retirada' },
}
const NEXT: Record<Lang, Record<string, string>> = {
  en: {
    applied: 'The company has your application.', review: 'The company is reviewing your profile. Nothing to do for now.',
    interviewing: 'Check your messages and interviews for times and details.', assessment: 'The company asked for an assessment. Check your messages to complete it.',
    offer: 'Review the offer and accept or decline it from your applications.', hired: 'Congratulations, you got the job. The company will contact you about next steps.',
    closed: 'Keep applying: new jobs are posted every week.', withdrawn: 'You withdrew this application.',
  },
  es: {
    applied: 'La empresa tiene tu postulación.', review: 'La empresa está revisando tu perfil. Por ahora no tienes que hacer nada.',
    interviewing: 'Revisa tus mensajes y entrevistas para ver horarios y detalles.', assessment: 'La empresa te pidió una evaluación. Revisa tus mensajes para completarla.',
    offer: 'Revisa la oferta y acéptala o recházala desde tus postulaciones.', hired: '¡Felicitaciones, conseguiste el empleo! La empresa te contactará con los siguientes pasos.',
    closed: 'Sigue postulándote: cada semana hay vacantes nuevas.', withdrawn: 'Retiraste esta postulación.',
  },
  pt: {
    applied: 'A empresa recebeu sua candidatura.', review: 'A empresa está analisando seu perfil. Nada a fazer por enquanto.',
    interviewing: 'Veja suas mensagens e entrevistas para horários e detalhes.', assessment: 'A empresa pediu uma avaliação. Veja suas mensagens para concluí-la.',
    offer: 'Analise a oferta e aceite ou recuse nas suas candidaturas.', hired: 'Parabéns, você conseguiu a vaga! A empresa entrará em contato com os próximos passos.',
    closed: 'Continue se candidatando: há vagas novas toda semana.', withdrawn: 'Você retirou esta candidatura.',
  },
}

/** "Interviewing — Check your messages…" for a raw pipeline status. */
export function candidateStatusLine(status: string, lang: Lang): string {
  const stage = STAGE_OF[status]
  if (!stage) return status
  const next = NEXT[lang][status === 'assessment_required' ? 'assessment' : stage]
  return `${STAGE[lang][stage]} — ${next}`
}

/** [subject, intro] per type. `{t}` is the notification's subject (a person's
 * name or a job title — the database stores it language-neutral). */
const COPY: Record<Lang, Record<string, [string, string]>> = {
  en: {
    application_received: ['New applicant: {t}', 'Someone applied to one of your jobs.'],
    application_withdrawn: ['{t} withdrew their application', 'A candidate withdrew from one of your jobs.'],
    application_status: ['Update on your application: {t}', 'The status of your application changed.'],
    offer_received: ['You received an offer: {t}', 'Review the offer and reply from your dashboard.'],
    offer_accepted: ['{t} accepted your offer', 'Your offer was accepted.'],
    offer_declined: ['{t} declined your offer', 'Your offer was declined.'],
    interview_scheduled: ['Interview scheduled: {t}', 'An interview was scheduled (or its time changed).'],
    interview_completed: ['Interview completed: {t}', 'Your interview was marked as completed.'],
    interview_cancelled: ['Interview cancelled: {t}', 'Your interview was cancelled.'],
    interview_no_show: ['Interview missed: {t}', 'Your interview was marked as missed. Contact the company if this is wrong.'],
    message_received: ['New message: {t}', 'You have a new message.'],
    company_verified: ['Your company is verified', 'You can now publish jobs on Impulsa Talentos.'],
    payment_granted: ['Payment confirmed', 'We confirmed your payment and added your job credits.'],
    payment_rejected: ['Payment not confirmed', 'We could not confirm your transfer. Reply to this email and we will help.'],
    job_removed: ['Job removed: {t}', 'HQ removed this job from the public listings. Reply to this email if you want to appeal.'],
    job_approved: ['Job approved: {t}', 'HQ approved this job and it is visible again.'],
    job_published: ['Your job is live: {t}', 'Your company was verified, so the job you queued is now public and taking applications.'],
    job_needs_credits: ['Verified: add credits to publish your queued jobs', 'Your company is verified, but some queued jobs are waiting for credits. They go live as soon as credits are added.'],
    team_invite: ['Team invite: {t}', 'You were invited to join a company team.'],
    hq_payment_submitted: ['[HQ] Payment to verify: {t}', 'Check the transfer arrived, then approve it in HQ → Payments.'],
    hq_new_lead: ['[HQ] New lead: {t}', 'A new employer lead is waiting in HQ → Leads.'],
    hq_verification_requested: ['[HQ] Verify company: {t}', 'This employer asked to be verified so they can publish jobs.'],
    hq_job_reported: ['[HQ] Job reported: {t}', 'A user reported this job. Review it in HQ → Pending review.'],
    deletion_requested: ['[HQ] Account deletion requested: {t}', 'Answer within 15 business days (Ley 1581). See HQ → Users.'],
    _hq: ['[HQ] {t}', 'Something is waiting for HQ.'],
    _default: ['{t}', 'You have a new notification.'],
  },
  es: {
    application_received: ['Nuevo postulante: {t}', 'Alguien se postuló a una de tus vacantes.'],
    application_withdrawn: ['{t} retiró su postulación', 'Un candidato retiró su postulación a una de tus vacantes.'],
    application_status: ['Novedades de tu postulación: {t}', 'El estado de tu postulación cambió.'],
    offer_received: ['Recibiste una oferta: {t}', 'Revisa la oferta y responde desde tu panel.'],
    offer_accepted: ['{t} aceptó tu oferta', 'Tu oferta fue aceptada.'],
    offer_declined: ['{t} rechazó tu oferta', 'Tu oferta fue rechazada.'],
    interview_scheduled: ['Entrevista programada: {t}', 'Se programó una entrevista (o cambió su horario).'],
    interview_completed: ['Entrevista completada: {t}', 'Tu entrevista se marcó como completada.'],
    interview_cancelled: ['Entrevista cancelada: {t}', 'Tu entrevista fue cancelada.'],
    interview_no_show: ['Entrevista no asistida: {t}', 'Tu entrevista se marcó como no asistida. Contacta a la empresa si es un error.'],
    message_received: ['Mensaje nuevo: {t}', 'Tienes un mensaje nuevo.'],
    company_verified: ['Tu empresa está verificada', 'Ya puedes publicar vacantes en Impulsa Talentos.'],
    payment_granted: ['Pago confirmado', 'Confirmamos tu pago y agregamos tus créditos de publicación.'],
    payment_rejected: ['Pago no confirmado', 'No pudimos confirmar tu transferencia. Responde este correo y te ayudamos.'],
    job_removed: ['Vacante retirada: {t}', 'HQ retiró esta vacante de las publicaciones. Responde este correo si quieres apelar.'],
    job_approved: ['Vacante aprobada: {t}', 'HQ aprobó esta vacante y vuelve a estar visible.'],
    job_published: ['Tu vacante ya está publicada: {t}', 'Tu empresa fue verificada, así que la vacante que dejaste en espera ya es pública y recibe postulaciones.'],
    job_needs_credits: ['Verificada: agrega créditos para publicar tus vacantes en espera', 'Tu empresa está verificada, pero algunas vacantes en espera necesitan créditos. Se publican apenas los agregues.'],
    team_invite: ['Invitación al equipo: {t}', 'Te invitaron a unirte al equipo de una empresa.'],
    hq_payment_submitted: ['[HQ] Pago por verificar: {t}', 'Verifica que llegó la transferencia y apruébala en HQ → Pagos.'],
    hq_new_lead: ['[HQ] Nuevo prospecto: {t}', 'Hay un nuevo prospecto de empresa en HQ → Prospectos.'],
    hq_verification_requested: ['[HQ] Verificar empresa: {t}', 'Esta empresa pidió verificación para poder publicar vacantes.'],
    hq_job_reported: ['[HQ] Vacante reportada: {t}', 'Un usuario reportó esta vacante. Revísala en HQ → Pendientes.'],
    deletion_requested: ['[HQ] Solicitud de eliminación de cuenta: {t}', 'Responde dentro de 15 días hábiles (Ley 1581). Ver HQ → Usuarios.'],
    _hq: ['[HQ] {t}', 'Hay algo pendiente para HQ.'],
    _default: ['{t}', 'Tienes una notificación nueva.'],
  },
  pt: {
    application_received: ['Novo candidato: {t}', 'Alguém se candidatou a uma das suas vagas.'],
    application_withdrawn: ['{t} retirou a candidatura', 'Um candidato retirou a candidatura a uma das suas vagas.'],
    application_status: ['Atualização da sua candidatura: {t}', 'O status da sua candidatura mudou.'],
    offer_received: ['Você recebeu uma oferta: {t}', 'Revise a oferta e responda pelo seu painel.'],
    offer_accepted: ['{t} aceitou sua oferta', 'Sua oferta foi aceita.'],
    offer_declined: ['{t} recusou sua oferta', 'Sua oferta foi recusada.'],
    interview_scheduled: ['Entrevista agendada: {t}', 'Uma entrevista foi agendada (ou o horário mudou).'],
    interview_completed: ['Entrevista concluída: {t}', 'Sua entrevista foi marcada como concluída.'],
    interview_cancelled: ['Entrevista cancelada: {t}', 'Sua entrevista foi cancelada.'],
    interview_no_show: ['Ausência na entrevista: {t}', 'Sua entrevista foi marcada como ausência. Fale com a empresa se for um erro.'],
    message_received: ['Nova mensagem: {t}', 'Você tem uma nova mensagem.'],
    company_verified: ['Sua empresa foi verificada', 'Agora você pode publicar vagas na Impulsa Talentos.'],
    payment_granted: ['Pagamento confirmado', 'Confirmamos seu pagamento e adicionamos seus créditos.'],
    payment_rejected: ['Pagamento não confirmado', 'Não conseguimos confirmar sua transferência. Responda este e-mail e ajudaremos.'],
    job_removed: ['Vaga removida: {t}', 'O HQ removeu esta vaga das publicações. Responda este e-mail se quiser recorrer.'],
    job_approved: ['Vaga aprovada: {t}', 'O HQ aprovou esta vaga e ela está visível novamente.'],
    job_published: ['Sua vaga está no ar: {t}', 'Sua empresa foi verificada, então a vaga que ficou na fila já está pública e recebendo candidaturas.'],
    job_needs_credits: ['Verificada: adicione créditos para publicar as vagas na fila', 'Sua empresa está verificada, mas algumas vagas na fila precisam de créditos. Elas entram no ar assim que os créditos forem adicionados.'],
    team_invite: ['Convite para a equipe: {t}', 'Você foi convidado para a equipe de uma empresa.'],
    hq_payment_submitted: ['[HQ] Pagamento a verificar: {t}', 'Confira se a transferência chegou e aprove em HQ → Pagamentos.'],
    hq_new_lead: ['[HQ] Novo lead: {t}', 'Há um novo lead de empresa em HQ → Leads.'],
    hq_verification_requested: ['[HQ] Verificar empresa: {t}', 'Esta empresa pediu verificação para publicar vagas.'],
    hq_job_reported: ['[HQ] Vaga denunciada: {t}', 'Um usuário denunciou esta vaga. Revise em HQ → Pendentes.'],
    deletion_requested: ['[HQ] Pedido de exclusão de conta: {t}', 'Responda em até 15 dias úteis (Lei 1581). Veja HQ → Usuários.'],
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
    case 'job_published': return jobId ? `/employer/manage/${jobId}` : '/employer/jobs'
    case 'job_needs_credits': return '/pricing'
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
  const title = (n.title || '').trim().replace(/^—$/, '')
  const subject = subjectTpl.replace('{t}', title).replace(/[:\s]+$/, '').trim().slice(0, 180) || 'Impulsa Talentos'
  // Status changes carry the raw status key as body: candidates get the plain
  // stage plus what happens next.
  const detail = n.type === 'application_status' ? candidateStatusLine(n.body, lang) : (n.body || '')
  const heading = subject
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
