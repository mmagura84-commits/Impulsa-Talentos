import { createFileRoute } from '@tanstack/react-router'
import { MdLayout } from '@/components/dashboard/md/MdLayout'

/**
 * /managingdirector alias for the MD lane — mounts the SAME shared MdLayout
 * as /md (same role gate, same AuthGate fallback via the page components,
 * same loading state). Never drifts from /md because both routes render the
 * same layout + page components.
 */
export const Route = createFileRoute('/_app/managingdirector')({
  component: MdLayout,
})
