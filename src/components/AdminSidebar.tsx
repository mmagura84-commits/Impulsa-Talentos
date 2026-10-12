import { NotificationCenter } from '@/components/dashboard/NotificationCenter'
import { AppSidebarShell } from '@/components/AppSidebarShell'

/** Platform-admin workspace shell; intentionally separate from employer hiring lane. */
export function AdminSidebar() {
  return <AppSidebarShell accent="ink" headerActions={<NotificationCenter audience="admin" />} />
}
