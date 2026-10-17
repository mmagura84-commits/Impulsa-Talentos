import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, type ComponentType } from 'react'
import {
  LayoutDashboard, Briefcase, FileText, User, PlusCircle, Inbox, Shield, Users, CalendarClock, MessageSquare,
} from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'

type Tab = { to: string; icon: ComponentType<{ className?: string }>; labelKey: string; exact?: boolean }

/** The four places each role goes most, one thumb-tap away on a phone. */
const TABS: Record<string, Tab[]> = {
  candidate: [
    { to: '/candidate', icon: LayoutDashboard, labelKey: 'tabs.home', exact: true },
    { to: '/jobs', icon: Briefcase, labelKey: 'tabs.jobs' },
    { to: '/candidate/applications', icon: FileText, labelKey: 'tabs.applications' },
    { to: '/profile', icon: User, labelKey: 'tabs.profile' },
  ],
  employer: [
    { to: '/employer', icon: LayoutDashboard, labelKey: 'tabs.home', exact: true },
    { to: '/employer/jobs', icon: Briefcase, labelKey: 'tabs.myJobs' },
    { to: '/employer/post-job', icon: PlusCircle, labelKey: 'tabs.post' },
    { to: '/employer/applications', icon: Inbox, labelKey: 'tabs.applicants' },
  ],
  admin: [
    { to: '/hq', icon: Shield, labelKey: 'tabs.hq', exact: true },
    { to: '/hq/leads', icon: Users, labelKey: 'tabs.leads' },
    { to: '/jobs', icon: Briefcase, labelKey: 'tabs.jobs' },
    { to: '/profile', icon: User, labelKey: 'tabs.profile' },
  ],
  md: [
    { to: '/md', icon: LayoutDashboard, labelKey: 'tabs.home', exact: true },
    { to: '/md/employers', icon: Users, labelKey: 'tabs.employers' },
    { to: '/md/meetings', icon: CalendarClock, labelKey: 'tabs.meetings' },
    { to: '/md/messages', icon: MessageSquare, labelKey: 'tabs.messages' },
  ],
}

/**
 * Bottom tab bar for phones (hidden from md up, where the sidebar shows).
 * This replaces the separate /m phone app: one set of pages, two layouts.
 */
export function MobileTabBar({ role }: { role: string | undefined }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const tabs = TABS[role ?? 'candidate'] ?? TABS.candidate
  // Reserve room at the bottom of the page (incl. the footer) on phones.
  useEffect(() => {
    document.body.classList.add('has-tabbar')
    return () => document.body.classList.remove('has-tabbar')
  }, [])
  return (
    <nav
      aria-label={t('tabs.label')}
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, icon: Icon, labelKey, exact }) => {
          const active = exact ? pathname === to || pathname === `${to}/` : pathname === to || pathname.startsWith(`${to}/`)
          return (
            <li key={to}>
              <Link
                to={to as never}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs sm:text-[11px] font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Icon className="size-5" />
                <span className="max-w-full truncate">{t(labelKey)}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
