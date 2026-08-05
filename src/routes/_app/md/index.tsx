import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth, useIsMd } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LayoutDashboard, Users, Megaphone, MessageSquare, Landmark } from 'lucide-react'
export const Route = createFileRoute('/_app/md/')({ component: MdDashboard })
function MdDashboard() {
 const { t } = useI18n(); const { user } = useAuth(); const { data: profile, isLoading } = useProfile(user?.id); const isMd = useIsMd(); const navigate = useNavigate()
 useEffect(()=>{ if(!isLoading && (!isMd || (profile?.profileStatus === 'pending'))) return; if(!isLoading && !isMd) navigate({to:'/dashboard',replace:true}) },[isLoading,isMd,profile?.profileStatus,navigate])
 const nav=[['/md',LayoutDashboard,'md.nav.dashboard'],['/md/marketing',Megaphone,'md.nav.marketing'],['/md/messages',MessageSquare,'md.nav.messages'],['/md/banking',Landmark,'md.nav.banking']]
 return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">{t('md.title')}</h1>{profile?.profileStatus==='pending' ? <Card className="mt-8 border-amber-500/30"><CardHeader><CardTitle>{t('md.pendingTitle')}</CardTitle></CardHeader><CardContent className="text-muted-foreground">{t('md.pendingDesc')}</CardContent></Card> : <><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{nav.map(([to,Icon,key])=><Link key={String(to)} to={to as any} className="rounded-xl border bg-card p-5 hover:border-primary"><Icon className="size-5 text-primary"/><p className="mt-3 font-medium">{t(String(key))}</p></Link>)}</div><Card className="mt-6"><CardContent className="p-6">{t('md.welcome')}</CardContent></Card></>}</main></AuthGate>
}
