import { friendlyDbError } from '@/lib/dbErrors'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { useProfile,useUpdateProfile } from '@/hooks/useProfile'
import { logMdAudit } from '@/lib/mdAudit'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
import { MdNav } from '@/components/MdNav'

export function MdProfile (){const {t}=useI18n();const {user}=useAuth();const ok=useIsMd();const {data:p}=useProfile(user?.id);const update=useUpdateProfile();const [form,setForm]=useState<Record<string, string>>();useEffect(()=>{if(!form&&p)setForm({fullName:p.fullName||'',phone:p.phone||'',bio:p.bio||'',location:p.location||'',linkedinUrl:p.linkedinUrl||'',twitterUrl:p.twitterUrl||'',instagramUrl:p.instagramUrl||'',whatsappNumber:p.whatsappNumber||'',tiktokUrl:p.tiktokUrl||'',youtubeUrl:p.youtubeUrl||''})},[form,p]);const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));return <AuthGate fallbackKey="auth.fallback.dashboard"><div className="mx-auto max-w-2xl p-6"><MdNav/><h1 className="text-3xl font-bold">{t('md.profile.title')}</h1><Card className="mt-6"><CardHeader><CardTitle>{t('md.profile.details')}</CardTitle></CardHeader><CardContent className="grid gap-4">{['fullName','phone','location','bio','linkedinUrl','twitterUrl','instagramUrl','whatsappNumber','tiktokUrl','youtubeUrl'].map(k=><Input key={k} placeholder={t('md.profile.'+k)} value={form?.[k]||''} onChange={e=>set(k,e.target.value)}/>)}<Button disabled={!ok||!p||update.isPending} onClick={()=>{update.mutateAsync({id:p!.id,data:form??{}}).then(()=>{toast.success(t('profile.saved'));void logMdAudit('profile_updated','profile',user?.email??'')},(err)=>toast.error(friendlyDbError(err,t)))}}>{t('md.profile.save')}</Button></CardContent></Card></div></AuthGate>}
