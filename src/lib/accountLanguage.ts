import type { Locale } from '@/i18n/translations'

/**
 * Save a language the person explicitly picked to their account, so emails
 * (sent by the database, not the browser) arrive in that language.
 *
 * - auth metadata `locale`: covers people whose profile row doesn't exist yet;
 *   migration 042 copies it onto the profile when the profile is created.
 * - profiles.preferred_language: what the email function reads.
 *
 * Signed-out visitors: nothing to save. Failures are silent — the site
 * language itself already changed, and the next switch retries.
 */
export async function saveLanguageToAccount(locale: Locale): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase.auth.getSession()
    const user = data.session?.user
    if (!user) return
    if (user.user_metadata?.locale !== locale) {
      await supabase.auth.updateUser({ data: { locale } })
    }
    await supabase.from('profiles').update({ preferred_language: locale }).eq('user_id', user.id)
  } catch {
    /* best effort */
  }
}
