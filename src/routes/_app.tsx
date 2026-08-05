import { createFileRoute, Outlet, useMatchRoute } from '@tanstack/react-router'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { SharedAppLayout } from '@/layouts/shared-app-layout'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { CandidateSidebar } from '@/components/CandidateSidebar'
import { EmployerSidebar } from '@/components/EmployerSidebar'
import { MdSidebar } from '@/components/MdSidebar'
import { PublicHeader } from '@/components/PublicHeader'

/**
 * Pathless `_app` layout.
 *
 * Two responsibilities:
 *   1. Wrap the app chrome (sidebar + main) around inner pages.
 *   2. Hide the chrome on the public job board so an unauthenticated
 *      visitor can browse `/jobs` and `/jobs/$id` without seeing a
 *      dashboard sidebar that doesn't apply to them.
 *
 * Auth is enforced PER-ROUTE by the page-level `AuthGate` wrappers
 * — this layout never redirects. Each child route opts in to its
 * own auth requirement (jobs + jobs.$id are public, everything
 * else requires sign-in).
 */
function AppLayout() {
  const matchRoute = useMatchRoute()
  const { user, isLoading: authLoading } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  // Check if the currently matched route is one of the public ones.
  // We check by full path (the public URLs) so we don't have to
  // know the internal route id at the call site. Only unauthenticated
  // visitors get the bare job board — signed-in users keep their
  // workspace sidebar so they never lose navigation.
  const isPublicRoute =
    !user && (!!matchRoute({ to: '/jobs' }) || !!matchRoute({ to: '/jobs/$id' }))

  if (isPublicRoute) {
    // Public job board renders directly (no ClientOnly boundary): the jobs
    // page and job detail page are SSR-safe (all browser APIs are guarded), so
    // crawlers and direct visits get the REAL server-rendered content instead
    // of a spinner fallback.
    return <><PublicHeader transparentOnTop={false} /><Outlet /></>
  }

  // BlinkClientBoundary is ALWAYS rendered so SSR produces a consistent
  // ClientOnly boundary that hydrates correctly. The loading guard AND
  // workspace chrome live INSIDE the boundary so the sidebar is never
  // chosen before auth/profile resolve, preventing a flash of the wrong
  // navigation (e.g. MD session seeing candidate sidebar).
  const isLoading = authLoading || (user && profileLoading)
  const role = profile?.role
  const sidebar = role === 'md' ? <MdSidebar /> : role === 'employer' || role === 'admin' ? <EmployerSidebar /> : <CandidateSidebar />

  return (
    <BlinkClientBoundary
      fallback={
        <div className="flex items-center justify-center min-h-dvh">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center min-h-dvh">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <SharedAppLayout appName="Impulsa Talentos" sidebar={sidebar}>
          <Outlet />
        </SharedAppLayout>
      )}
    </BlinkClientBoundary>
  )
}

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})
