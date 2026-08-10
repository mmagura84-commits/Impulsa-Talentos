import { createFileRoute } from '@tanstack/react-router'
import { AuthGate } from '@/components/AuthGate'

/** Dedicated candidate account creation entry point. Role gating remains in the
 * candidate layout; unauthenticated visitors stay in the candidate lane rather
 * than being redirected to employer onboarding. */
export const Route = createFileRoute('/_app/candidate/create-account')({
  component: CandidateCreateAccount,
})

function CandidateCreateAccount() {
  return (
    <AuthGate
      initialMode="signUp"
      fallbackKey="auth.signUpTitle"
      fallbackDescKey="auth.signUpDescription"
    >
      <div />
    </AuthGate>
  )
}
