/**
 * Intent preservation for onboarding routing.
 *
 * When a user clicks an employer CTA and lands on /dashboard without a profile,
 * we need to remember they intended to be an employer so we don't default them
 * into the candidate workspace.
 *
 * Uses sessionStorage so the intent survives the auth redirect flow but is
 * cleared when the browser tab closes — it won't persist across sessions.
 */

const INTENT_KEY = 'impulsa_onboarding_intent'

export type OnboardingIntent = 'candidate' | 'employer'

export function setOnboardingIntent(intent: OnboardingIntent): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(INTENT_KEY, intent)
  } catch {
    // sessionStorage unavailable (private browsing, quota, etc.) — silently ignore
  }
}

export function getOnboardingIntent(): OnboardingIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const value = sessionStorage.getItem(INTENT_KEY)
    if (value === 'candidate' || value === 'employer') return value
  } catch {
    // sessionStorage unavailable
  }
  return null
}

export function clearOnboardingIntent(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(INTENT_KEY)
  } catch {
    // sessionStorage unavailable
  }
}
