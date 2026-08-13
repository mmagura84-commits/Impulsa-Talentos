import { useNavigate } from '@tanstack/react-router'
import { useEffect,useState } from 'react'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { listRows,createRow } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'

export function Banking (){const {t}=useI18n();const {user}=useAuth();const ok=useIsMd();const nav=useNavigate();useEffect(()=>{if(!ok)nav({to:'/dashboard',replace:true})},[ok,nav]);const [saved,setSaved]=useState<any>();const [form,setForm]=useState({bankName:'',accountType:'ahorros',accountNumber:'',titularName:'',nitRut:'',swiftCode:''});useEffect(()=>{if(user?.id)listRows<any>('business_banking',{where:{createdBy:user.id},limit:1}).then(x=>{setSaved(x[0]);if(x[0])setForm(x[0])})},[user?.id]);const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-2xl p-6"><MdNav/><h1 className="text-3xl font-bold">{t('md.banking.title')}</h1><p className="mt-2 text-muted-foreground">{t('md.banking.description')}</p><Card className="mt-6"><CardHeader><CardTitle>{saved?t('md.banking.submitted'):t('md.banking.formTitle')}</CardTitle></CardHeader><CardContent className="grid gap-4">{Object.entries(form).filter(([k])=>!['status','locked','createdBy','createdAt','id'].includes(k)).map(([k,v])=><Input key={k} aria-label={t(`md.banking.${k}`)} placeholder={t(`md.banking.${k}`)} value={String(v||'')} disabled={!!saved?.locked} onChange={e=>set(k,e.target.value)}/>) }{saved&&<p className="text-sm text-muted-foreground">{t('md.banking.status')}: {saved.status}</p>}<Button disabled={!ok||!!saved?.locked} onClick={async()=>{await createRow('business_banking',{...form,status:'pending_review',locked:true,createdBy:user?.id,createdAt:new Date().toISOString()});setSaved({...form,status:'pending_review',locked:true})}}>{saved?t('md.banking.locked'):t('md.banking.submit')}</Button></CardContent></Card></main></AuthGate>}
