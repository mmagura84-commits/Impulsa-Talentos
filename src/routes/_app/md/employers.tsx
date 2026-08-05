import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useIsMd } from '@/hooks/useAuth'
import { useAllProfiles } from '@/hooks/useProfile'
import { useAllCompanies } from '@/hooks/useCompanies'
import { useAllJobs } from '@/hooks/useJobs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider'
export const Route=createFileRoute('/_app/md/employers')({component:Employers})
function Employers(){const {t}=useI18n();const ok=useIsMd();const {data:profiles=[]}=useAllProfiles();const {data:companies=[]}=useAllCompanies();const {data:jobs=[]}=useAllJobs();const [q,setQ]=useState('');const employers=useMemo(()=>profiles.filter(p=>p.role==='employer').filter(p=>(p.fullName+' '+p.email).toLowerCase().includes(q.toLowerCase())).map(p=>({...p,company:companies.find(c=>c.employerId===p.userId),openJobs:jobs.filter(j=>j.employerId===p.userId&&j.status==='open').length})),[profiles,companies,jobs,q]);return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-bold">{t('md.employers.title')}</h1><p className="mt-1 text-muted-foreground">{t('md.employers.desc')}</p><Input className="mt-6 max-w-md" placeholder={t('md.employers.search')} value={q} onChange={e=>setQ(e.target.value)}/><div className="mt-6 space-y-3">{employers.map(e=><Card key={e.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-semibold">{e.company?.name||e.fullName}</p><p className="text-sm text-muted-foreground">{e.fullName} · {e.email} · {e.phone||'—'}</p><p className="text-xs text-muted-foreground">{e.location||'—'}</p></div><div className="flex items-center gap-3"><span className="text-sm">{e.openJobs} {t('md.employers.openJobs')}</span><Button size="sm" disabled={!ok}>{t('md.employers.contact')}</Button></div></CardContent></Card>)}</div>{employers.length===0&&<p className="mt-8 text-muted-foreground">{t('md.employers.empty')}</p>}</main></AuthGate>}
