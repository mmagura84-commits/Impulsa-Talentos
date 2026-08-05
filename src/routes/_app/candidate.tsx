import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useLayoutEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

/**
 * Pathless candidate layout — role-gates every /candidate/* page.
 * Redirects non-candidates to /dashboard before any child content renders.
 */
export const Route = createFileRoute('/_app/candidate')({
  component: CandidateLayout,
})

function CandidateLayout() {
  const { user, isLoading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const navigate = useNavigate()

  useLayoutEffect(() => {
    // Wait for both auth and profile to settle before deciding.
    if (authLoading || profileLoading) return
    if (profile && profile.role !== 'candidate') {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [authLoading, profileLoading, profile, navigate])

  if (authLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return <Outlet />
}
