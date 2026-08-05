import { sendEmailServer } from './emailSenderFn'
import type { EmailPayload } from './emailSenderFn'

export type { EmailPayload } from './emailSenderFn'

/** Client-safe wrapper; the API call and credential stay in the server function. */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  await sendEmailServer({ data: payload })
}
