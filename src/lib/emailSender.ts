/**
 * Email sending — fire-and-forget POST to the same-origin `/api/email`
 * proxy (serve.ts), which forwards to the configured EMAIL_API_URL with
 * EMAIL_API_KEY. When no provider is configured the proxy logs and skips,
 * so email failures never block the product flows that trigger them.
 */
export interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Email API error ${res.status}`)
  }
}
