/**
 * Employer workspace sidebar — hiring managers only.
 * Nav: Dashboard, My Job Postings, Post a Job, Applications, Pricing, Profile.
 * No candidate or admin tools.
 */
import { AppSidebarShell } from '@/components/AppSidebarShell'

export function EmployerSidebar() {
  return <AppSidebarShell accent="navy" />
}
