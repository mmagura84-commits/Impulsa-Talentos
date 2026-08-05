import { createServerFn } from '@tanstack/react-start'

export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'Impulsa Talentos <partners@impulsatalentos.expert>'

/** Sends email from the server so the Resend credential never enters client code. */
export const sendEmailServer = createServerFn({ method: 'POST' })
  .handler(async ({ data }: { data: EmailPayload }) => {
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
