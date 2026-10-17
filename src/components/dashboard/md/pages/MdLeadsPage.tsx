import { AuthGate } from '@/components/AuthGate'
import { LeadsTab } from '@/components/hq/LeadsTab'

/** Leads CRM for the Managing Director: every inbound lead, status pipeline and notes. */
export function Leads() {
  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <div className="mx-auto max-w-6xl p-4 sm:p-6"><LeadsTab /></div>
    </AuthGate>
  )
}
