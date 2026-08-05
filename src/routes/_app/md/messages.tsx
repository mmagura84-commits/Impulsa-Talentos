import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { createRow } from '@/lib/supabase'
export const Route=createFileRoute('/_app/md/messages')({component:Messages})
function Messages(){const {user}=useAuth();const ok=useIsMd();const [to,setTo]=useState('');const [subject,setSubject]=useState('');const [body,setBody]=useState('');return <AuthGate fallbackKey="auth.fallback.dashboard"><main className="mx-auto max-w-2xl p-6"><h1 className="text-3xl font-bold">Employer Messages</h1><Card className="mt-6"><CardHeader><CardTitle>Compose message</CardTitle></CardHeader><CardContent className="grid gap-4"><Input placeholder="Employer email" value={to} onChange={e=>setTo(e.target.value)}/><Input placeholder="Subject" value={subject} onChange={e=>setSubject(e.target.value)}/><textarea className="min-h-40 rounded-md border bg-background p-3" placeholder="Message" value={body} onChange={e=>setBody(e.target.value)}/><Button disabled={!ok||!to||!subject||!body} onClick={async()=>{await createRow('messages',{senderId:user?.id,recipientEmail:to,subject,body,direction:'outbound',status:'sent',createdAt:new Date().toISOString()});setBody('')}}>Send message</Button></CardContent></Card></main></AuthGate>}
