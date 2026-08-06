import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Save,
  Briefcase,
  Camera,
  Trash2,
  Upload,
  CheckCircle2,
  Building2,
  PlusCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { storagePointer, useSignedStorageUrl } from '@/hooks/useSignedStorageUrl'
import { useProfile, useCreateProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useI18n } from '@/i18n/I18nProvider'
import { toast } from 'sonner'

export const Route = createFileRoute('/m/profile')({
  head: () => ({ meta: [{ title: 'Profile — Impulsa (mobile)' }] }),
  component: MobileProfile,
  validateSearch: (s: Record<string, unknown>) => ({
    apply: typeof s.apply === 'string' ? s.apply : undefined,
  }),
})

type Role = 'candidate' | 'employer'

const EMPTY = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  bio: '',
  languages: '',
  cvUrl: '',
  avatarUrl: '',
  role: 'candidate' as Role,
}

const MAX_AVATAR = 4 * 1024 * 1024
const ALLOWED_AVATAR = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif']

function MobileProfile() {
  const { user, isLoading, login } = useAuth()
  const { data: profile } = useProfile(user?.id)
  const createProfile = useCreateProfile()
  const updateProfile = useUpdateProfile()
  const { t, locale } = useI18n()
  const search = useSearch({ from: '/m/profile' })
  const [form, setForm] = useState(EMPTY)
  const avatarDisplayUrl = useSignedStorageUrl(form.avatarUrl)
  const cvDisplayUrl = useSignedStorageUrl(form.cvUrl)
  const [hydrated, setHydrated] = useState(false)
  const [uploading, setUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)

  // Hydrate form from profile (only once)
  if (profile && !hydrated) {
    setForm({
      fullName: profile.fullName ?? user?.displayName ?? user?.email?.split('@')[0] ?? '',
      email: profile.email ?? user?.email ?? '',
      phone: profile.phone ?? '',
      location: profile.location ?? '',
      bio: profile.bio ?? '',
      languages: profile.languages ?? '',
      cvUrl: profile.cvUrl ?? '',
      avatarUrl: profile.avatarUrl ?? '',
      role: (profile.role as Role) ?? 'candidate',
    })
    setHydrated(true)
  }

  if (isLoading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="px-4 pt-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
          <User className="size-6 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">{t('mobile.authRequired')}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          {t('mobile.authRequiredDesc')}
        </p>
        <Button onClick={login} size="lg" className="mt-4 w-full">
          {t('mobile.authRequiredCta')}
        </Button>
      </div>
    )
  }

  const avatarInitial = (form.fullName.trim().charAt(0) || user.email?.charAt(0) || 'U').toUpperCase()

  const update = (k: keyof typeof EMPTY, v: string) => setForm(p => ({ ...p, [k]: v }))

  const isAllowedAvatar = (f: File) => {
    if (ALLOWED_AVATAR.includes(f.type)) return true
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    return ALLOWED_EXT.includes(ext)
  }

  const handleAvatar = async (file: File) => {
    if (!isAllowedAvatar(file)) {
      toast.error(t('profile.avatar.typeError'))
      return
    }
    if (file.size > MAX_AVATAR) {
      toast.error(t('profile.avatar.sizeError'))
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `avatars/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true })
      if (error) throw error
      const publicUrl = storagePointer(path)
      update('avatarUrl', publicUrl)
      if (profile) {
        await updateProfile.mutateAsync({ id: profile.id, data: { avatarUrl: publicUrl } })
        toast.success(t('profile.avatar.uploaded'), { duration: 1800 })
      } else {
        toast.success(t('profile.avatar.ready'), { duration: 1800 })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.avatar.uploadError'))
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error(t('profile.nameRequired'))
      return
    }
    try {
      if (profile) {
        await updateProfile.mutateAsync({
          id: profile.id,
          data: {
            fullName: form.fullName,
            phone: form.phone,
            location: form.location,
            bio: form.bio,
            languages: form.languages,
            cvUrl: form.cvUrl,
            role: form.role,
          },
        })
        toast.success(t('profile.saved'))
        // If they came from the apply flow, bounce back to the job
        if (search.apply) {
          window.location.href = `/m/jobs/${search.apply}`
        }
      } else {
        await createProfile.mutateAsync({
          userId: user.id,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          location: form.location,
          bio: form.bio,
          languages: form.languages,
          cvUrl: form.cvUrl,
          avatarUrl: form.avatarUrl || '',
          role: form.role,
        })
        toast.success(t('profile.createSuccess'), { description: t('profile.createSuccessDesc') })
        if (search.apply) {
          window.location.href = `/m/jobs/${search.apply}`
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.createError'))
    }
  }

  return (
    <div className="px-4 pt-4 pb-32 space-y-4">
      {/* Avatar card */}
      <FadeIn>
        <Card>
          <CardContent className="pt-5 flex flex-col items-center">
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative h-24 w-24 rounded-full ring-2 ring-border overflow-hidden active:opacity-80"
            >
              {avatarDisplayUrl ? (
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarDisplayUrl} alt={form.fullName} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-serif">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="size-full rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-serif font-bold">
                  {avatarInitial}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                {uploading ? (
                  <span className="inline-block size-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  <Camera className="size-5" />
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleAvatar(f)
                  e.target.value = ''
                }}
              />
            </button>
            <p className="mt-3 text-sm font-semibold text-foreground">
              {form.fullName || user.email?.split('@')[0] || t('profile.title')}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t('profile.avatar.hint')}
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Role selector */}
      <FadeIn delay={0.04}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="size-4 text-primary" /> {t('profile.role.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {(['candidate', 'employer'] as Role[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => update('role', r)}
                className={`text-left rounded-lg border p-3 transition-all ${
                  form.role === r
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border active:bg-accent/30'
                }`}
              >
                <p className="text-xs font-semibold text-foreground">
                  {r === 'candidate' ? t('profile.role.candidate') : t('profile.role.employer')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                  {r === 'candidate' ? t('profile.role.candidateDesc') : t('profile.role.employerDesc')}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Personal info */}
      <FadeIn delay={0.08}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="size-4 text-primary" /> {t('profile.personal.title')}
            </CardTitle>
            <CardDescription className="text-xs">{t('profile.personal.desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-xs">{t('profile.field.fullName')}</Label>
              <Input id="fullName" value={form.fullName} onChange={e => update('fullName', e.target.value)} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs flex items-center gap-1.5">
                <Phone className="size-3 text-muted-foreground" /> {t('profile.field.phone')}
              </Label>
              <Input id="phone" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+57 300 000 0000" className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location" className="text-xs flex items-center gap-1.5">
                <MapPin className="size-3 text-muted-foreground" /> {t('profile.field.location')}
              </Label>
              <Input id="location" value={form.location} onChange={e => update('location', e.target.value)} placeholder={t('postJob.company.locationPlaceholder')} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="languages" className="text-xs flex items-center gap-1.5">
                <Globe className="size-3 text-muted-foreground" /> {t('profile.field.languages')}
              </Label>
              <Input id="languages" value={form.languages} onChange={e => update('languages', e.target.value)} placeholder={locale === 'es' ? 'Espanol (Nativo), Ingles (C1)' : 'Spanish (Native), English (C1)'} className="h-11" />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Save button */}
      <FadeIn delay={0.12}>
        <Button
          onClick={handleSave}
          size="lg"
          disabled={createProfile.isPending || updateProfile.isPending}
          className="w-full h-12 font-semibold gap-2"
        >
          <Save className="size-4" />
          {profile ? t('profile.save') : t('profile.create')}
        </Button>
      </FadeIn>
    </div>
  )
}

function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
