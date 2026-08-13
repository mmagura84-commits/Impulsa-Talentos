import { createFileRoute } from '@tanstack/react-router'
import { Banking } from '@/components/dashboard/md/pages/MdBankingPage'
export const Route = createFileRoute('/_app/managingdirector/banking')({ component: Banking })
