import { createFileRoute } from '@tanstack/react-router'
import { Messages } from '@/components/dashboard/md/pages/MdMessagesPage'
export const Route = createFileRoute('/_app/managingdirector/messages')({ component: Messages })
