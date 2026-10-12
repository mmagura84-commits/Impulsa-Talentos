import { createFileRoute, redirect } from '@tanstack/react-router'

/** The old phone app's home (/m) forwards to the home page. */
export const Route = createFileRoute('/m/')({
  beforeLoad: () => {
    throw redirect({ to: '/', replace: true })
  },
})
