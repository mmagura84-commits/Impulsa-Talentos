import { createFileRoute } from '@tanstack/react-router'
import { Employers } from '@/components/dashboard/md/pages/MdEmployersPage'
export const Route = createFileRoute('/_app/managingdirector/employers')({ component: Employers })
