/**
 * Shell — Mobile-responsive app layout (shadcn/ui based).
 *
 * USAGE (in a route or SharedAppLayout):
 *   <Shell sidebar={<MySidebarContent />}>
 *     <Page>...</Page>
 *   </Shell>
 *
 * Desktop (md+): the sidebar is a fixed column on the left, main content fills
 * the rest. Mobile: the sidebar is hidden and opens in a Sheet drawer via the
 * hamburger button in the mobile header. Customize freely — this is your code.
 */
import { BrandMark } from '@/components/BrandMark'
import { useEffect, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useI18n } from '@/i18n/I18nProvider'

interface ShellProps {
  /** Sidebar content — e.g. <AppSidebarShell /> or your own nav */
  sidebar: ReactNode
  /** App name shown in the mobile header */
  appName?: string
  /** Phone-only bottom navigation (e.g. <MobileTabBar />). */
  bottomBar?: ReactNode
  /** Phone-only actions at the right of the top bar (e.g. notifications). */
  mobileActions?: ReactNode
  children: ReactNode
}

export function Shell({ sidebar, appName = 'App', bottomBar, mobileActions, children }: ShellProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  // Close the phone menu after navigating, so the new page isn't hidden under it.
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm">{t('common.skipToContent')}</a>
      {/* Desktop sidebar — hidden on mobile, always visible on md+.
          AppSidebarShell owns its own width and collapse animation. */}
      <aside className="hidden md:block shrink-0">{sidebar}</aside>

      {/* Mobile sidebar — Sheet drawer opened by the hamburger below. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main content column */}
      {/* [&>*]:w-full — page wrappers use `mx-auto`, which in a flex column
          sizes them to their content; pin them to the column so phones never
          get a page wider than the screen. */}
      <main id="main" className="flex flex-1 min-w-0 flex-col [&>*]:w-full">
        {/* Mobile header — hamburger + app name, only shown below md. */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-border bg-background sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <BrandMark withWordmark className="h-7" title={appName} />
          {mobileActions && <div className="ml-auto flex items-center">{mobileActions}</div>}
        </div>

        {children}
      </main>
      {bottomBar}
    </div>
  )
}
