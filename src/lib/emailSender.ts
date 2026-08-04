/**
 * Email sending — calls Resend API directly (works on static hosting).
 * Key is baked at build time via VITE_RESEND_API_KEY.
 * Resend API: https://resend.com/docs/api-reference/emails/send-email
 */
export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'Impulsa Talentos <info@impulsatalentos.expert>'

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const key = import.meta.env.VITE_RESEND_API_KEY
  if (!key) {
    console.warn('[emailSender] No VITE_RESEND_API_KEY set — email not sent')
    return
  }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend API error ${res.status}: ${body}`)
  }
}
