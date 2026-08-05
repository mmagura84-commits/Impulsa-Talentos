import { AppSidebarShell, type NavItemDef } from '@/components/AppSidebarShell'
import { LayoutDashboard, Megaphone, MessageSquare, Landmark, Users, CalendarClock, User } from 'lucide-react'
const MD_NAV: NavItemDef[] = [
  { to: '/md', icon: <LayoutDashboard className="size-4" />, labelKey: 'md.nav.dashboard' },
  { to: '/md/marketing', icon: <Megaphone className="size-4" />, labelKey: 'md.nav.marketing' },
  { to: '/md/messages', icon: <MessageSquare className="size-4" />, labelKey: 'md.nav.messages' },
  { to: '/md/banking', icon: <Landmark className="size-4" />, labelKey: 'md.nav.banking' },
  { to: '/md/employers', icon: <Users className="size-4" />, labelKey: 'md.nav.employers' },
  { to: '/md/meetings', icon: <CalendarClock className="size-4" />, labelKey: 'md.nav.meetings' },
  { to: '/md/profile', icon: <User className="size-4" />, labelKey: 'md.nav.profile' },
]
export function MdSidebar() { return <AppSidebarShell navItems={MD_NAV} /> }
