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
 const cols: Array<{key:string;labelKey:string}> = [
  { key:'email', labelKey:'hq.leads.colEmail' },
  { key:'phone', labelKey:'hq.leads.colPhone' },
  { key:'name', labelKey:'hq.leads.colName' },
  { key:'company', labelKey:'hq.leads.colCompany' },
  { key:'source', labelKey:'hq.leads.colSource' },
  { key:'status', labelKey:'hq.leads.colStatus' },
  { key:'created_at', labelKey:'hq.leads.colCreated' },
 ]
 const filterOpts: Array<{value:string;labelKey:string}> = [
  { value:'all', labelKey:'hq.leads.all' },
  { value:'new', labelKey:'hq.leads.new' },
  { value:'contacted', labelKey:'hq.leads.contacted' },
  { value:'converted', labelKey:'hq.leads.converted' },
  { value:'closed', labelKey:'hq.leads.closed' },
 ]
 return (
  <AuthGate fallbackKey="auth.fallback.profile">
   <div className="mx-auto max-w-6xl p-6">
    <h1 className="text-3xl font-bold">{t('hq.leadsTitle')}</h1>
    {profile?.role !== 'admin' ? (
     <p className="mt-4 text-muted-foreground">{t('hq.leadsAdminOnly')}</p>
    ) : (
     <>
      <div className="mt-6 h-10 flex items-center gap-3">
       <label htmlFor="lead-filter" className="text-sm font-medium">{t('hq.leads.filter')}</label>
       <select id="lead-filter" value={filter} onChange={e=>setFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
        {filterOpts.map(o=><option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
       </select>
      </div>
      <div className="overflow-x-auto rounded-xl border">
       <table className="w-full text-left text-sm">
        <thead className="bg-muted/50"><tr>{cols.map(c=><th key={c.key} scope="col" className="px-4 py-3 font-semibold">{t(c.labelKey)}</th>)}</tr></thead>
        <tbody>{shown.map(l=>(
         <tr key={l.id} className="border-t">
          <td className="px-4 py-3">{l.email}</td>
          <td className="px-4 py-3">{l.phone||'—'}</td>
          <td className="px-4 py-3">{l.name||'—'}</td>
          <td className="px-4 py-3">{l.company||'—'}</td>
          <td className="px-4 py-3">{l.source}</td>
          <td className="px-4 py-3">{l.status}</td>
          <td className="px-4 py-3">{new Date(l.createdAt).toLocaleString()}</td>
         </tr>
        ))}</tbody>
       </table>
      </div>
     </>
    )}
   </div>
  </AuthGate>
 )
}
