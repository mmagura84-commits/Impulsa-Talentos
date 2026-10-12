import { createFileRoute, redirect } from '@tanstack/react-router'
import { desktopPathFor } from '@/lib/legacyMobilePaths'

/** Old phone-app links (/m/...) forward to the matching page. */
export const Route = createFileRoute('/m/$')({
  beforeLoad: ({ location }) => {
    throw redirect({ href: desktopPathFor(location.pathname) + (location.searchStr ?? ''), replace: true })
  },
})
