import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'

export const Route = createFileRoute('/_app/dashboard')({
  component: DashboardRedirect,
})

/**
 * /dashboard is now a role-based entry point that sends each user to
 * their own workspace:
 *   • candidates → /candidate   (job search, saved jobs, applications)
 *   • employers  → /employer    (job postings, applicants, analytics)
 *   • admins     → /hq          (platform moderation & overview)
 */
function DashboardRedirect() {
  const { user, isLoading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const { t } = useI18n()
  const navigate = useNavigate()

  // Wait for BOTH auth and profile to resolve before redirecting.
  // Without the authLoading gate, the effect fires when useProfile is
  // disabled (user === undefined, isLoading === false) and defaults
  // to /candidate — causing a bounce for non-candidate users:
  //   /dashboard → /candidate → /dashboard → /employer.
  useEffect(() => {
    if (authLoading || profileLoading) return
    const role = profile?.role ?? 'candidate'
    const target =
      role === 'admin' ? '/hq'
      : role === 'md' ? '/md'
      : role === 'employer' ? '/employer'
      : '/candidate'
    navigate({ to: target, replace: true })
  }, [authLoading, profileLoading, profile?.role, navigate])

  return (
    <AuthGate fallbackKey="auth.fallback.dashboard" fallbackDescKey="auth.fallback.dashboardDesc">
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <div className="mx-auto animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    </AuthGate>
  )
}
