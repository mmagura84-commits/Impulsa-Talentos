/**
 * Employer workspace sidebar — hiring managers only.
 * Nav: Dashboard, My Job Postings, Post a Job, Pricing (+ HQ for admins).
 * No candidate tools (saved jobs, applications).
 */
import { AppSidebarShell, EMPLOYER_NAV, type NavItemDef } from '@/components/AppSidebarShell'
import { useIsAdmin } from '@/hooks/useAuth'
import { Shield } from 'lucide-react'

export function EmployerSidebar() {
  const isAdmin = useIsAdmin()
  const items: NavItemDef[] = isAdmin
    ? [...EMPLOYER_NAV, { to: '/hq', icon: <Shield className="size-4" />, labelKey: 'hq.title' }]
    : EMPLOYER_NAV
  return <AppSidebarShell navItems={items} accent="navy" />
}
