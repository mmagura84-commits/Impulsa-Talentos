import { createFileRoute } from '@tanstack/react-router'
import { useEffect,useState } from 'react'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { listRows,createRow } from '@/lib/supabase'
export const Route=createFileRoute('/_app/md/banking')({component:Banking})
function Banking(){const {user}=useAuth();const ok=useIsMd();const [saved,setSaved]=useState<any>();const [form,setForm]=useState({bankName:'',accountType:'ahorros',accountNumber:'',titularName:'',nitRut:'',swiftCode:''});useEffect(()=>{listRows<any>('business_banking',{where:{createdBy:user?.id},limit:1}).then(x=>setSaved(x[0]))},[user?.id]);const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-2xl p-6"><h1 className="text-3xl font-bold">Business Banking</h1>{saved?<Card className="mt-6"><CardHeader><CardTitle>Awaiting owner review</CardTitle></CardHeader><CardContent>Banking details submitted. Status: {saved.status}</CardContent></Card>:<Card className="mt-6"><CardContent className="grid gap-4 p-6">{Object.entries(form).map(([k,v])=><Input key={k} placeholder={k} value={v} onChange={e=>set(k,e.target.value)}/>) }<Button disabled={!ok} onClick={async()=>{await createRow('business_banking',{...form,status:'pending_review',locked:false,createdBy:user?.id,createdAt:new Date().toISOString()});setSaved({...form,status:'pending_review'})}}>Submit for review</Button></CardContent></Card>}</main></AuthGate>}
