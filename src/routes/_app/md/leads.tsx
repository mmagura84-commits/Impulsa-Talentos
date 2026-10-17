import { createFileRoute } from '@tanstack/react-router'
import { Leads } from '@/components/dashboard/md/pages/MdLeadsPage'
export const Route = createFileRoute('/_app/md/leads')({ component: Leads })
