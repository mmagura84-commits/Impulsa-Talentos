import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Backwards-compatible alias for clients that still request `/applications`.
 * Applications are private and are rendered through the role-aware candidate
 * or employer routes after authentication; never query them on this public
 * entry point.
 */
export const Route = createFileRoute('/applications')({ component: ApplicationsAlias })

function ApplicationsAlias() {
  return <Navigate to="/dashboard" replace />
}
