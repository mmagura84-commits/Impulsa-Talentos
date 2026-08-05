import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Megaphone, MessageSquare, Landmark, Users, CalendarDays, UserCircle } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
const items=[['/md',LayoutDashboard,'md.nav.dashboard'],['/md/marketing',Megaphone,'md.nav.marketing'],['/md/messages',MessageSquare,'md.nav.messages'],['/md/banking',Landmark,'md.nav.banking'],['/md/employers',Users,'md.nav.employers'],['/md/meetings',CalendarDays,'md.nav.meetings'],['/md/profile',UserCircle,'md.nav.profile']] as const
export function MdNav(){const {t}=useI18n();return <nav aria-label={t('md.nav.label')} className="mb-6 flex gap-2 overflow-x-auto border-b pb-3">{items.map(([to,Icon,key])=><Link key={to} to={to as any} activeProps={{className:'bg-primary text-primary-foreground'}} className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"><Icon className="size-4"/>{t(key)}</Link>)}</nav>}
