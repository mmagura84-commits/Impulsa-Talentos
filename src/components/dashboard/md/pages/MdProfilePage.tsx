import { friendlyDbError } from '@/lib/dbErrors'
import { toast } from 'sonner'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { storagePointer, useSignedStorageUrl } from '@/hooks/useSignedStorageUrl'
import { uploadContentType } from '@/lib/uploadTypes'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Trash2 } from 'lucide-react'
import { AuthGate } from '@/components/AuthGate'
import { useAuth,useIsMd } from '@/hooks/useAuth'
import { useProfile,useUpdateProfile } from '@/hooks/useProfile'
import { logMdAudit } from '@/lib/mdAudit'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'

const MAX_AVATAR_BYTES = 4 * 1024 * 1024
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Profile photo: same private storage + pointer the candidate/employer profile uses (no new database setup). */
function MdPhotoCard({ profileId, userId, avatarUrl, name, enabled }: { profileId?: string; userId?: string; avatarUrl?: string; name: string; enabled: boolean }) {
  const { t } = useI18n()
  const update = useUpdateProfile()
  const input = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  const shown = useSignedStorageUrl(avatarUrl)
  const pick = async (file: File) => {
    if (!profileId || !userId) return
    if (!AVATAR_TYPES.has(file.type)) { toast.error(t('profile.avatar.typeError')); return }
    if (file.size > MAX_AVATAR_BYTES) { toast.error(t('profile.avatar.sizeError')); return }
    setBusy(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `avatars/${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true, contentType: uploadContentType(file) ?? file.type })
      if (error) throw error
      await update.mutateAsync({ id: profileId, data: { avatarUrl: storagePointer(path) } })
      toast.success(t('profile.avatar.uploaded'))
    } catch (err) {
      toast.error(friendlyDbError(err, t) || t('profile.avatar.uploadError'))
    } finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  const remove = async () => {
    if (!profileId) return
    try { await update.mutateAsync({ id: profileId, data: { avatarUrl: '' } }); toast.success(t('profile.avatar.removed')) }
    catch (err) { toast.error(friendlyDbError(err, t)) }
  }
  return (
    <Card className="mt-6">
      <CardHeader><CardTitle>{t('profile.avatar.title')}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <Avatar className="size-20">
          {shown ? <AvatarImage src={shown} alt={name} /> : null}
          <AvatarFallback className="text-2xl">{(name.charAt(0) || 'M').toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-11 gap-2" disabled={!enabled || busy} onClick={() => input.current?.click()}>
              <Camera className="size-4" aria-hidden />{busy ? t('profile.avatar.uploading') : avatarUrl ? t('profile.avatar.change') : t('profile.avatar.upload')}
            </Button>
            {avatarUrl ? <Button type="button" variant="ghost" className="h-11 gap-2" disabled={!enabled || busy} onClick={() => void remove()}><Trash2 className="size-4" aria-hidden />{t('profile.avatar.remove')}</Button> : null}
          </div>
          <p className="text-sm text-muted-foreground">{t('profile.avatar.hint')}</p>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" aria-label={t('profile.avatar.upload')} onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f) }} />
      </CardContent>
    </Card>
  )
}

export function MdProfile (){const {t}=useI18n();const {user}=useAuth();const ok=useIsMd();const {data:p}=useProfile(user?.id);const update=useUpdateProfile();const [form,setForm]=useState<Record<string, string>>();useEffect(()=>{if(!form&&p)setForm({fullName:p.fullName||'',phone:p.phone||'',bio:p.bio||'',location:p.location||'',linkedinUrl:p.linkedinUrl||'',twitterUrl:p.twitterUrl||'',instagramUrl:p.instagramUrl||'',whatsappNumber:p.whatsappNumber||'',tiktokUrl:p.tiktokUrl||'',youtubeUrl:p.youtubeUrl||''})},[form,p]);const set=(k:string,v:string)=>setForm(f=>({...f,[k]:v}));return <AuthGate fallbackKey="auth.fallback.dashboard"><div className="mx-auto max-w-2xl p-6"><h1 className="text-3xl font-bold">{t('md.profile.title')}</h1><MdPhotoCard profileId={p?.id} userId={user?.id} avatarUrl={p?.avatarUrl} name={p?.fullName||user?.email||''} enabled={ok&&!!p}/><Card className="mt-6"><CardHeader><CardTitle>{t('md.profile.details')}</CardTitle></CardHeader><CardContent className="grid gap-4">{['fullName','phone','location','bio','linkedinUrl','twitterUrl','instagramUrl','whatsappNumber','tiktokUrl','youtubeUrl'].map(k=><Input key={k} placeholder={t('md.profile.'+k)} value={form?.[k]||''} onChange={e=>set(k,e.target.value)}/>)}<Button disabled={!ok||!p||update.isPending} onClick={()=>{update.mutateAsync({id:p!.id,data:form??{}}).then(()=>{toast.success(t('profile.saved'));void logMdAudit('profile_updated','profile',user?.email??'')},(err)=>toast.error(friendlyDbError(err,t)))}}>{t('md.profile.save')}</Button></CardContent></Card></div></AuthGate>}
