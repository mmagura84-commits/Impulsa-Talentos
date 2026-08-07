import { createFileRoute, Navigate } from '@tanstack/react-router'

/**
 * Backwards-compatible alias for clients that still request `/applications`.
 * Applications are private and are rendered through the role-aware candidate
 * or employer routes after authentication; never query them on this public
 * entry point.
 */
export const Route = createFileRoute('/applications')({ component: ApplicationsAlias })

function ApplicationsAlias() {
  // Keep legacy application links in the candidate lane. This lets the
  // candidate layout render its dedicated bilingual AuthGate instead of the
  // generic role chooser (which can send first-time visitors to employers).
  return <Navigate to="/candidate/applications" replace />
}
