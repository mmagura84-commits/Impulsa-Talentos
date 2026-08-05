import { createFileRoute } from '@tanstack/react-router'
import { useEffect,useState } from 'react'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { listRows,createRow,updateRow } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'
export const Route=createFileRoute('/_app/md/marketing')({component:Marketing})
const channels=['LinkedIn (company)','LinkedIn (job board)','Instagram','Facebook','TikTok','WhatsApp Business','Twitter/X (company)','YouTube','Google Business Profile','Email Marketing Platform','Google Ads','Meta Ads','Facebook (employer groups)','Twitter/X (employer outreach)','Computrabajo Colombia','elempleo.com','Magneto365','Torre.co','Konzerta','Bumeran','Indeed Colombia','Facebook Groups (regional)','Telegram (job channels)','Glassdoor']
function Marketing(){const {t}=useI18n();const {user}=useAuth();const ok=useIsMd();const [rows,setRows]=useState<any[]>([]);useEffect(()=>{listRows<any>('marketing_channels',{orderBy:{createdAt:'asc'}}).then(setRows).catch(()=>{})},[]);const save=async(name:string,url:string)=>{const old=rows.find(r=>r.channelType===name);if(old)await updateRow('marketing_channels',old.id,{profileUrl:url,locked:true,updatedAt:new Date().toISOString()});else await createRow('marketing_channels',{channelType:name,businessName:'',profileUrl:url,accountHandle:'',status:'pending',locked:true,createdBy:user?.id});setRows(await listRows<any>('marketing_channels'))};return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-4xl p-6"><MdNav/><h1 className="text-3xl font-bold">{t('md.marketing.title')}</h1><p className="mt-2 text-muted-foreground">{t('md.marketing.description')}</p><div className="mt-6 space-y-3">{channels.map(name=>{const row=rows.find(r=>r.channelType===name);return <Card key={name}><CardHeader><CardTitle className="text-base">{name}</CardTitle></CardHeader><CardContent className="flex gap-2"><Input aria-label={name} defaultValue={row?.profileUrl||''} placeholder={t('md.marketing.url')} disabled={!!row?.locked}/><Button onClick={e=>{const input=e.currentTarget.previousElementSibling as HTMLInputElement;save(name,input.value)}} disabled={!!row?.locked||!ok}>{row?.locked?t('md.marketing.locked'):t('md.marketing.save')}</Button></CardContent></Card>})}</div></main></AuthGate>}
