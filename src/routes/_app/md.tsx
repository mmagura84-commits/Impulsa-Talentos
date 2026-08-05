import { createFileRoute } from '@tanstack/react-router'
import { Route as MdIndexRoute } from './md/index'
export const Route = createFileRoute('/_app/md')({ component: () => <MdIndexRoute.component /> })
