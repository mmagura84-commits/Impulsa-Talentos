import { createServerFn } from '@tanstack/react-start'
import { authorizeEmail } from './server/emailGuard'

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  /** Caller's Supabase access token; required for non-HQ recipients. */
  accessToken?: string | null
}

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'Impulsa Talentos <partners@impulsatalentos.expert>'

/** Sends email from the server so the Resend credential never enters client code. */
export const sendEmailServer = createServerFn({ method: 'POST' })
  .inputValidator((d: EmailPayload) => d)
  .handler(async ({ data }) => {
    await authorizeEmail(data, data.accessToken)
    const key = process.env.RESEND_API_KEY
    if (!key) {
      console.warn('[emailSender] No RESEND_API_KEY set — email not sent')
      return { sent: false as const }
    }
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [data.to], subject: data.subject, html: data.html, text: data.text }),
    })
    if (!res.ok) throw new Error(`Resend API error ${res.status}: ${await res.text()}`)
    return { sent: true as const }
  })
