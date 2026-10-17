import { createFileRoute } from '@tanstack/react-router'
import { Payments } from '@/components/dashboard/md/pages/MdPaymentsPage'
export const Route = createFileRoute('/_app/md/payments')({ component: Payments })
