import { AuthGate } from '@/components/AuthGate'
import { PaymentsTab } from '@/components/hq/PaymentsTab'

/** Read-only payments view for the Managing Director (confirmation stays with the owner). */
export function Payments() {
  return (
    <AuthGate fallbackKey="auth.fallback.dashboard">
      <div className="mx-auto max-w-6xl p-4 sm:p-6"><PaymentsTab readOnly /></div>
    </AuthGate>
  )
}
