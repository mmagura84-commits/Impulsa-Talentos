import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

/**
 * Pathless MD layout — role-gates every /md/* page.
 * Redirects non-MD users to /dashboard before any child content renders.
 */
export const Route = createFileRoute('/_app/md')({
  component: MdLayout,
})

function MdLayout() {
  const { user, isLoading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const isMd = useIsMd()
  const navigate = useNavigate()

  useEffect(() => {
    // Wait for both auth and profile to settle before deciding.
    if (authLoading || profileLoading) return
    if (!isMd) {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [authLoading, profileLoading, isMd, navigate])

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return <Outlet />
}
