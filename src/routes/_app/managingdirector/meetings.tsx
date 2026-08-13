import { createFileRoute } from '@tanstack/react-router'
import { Meetings } from '@/components/dashboard/md/pages/MdMeetingsPage'
export const Route = createFileRoute('/_app/managingdirector/meetings')({ component: Meetings })
