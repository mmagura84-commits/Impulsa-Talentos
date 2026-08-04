import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MobileShell } from '@/components/MobileShell'

/**
 * Pathless `/m` layout.
 *
 * The whole `/m/...` route tree lives under this layout, which is
 * the dedicated phone-first app. It only renders the MobileShell
 * (top bar + bottom tab bar + safe-area padding) — no desktop
 * sidebar, no _app pathless layout.
 *
 * Auth is enforced per-route by the page-level wrappers. The shell
 * never redirects.
 */
export const Route = createFileRoute('/m')({
  component: MobileLayout,
})

function MobileLayout() {
  return (
    <MobileShell>
      <Outlet />
    </MobileShell>
  )
}
