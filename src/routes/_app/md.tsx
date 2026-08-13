import { createFileRoute } from '@tanstack/react-router'
import { MdLayout } from '@/components/dashboard/md/MdLayout'

/**
 * MD lane layout — role-gates every /md/* page.
 * Shared MdLayout also backs /managingdirector (alias) so the two never drift.
 */
export const Route = createFileRoute('/_app/md')({
  component: MdLayout,
})
