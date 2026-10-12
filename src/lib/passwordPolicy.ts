/**
 * Password rule for NEW passwords (sign-up, reset). Mirrors the Supabase Auth
 * setting on the live project: at least 12 characters with letters and digits.
 * Length is what NIST SP 800-63B / OWASP ASVS weigh most; the letter+digit rule
 * stands in for the breached-password check, which needs Supabase Pro.
 * Never applied to sign-in: older accounts may have shorter passwords.
 */
export const PASSWORD_MIN_LENGTH = 12

/** Returns an i18n key describing what is missing, or null when it passes. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'auth.passwordTooShort'
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return 'auth.passwordNeedsMix'
  return null
}
