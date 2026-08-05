import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import type { Lead } from '@/types'

export const Route = createFileRoute('/_app/hq/leads')({ component: LeadsPage })
function LeadsPage() {
 const { t } = useI18n(); const { user } = useAuth(); const { data: profile } = useProfile(user?.id); const [leads,setLeads]=useState<Lead[]>([]); const [filter,setFilter]=useState('all')
 useEffect(()=>{ if(profile?.role !== 'admin') return; supabase.from('leads').select('*').order('created_at',{ascending:false}).then(({data})=>setLeads((data??[]) as Lead[])) },[profile?.role])
 const shown=filter==='all'?leads:leads.filter(l=>l.status===filter)
 return <AuthGate fallbackKey="auth.fallback.profile"><main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">{t('hq.leadsTitle')}</h1>{profile?.role !== 'admin' ? <p className="mt-4 text-muted-foreground">{t('hq.leadsAdminOnly')}</p> : <><select value={filter} onChange={e=>setFilter(e.target.value)} className="my-6 h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All</option><option value="new">New</option><option value="contacted">Contacted</option><option value="converted">Converted</option><option value="closed">Closed</option></select><div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted/50"><tr>{['email','phone','name','company','source','status','created_at'].map(x=><th key={x} className="px-4 py-3 font-semibold">{x}</th>)}</tr></thead><tbody>{shown.map(l=><tr key={l.id} className="border-t"><td className="px-4 py-3">{l.email}</td><td className="px-4 py-3">{l.phone||'—'}</td><td className="px-4 py-3">{l.name||'—'}</td><td className="px-4 py-3">{l.company||'—'}</td><td className="px-4 py-3">{l.source}</td><td className="px-4 py-3">{l.status}</td><td className="px-4 py-3">{new Date(l.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></>}</main></AuthGate>
}
