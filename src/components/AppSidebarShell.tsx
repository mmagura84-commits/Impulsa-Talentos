/**
 * Impulsa Talentos — Collapsible SaaS sidebar.
 * Expands to 15rem, collapses to 3rem (icon-only). State persisted to localStorage.
 * Integrates with Blink auth for user display and sign-out.
 */
import { useState, useCallback, type ReactNode } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  LayoutDashboard,
  Briefcase,
  User,
  PlusCircle,
  LogOut,
  PanelLeft,
  Shield,
  Heart,
  FileText,
  DollarSign,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { BrandMark } from '@/components/BrandMark'
import { LanguageToggle } from '@/components/LanguageToggle'

const SIDEBAR_KEY = 'sidebar_collapsed'

export interface NavItemDef {
  to: string
  icon: ReactNode
  labelKey: string
  matchPattern?: string
}

/**
 * Role-based navigation — each workspace gets its own menu:
 *   • candidates: dashboard, browse, saved, applications, profile
 *   • employers:  dashboard, postings, post-a-job, profile
 *   • admins:     HQ, jobs, profile
 */
export const CANDIDATE_NAV: NavItemDef[] = [
  { to: '/candidate', icon: <LayoutDashboard className="size-4" />, labelKey: 'common.dashboard' },
  { to: '/jobs', icon: <Briefcase className="size-4" />, labelKey: 'nav.jobs' },
  { to: '/candidate/saved', icon: <Heart className="size-4" />, labelKey: 'nav.savedJobs' },
  { to: '/candidate/applications', icon: <FileText className="size-4" />, labelKey: 'nav.myApplications' },
  { to: '/profile', icon: <User className="size-4" />, labelKey: 'common.profile' },
]

export const EMPLOYER_NAV: NavItemDef[] = [
  { to: '/employer', icon: <LayoutDashboard className="size-4" />, labelKey: 'common.dashboard' },
  { to: '/employer/jobs', icon: <Briefcase className="size-4" />, labelKey: 'nav.myJobs' },
  { to: '/employer/post-job', icon: <PlusCircle className="size-4" />, labelKey: 'postJob.step2.title' },
  { to: '/pricing', icon: <DollarSign className="size-4" />, labelKey: 'nav.pricing' },
  { to: '/profile', icon: <User className="size-4" />, labelKey: 'common.profile' },
]

const ADMIN_NAV: NavItemDef[] = [
  { to: '/hq', icon: <Shield className="size-4" />, labelKey: 'hq.title' },
  { to: '/jobs', icon: <Briefcase className="size-4" />, labelKey: 'nav.jobs' },
  { to: '/profile', icon: <User className="size-4" />, labelKey: 'common.profile' },
]

function NavItem({ item, collapsed, label, accent }: { item: NavItemDef; collapsed: boolean; label: string; accent: 'gold' | 'navy' | 'ink' }) {
  const active = typeof window !== 'undefined' && window.location.pathname === item.to
  const activeClass = accent === 'ink' ? 'bg-white/10 text-white border-l-2 border-amber-400' : accent === 'gold' ? 'bg-amber-500/10 text-amber-700 border-l-2 border-amber-500' : 'bg-primary/10 text-primary border-l-2 border-primary'
  const link = (
    <Link
      to={item.to}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm transition-colors cursor-pointer',
        collapsed ? 'justify-center w-8 h-8 mx-auto' : 'px-3 py-2 w-full',
        accent === 'ink' ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        active && activeClass,
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function AppSidebarShell({ navItems, accent = 'navy' }: { navItems?: NavItemDef[]; accent?: 'gold' | 'navy' | 'ink' }) {
  const { user, logout } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const { t } = useI18n()
  const role = profile?.role ?? 'candidate'
  const items = navItems ?? (role === 'employer' ? EMPLOYER_NAV : role === 'admin' ? ADMIN_NAV : CANDIDATE_NAV)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  })

  const toggle = useCallback(() => {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(SIDEBAR_KEY, String(next))
      return next
    })
  }, [])

  const displayName =
    profile?.fullName?.trim() ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'User'
  const userEmail = user?.email ?? ''
  const avatarUrl = profile?.avatarUrl || undefined
  const avatarInitial = (displayName.charAt(0) ?? 'U').toUpperCase()

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden',
          'transition-[width] duration-200 ease-linear shrink-0',
          collapsed ? 'w-[3rem]' : 'w-[15rem]',
        )}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center gap-2 shrink-0 border-b border-sidebar-border h-[52px] px-3',
            collapsed && 'justify-center px-2',
          )}
        >
          {!collapsed ? (
            <Link to="/" className="flex-1 min-w-0 cursor-pointer">
              <BrandMark withWordmark className="min-w-0" title={t('brand.name')} />
            </Link>
          ) : (
            <Link to="/" className="flex items-center justify-center size-7 cursor-pointer">
              <BrandMark className="size-7 rounded-md" title={t('brand.name')} />
            </Link>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={toggle}
              >
                <PanelLeft
                  className={cn(
                    'size-4 transition-transform duration-200',
                    collapsed && 'rotate-180',
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Nav ───────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
          {items.map(item => (
            <NavItem
              key={item.to}
              item={item}
              collapsed={collapsed}
              label={t(item.labelKey)}
              accent={accent}
            />
          ))}

          {/* Role badge — shows which workspace you're in */}
          {!collapsed && (
            <div className="px-2 pt-3">
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2.5 py-1">
                {role === 'employer' ? t('nav.roleEmployer') : role === 'admin' ? t('nav.roleAdmin') : t('nav.roleCandidate')}
              </span>
            </div>
          )}

          {/* Language switcher (collapsed: icon; expanded: full list) */}
          <div className={cn('mt-3 pt-3 border-t border-sidebar-border', collapsed ? 'px-1' : 'px-2')}>
            {collapsed ? (
              <div className="flex justify-center">
                <LanguageToggle compact />
              </div>
            ) : (
              <LanguageToggle asList />
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────── */}
        <div
          className={cn(
            'shrink-0 border-t border-sidebar-border',
            collapsed ? 'flex flex-col items-center gap-1 p-2' : 'p-3 space-y-1',
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent transition-colors cursor-pointer">
                  <Avatar className="h-6 w-6 shrink-0">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                    <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                      {avatarInitial}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {displayName} · {userEmail}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
              <Avatar className="h-6 w-6 shrink-0">
                {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                  {avatarInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium leading-tight truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={logout}
                >
                  <LogOut className="size-4 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('common.signOut')}</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 gap-2 text-muted-foreground hover:text-foreground"
              onClick={logout}
            >
              <LogOut className="size-4 shrink-0" />
              {t('common.signOut')}
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
