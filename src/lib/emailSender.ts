import { sendEmailServer } from './emailSenderFn'
import type { EmailPayload } from './emailSenderFn'
import { supabase } from './supabase'

export type { EmailPayload } from './emailSenderFn'

/**
 * Client-safe wrapper; the API call and credential stay in the server function.
 * Resolves to true only when the email was actually handed to the provider, so
 * screens never claim "email sent" when it was not.
 */
export async function sendEmail(payload: Omit<EmailPayload, 'accessToken'>): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  const res = await sendEmailServer({ data: { ...payload, accessToken: data.session?.access_token ?? null } })
  return !!(res && (res as { sent?: boolean }).sent)
}
