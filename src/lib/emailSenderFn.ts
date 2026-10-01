import { createServerFn } from '@tanstack/react-start'
export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}
const RESEND_API = 'https://api.resend.com/emails'
/** From-address. Overridable via SENDER_EMAIL (server env) — otherwise a
 *  sensible default. Never a client (VITE_) var: server-only. */
const FROM = process.env.SENDER_EMAIL ?? 'Impulsa Talentos <notifications@impulsatalentos.expert>'
/** Sends email from the server so the Resend credential never enters client code. */
export const sendEmailServer = createServerFn({ method: 'POST' })
  .inputValidator((d: EmailPayload) => d)
  .handler(async ({ data }) => {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      console.warn('[emailSender] No RESEND_API_KEY set — email not sent')
      return
    }
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [data.to], subject: data.subject, html: data.html, text: data.text }),
    })
    if (!res.ok) throw new Error(`Resend API error ${res.status}: ${await res.text()}`)
  })
