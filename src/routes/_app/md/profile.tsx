import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { useProfile,useUpdateProfile } from '@/hooks/useProfile'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
export const Route=createFileRoute('/_app/md/profile')({component:MdProfile})
function MdProfile(){const {t}=useI18n();const {user}=useAuth();const ok=useIsMd();const {data:p}=useProfile(user?.id);const update=useUpdateProfile();const [form,setForm]=useState<any>();if(!form&&p)setForm({fullName:p.fullName,phone:p.phone,bio:p.bio,location:p.location});const set=(k:string,v:string)=>setForm((f:any)=>({...f,[k]:v}));return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-2xl p-6"><h1 className="text-3xl font-bold">{t('md.profile.title')}</h1><Card className="mt-6"><CardHeader><CardTitle>{t('md.profile.details')}</CardTitle></CardHeader><CardContent className="grid gap-4">{['fullName','phone','location','bio'].map(k=><Input key={k} placeholder={t('md.profile.'+k)} value={form?.[k]||''} onChange={e=>set(k,e.target.value)}/>)}<Button disabled={!ok||!p||update.isPending} onClick={()=>update.mutate({id:p!.id,data:form})}>{t('md.profile.save')}</Button></CardContent></Card></main></AuthGate>}
