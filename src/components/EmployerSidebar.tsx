/**
 * Employer workspace sidebar — hiring managers only.
 * Nav: Dashboard, My Job Postings, Post a Job, Applications, Pricing, Profile.
 * No candidate or admin tools.
 */
import { AppSidebarShell } from '@/components/AppSidebarShell'
import { NotificationCenter } from '@/components/dashboard/NotificationCenter'

export function EmployerSidebar() {
  return <AppSidebarShell accent="navy" headerActions={<NotificationCenter />} />
}
