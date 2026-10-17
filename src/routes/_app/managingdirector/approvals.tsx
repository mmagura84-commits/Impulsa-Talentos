import { createFileRoute } from '@tanstack/react-router'
import { Approvals } from '@/components/dashboard/md/pages/MdApprovalsPage'
export const Route = createFileRoute('/_app/managingdirector/approvals')({ component: Approvals })
