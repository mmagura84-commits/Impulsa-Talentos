import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'

/**
 * Pathless employer layout — role-gates every /employer/* page.
 * Redirects non-employers to /dashboard before any child content renders.
 */
export const Route = createFileRoute('/_app/employer')({
  component: EmployerLayout,
})

function EmployerLayout() {
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile(user?.id)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && profile && profile.role !== 'employer') {
      navigate({ to: '/dashboard', replace: true })
    }
  }, [isLoading, profile, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  return <Outlet />
}
