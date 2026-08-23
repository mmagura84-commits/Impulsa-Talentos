import { Outlet } from '@tanstack/react-router'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { AuthGate } from '@/components/AuthGate'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandMark } from '@/components/BrandMark'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ShieldAlert } from 'lucide-react'

/**
 * Pathless MD layout — role-gates every MD page.
 *
 * OWNER-DRIVEN behavior: an unauthenticated visitor hitting /md (or the
 * /managingdirector alias) sees an MD-branded, sign-in-ONLY gate RIGHT HERE —
 * never the generic /dashboard employer/candidate chooser. A signed-in but
 * non-MD user sees an "MD access only" notice (no MD content is leaked).
 * Only role='md' users get the Outlet.
 *
 * The role gate is NOT weakened: MD content remains reachable only by
 * role='md'. Both routes mount this same shared component, so /md and the
 * /managingdirector alias can never drift.
 */
export function MdLayout() {
  const { user, isLoading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const isMd = useIsMd()
  const { t } = useI18n()

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return (
    <AuthGate
      signUpDisabled
      fallbackMessage={t('md.loginTitle')}
      fallbackDescription={t('md.loginDesc')}
    >
      {isMd ? <Outlet /> : <MdAccessOnly />}
    </AuthGate>
  )
}

/** Signed-in but not role='md' — refuse with a clear notice, leak nothing. */
function MdAccessOnly() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4 py-10 bg-gradient-to-br from-background via-muted/30 to-primary/5">
      <Card className="max-w-md w-full text-center border-border/70 shadow-2xl shadow-primary/10 rounded-2xl overflow-hidden">
        <CardHeader className="pb-5 bg-gradient-to-b from-primary/10 to-transparent">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <BrandMark className="size-14 rounded-2xl shadow-lg" title={t('brand.name')} />
          </div>
          <CardTitle className="font-serif text-xl">{t('md.accessDeniedTitle')}</CardTitle>
          <CardDescription>{t('md.accessDeniedDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center text-muted-foreground">
            <ShieldAlert className="size-6 text-destructive" aria-hidden="true" />
          </div>
          <div className="flex justify-center pt-1">
            <LanguageToggle compact />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
