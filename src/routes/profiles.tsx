import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Backwards-compatible alias for clients that still request `/profiles`.
 * Keep this as an in-app redirect rather than attempting a public database
 * query: profile data is private and must only be loaded by the auth-gated
 * `/profile` route.
 */
export const Route = createFileRoute('/profiles')({ component: ProfilesAlias })

function ProfilesAlias() {
  return <Navigate to="/profile" replace />
}
