/**
 * Candidate workspace sidebar — job seekers only.
 * Nav: Browse Jobs, Profile, Saved Jobs. No employer tools.
 */
import { AppSidebarShell, CANDIDATE_NAV } from '@/components/AppSidebarShell'

export function CandidateSidebar() {
  return <AppSidebarShell navItems={CANDIDATE_NAV} />
}
