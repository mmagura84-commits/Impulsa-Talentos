import { createFileRoute, Link } from '@tanstack/react-router'
import { useRef, useState, useEffect, type ReactNode } from 'react'
import { captureUTMParams, getUTMParams, trackEvent } from '@/lib/marketing'
import { motion, useInView } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AuthGate } from '@/components/AuthGate'
import { useAuth } from '@/hooks/useAuth'
import { useProfile, useCreateProfile, useUpdateProfile } from '@/hooks/useProfile'
import { useCompany } from '@/hooks/useCompanies'
import { useI18n } from '@/i18n/I18nProvider'
import { Switch } from '@/components/ui/switch'
import type { NotificationPrefs, Profile } from '@/types'
import { DEFAULT_NOTIFICATION_PREFS } from '@/types'
import { supabase } from '@/lib/supabase'
import type { AppUser } from '@/hooks/useAuth'
import {
  User,
  Video,
  Save,
  MapPin,
  Phone,
  Globe,
  FileText,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
  Upload,
  Shield,
  ShieldAlert,
  Mail,
  Key,
  Building2,
  ArrowUpRight,
  BadgeCheck,
  Target,
  Clock,
  DollarSign,
  Laptop,
  PlusCircle,
  BellRing,
} from 'lucide-react'

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

function FadeIn({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

type Role = 'candidate' | 'employer' | 'admin'

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  bio: '',
  languages: '',
  cvUrl: '',
  avatarUrl: '',
  role: 'candidate' as Role,
  // Candidate-only fields
  skills: '',
  positionTitle: '',
  yearsOfExperience: '',
  desiredSalaryMin: '',
  desiredSalaryMax: '',
  preferredLocationType: '',
  meetingProvider: '',
  meetingLink: '',
}

const MAX_AVATAR_BYTES = 4 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_AVATAR_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif']

/* ── Email verification banner ─────────────────────────── */
function EmailVerificationBanner({ user }: { user: AppUser | null }) {
  const [resending, setResending] = useState(false)
  const [sent, setSent] = useState(false)

  const isVerified = user?.emailVerified ?? false
  if (!user || isVerified) return null

  const handleResend = async () => {
    setResending(true)
    try {
      await supabase.auth.resend({ type: 'signup', email: user.email ?? '' })
      setSent(true)
      setTimeout(() => setSent(false), 5000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send verification email')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 mb-4">
      <div className="flex items-center justify-center h-8 w-8 shrink-0 rounded-full bg-amber-500/10 text-amber-600 mt-0.5">
        <ShieldAlert className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Email not verified</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {sent ? 'Verification email sent! Check your inbox.' : `We sent a verification link to ${user.email}. Please click it to secure your account.`}
        </p>
        {!sent && (
          <button type="button" onClick={handleResend} disabled={resending}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer">
            <Mail className="size-3" />
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Password reset block ─────────────────────────────── */
function ResetPasswordBlock() {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleReset = async () => {
    setLoading(true)
    try {
      const { data: me } = await supabase.auth.getUser()
      const email = me.user?.email
      if (!email) { toast.error('Could not determine your email address'); return }
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setDone(true)
      setTimeout(() => setDone(false), 5000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-center h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary mt-0.5">
        <Key className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">Change your password</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {done ? 'Password reset link sent to your email. Check your inbox.' : 'We will send a reset link to your email address.'}
        </p>
        {!done && (
          <button type="button" onClick={handleReset} disabled={loading}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer">
            {loading ? <span className="inline-block size-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" /> : <Key className="size-3" />}
            {loading ? 'Sending...' : 'Send password reset link'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Notification preferences card (all roles) ───────────── */
function NotificationPrefsCard({
  profile,
  updateProfile,
  t,
}: {
  profile: Profile | null
  updateProfile: ReturnType<typeof useUpdateProfile>
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const prefs: NotificationPrefs = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(profile?.notificationPrefs ?? {}),
  }
  const rows: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    {
      key: 'applicationUpdates',
      label: t('profile.notif.applicationUpdates'),
      desc: t('profile.notif.applicationUpdatesDesc'),
    },
    {
      key: 'newJobs',
      label: t('profile.notif.newJobs'),
      desc: t('profile.notif.newJobsDesc'),
    },
    {
      key: 'marketingEmails',
      label: t('profile.notif.marketing'),
      desc: t('profile.notif.marketingDesc'),
    },
  ]
  const togglePref = async (key: keyof NotificationPrefs) => {
    if (!profile) {
      toast.error(t('profile.notInDb'))
      return
    }
    setSavingKey(key)
    try {
      const next = { ...prefs, [key]: !prefs[key] }
      await updateProfile.mutateAsync({
        id: profile.id,
        data: { notificationPrefs: next },
      })
      toast.success(t('profile.notif.saved'))
    } catch (err) {
      toast.error(t('profile.createError'), {
        description: err instanceof Error ? err.message : '',
      })
    } finally {
      setSavingKey(null)
    }
  }
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BellRing className="size-5 text-primary" /> {t('profile.notif.title')}
        </CardTitle>
        <CardDescription>{t('profile.notif.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(row => (
          <div
            key={row.key}
            className="flex items-start justify-between gap-4 py-1"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.desc}</p>
            </div>
            <Switch
              checked={prefs[row.key]}
              disabled={savingKey === row.key}
              onCheckedChange={() => togglePref(row.key)}
              aria-label={row.label}
            />
          </div>
        ))}
        {!profile && (
          <p className="text-xs text-muted-foreground">{t('profile.notif.createFirst')}</p>
        )}
      </CardContent>
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN PROFILE PAGE — ROLE-AWARE
   ══════════════════════════════════════════════════════════ */
function ProfilePage() {
  const { user } = useAuth()
  const { data: profile, isLoading } = useProfile(user?.id)
  const createProfile = useCreateProfile()
  const updateProfile = useUpdateProfile()
  const { locale, t } = useI18n()

  const [form, setForm] = useState(EMPTY_FORM)
  const [hydrated, setHydrated] = useState(false)
  const [savedFlag, setSavedFlag] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCv, setUploadingCv] = useState(false)
  const [source, setSource] = useState('')
  const [consent, setConsent] = useState(false)
  const utm = getUTMParams()
  useEffect(() => { captureUTMParams(); trackEvent('profile_complete', { profileId: profile?.id ?? null }) }, [profile?.id])
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const cvInputRef = useRef<HTMLInputElement | null>(null)

  // Extract candidate-only fields from metadata stored in `bio` JSON or separate fields.
  // For now, we treat them as transient form state stored directly on the profile's
  // existing fields: positionTitle -> bio prefix, etc. We store as-is.
  useEffect(() => {
    if (!user) return
    if (profile) {
      setForm({
        fullName: profile.fullName ?? user.displayName ?? user.email?.split('@')[0] ?? '',
        email: profile.email ?? user.email ?? '',
        phone: profile.phone ?? '',
        location: profile.location ?? '',
        bio: profile.bio ?? '',
        languages: profile.languages ?? '',
        cvUrl: profile.cvUrl ?? '',
        avatarUrl: profile.avatarUrl ?? '',
        role: (profile.role as Role) ?? 'candidate',
        skills: (profile.skills ?? []).join(', '),
        positionTitle: profile.desiredRole ?? '',
        yearsOfExperience: profile.experienceYears?.toString() ?? '',
        desiredSalaryMin: profile.desiredSalaryMin?.toString() ?? '',
        desiredSalaryMax: profile.desiredSalaryMax?.toString() ?? '',
        preferredLocationType: '',
        meetingProvider: profile.meetingProvider ?? '',
        meetingLink: profile.meetingLink ?? '',
      })
    } else if (!isLoading && !hydrated) {
      setForm({
        fullName: user.displayName ?? user.email?.split('@')[0] ?? '',
        email: user.email ?? '',
        phone: '',
        location: '',
        bio: '',
        languages: '',
        cvUrl: '',
        avatarUrl: '',
        role: 'candidate',
        skills: '',
        positionTitle: '',
        yearsOfExperience: '',
        desiredSalaryMin: '',
        desiredSalaryMax: '',
        preferredLocationType: '',
        meetingProvider: '',
        meetingLink: '',
      })
    }
    setHydrated(true)
  }, [profile, user, isLoading, hydrated])

  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const isAllowedAvatar = (f: File): boolean => {
    if (ALLOWED_AVATAR_TYPES.has(f.type)) return true
    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    return ALLOWED_AVATAR_EXT.includes(ext)
  }

  const handleAvatarFile = async (file: File) => {
    if (!user) return
    if (!isAllowedAvatar(file)) { toast.error(t('profile.avatar.typeError')); return }
    if (file.size > MAX_AVATAR_BYTES) { toast.error(t('profile.avatar.sizeError')); return }
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `avatars/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('cvs').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: pub } = supabase.storage.from('cvs').getPublicUrl(path)
      const publicUrl = pub.publicUrl
      update('avatarUrl', publicUrl)
      if (profile) {
        await updateProfile.mutateAsync({ id: profile.id, data: { avatarUrl: publicUrl } })
        toast.success(t('profile.avatar.uploaded'), { duration: 1800 })
      } else {
        toast.success(t('profile.avatar.ready'), { duration: 1800 })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('profile.avatar.uploadError'))
    } finally { setUploadingAvatar(false) }
  }

  const handleRemoveAvatar = async () => {
    if (!profile?.avatarUrl) { update('avatarUrl', ''); return }
    try {
      await updateProfile.mutateAsync({ id: profile.id, data: { avatarUrl: '' } })
      update('avatarUrl', '')
      toast.success(t('profile.avatar.removed'), { duration: 1800 })
    } catch (err) { toast.error(err instanceof Error ? err.message : t('common.retry')) }
  }

  const handleCvFile = async (file: File) => {
    if (!user) return
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10MB'); return }
    const allowed = ['pdf', 'doc', 'docx']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!allowed.includes(ext)) { toast.error('Only PDF, DOC, DOCX files allowed'); return }
    setUploadingCv(true)
    try {
      const path = `cvs/${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('cvs').upload(path, file)
      if (error) throw error
      const { data: pub } = supabase.storage.from('cvs').getPublicUrl(path)
      const publicUrl = pub.publicUrl
      update('cvUrl', publicUrl)
      toast.success('CV uploaded successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally { setUploadingCv(false) }
  }

  const handleSave = async () => {
    if (!user) return
    if (!form.fullName.trim()) { toast.error(t('profile.nameRequired')); return }
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
            skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
            desiredRole: form.positionTitle.trim() || undefined,
            experienceYears: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
            desiredSalaryMin: form.desiredSalaryMin ? Number(form.desiredSalaryMin) : undefined,
            desiredSalaryMax: form.desiredSalaryMax ? Number(form.desiredSalaryMax) : undefined,
            meetingProvider: form.meetingProvider || undefined,
            meetingLink: form.meetingLink.trim() || undefined,
            ...(profile.avatarUrl ? {} : { avatarUrl: form.avatarUrl || undefined }),
          },
        })
        toast.success(t('profile.saved'))
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
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
          desiredRole: form.positionTitle.trim() || undefined,
          experienceYears: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
          desiredSalaryMin: form.desiredSalaryMin ? Number(form.desiredSalaryMin) : undefined,
          desiredSalaryMax: form.desiredSalaryMax ? Number(form.desiredSalaryMax) : undefined,
          meetingProvider: form.meetingProvider || undefined,
          meetingLink: form.meetingLink.trim() || undefined,
        })
        toast.success(t('profile.createSuccess'), { description: t('profile.createSuccessDesc') })
      }
      setSavedFlag(true)
      setTimeout(() => setSavedFlag(false), 3000)
    } catch (err) {
      toast.error(t('profile.createError'), { description: err instanceof Error ? err.message : '' })
    }
  }

  const isPending = createProfile.isPending || updateProfile.isPending
  const avatarInitial = (form.fullName.trim().charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()
  const currentRole = form.role

  return (
    <AuthGate fallbackKey="auth.fallback.profile">
      <div className="p-6 max-w-3xl mx-auto">
        <FadeIn>
          <div className="mb-8">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">
              {currentRole === 'candidate' ? t('profile.candidate.title')
                : currentRole === 'employer' ? t('profile.employer.title')
                : t('profile.admin.title')}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {currentRole === 'candidate' ? t('profile.candidate.subtitle')
                : currentRole === 'employer' ? t('profile.employer.subtitle')
                : t('profile.admin.subtitle')}
              {profile ? null : (
                <span className="block mt-1 text-accent text-sm">{t('profile.notCreatedBanner')}</span>
              )}
            </p>
          </div>
        </FadeIn>

        {/* Avatar uploader — shared across all roles */}
        <FadeIn delay={0.02}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="size-5 text-primary" /> {t('profile.avatar.title')}
              </CardTitle>
              <CardDescription>{t('profile.avatar.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                <Avatar className="h-20 w-20 shrink-0 ring-2 ring-border">
                  {form.avatarUrl ? <AvatarImage src={form.avatarUrl} alt={form.fullName || 'avatar'} /> : null}
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary font-serif">{avatarInitial}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm font-medium text-foreground">{form.fullName || user?.email?.split('@')[0] || t('profile.title')}</p>
                  <p className="text-xs text-muted-foreground">{t('profile.avatar.hint')}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" disabled={uploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()} className="gap-1.5">
                      {uploadingAvatar ? (
                        <><span className="inline-block size-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />{t('profile.avatar.uploading')}</>
                      ) : (
                        <><Upload className="size-3.5" />{form.avatarUrl ? t('profile.avatar.change') : t('profile.avatar.upload')}</>
                      )}
                    </Button>
                    {form.avatarUrl && (
                      <Button type="button" size="sm" variant="ghost" onClick={handleRemoveAvatar}
                        disabled={uploadingAvatar} className="gap-1.5 text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />{t('profile.avatar.remove')}
                      </Button>
                    )}
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only" onChange={e => { const file = e.target.files?.[0]; if (file) handleAvatarFile(file); e.target.value = '' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* Account security — shared across all roles */}
        <FadeIn delay={0.025}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="size-5 text-primary" /> Account Security
              </CardTitle>
              <CardDescription>Manage your email verification and account security settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailVerificationBanner user={user} />
              <ResetPasswordBlock />
            </CardContent>
          </Card>
        </FadeIn>

        {/* Role selector */}
        <FadeIn delay={0.03}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="size-5 text-primary" /> {t('profile.role.title')}
              </CardTitle>
              <CardDescription>{t('profile.role.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(['candidate', 'employer', 'admin', 'md'] as Role[]).map(r => (
                  <button key={r} type="button" onClick={() => update('role', r)}
                    className={`text-left rounded-lg border p-4 transition-all ${
                      form.role === r ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40 hover:bg-accent/30'
                    }`}>
                    <p className="font-medium text-foreground">
                      {r === 'candidate' ? t('profile.role.candidate') : r === 'employer' ? t('profile.role.employer') : r === 'md' ? t('profile.role.md') : t('profile.role.admin')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r === 'candidate' ? t('profile.role.candidateDesc') : r === 'employer' ? t('profile.role.employerDesc') : r === 'md' ? t('profile.role.mdDesc') : t('profile.role.adminDesc')}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        {/* ─── ROLE-SPECIFIC SECTION — no cross-contamination ─── */}

        {/* ── ADMIN SECTION ── */}
        {currentRole === 'admin' && (
          <>
            <FadeIn delay={0.04}>
              <Card className="mb-6 border-primary/30 bg-primary/[0.03]">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                      <BadgeCheck className="size-4" />
                    </div>
                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[11px] font-semibold text-primary uppercase tracking-wide">
                      {t('profile.admin.badge')}
                    </span>
                  </div>
                  <CardDescription>{t('profile.admin.badgeDesc')}</CardDescription>
                </CardHeader>
              </Card>
            </FadeIn>

            <FadeIn delay={0.05}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="size-5 text-primary" /> {t('profile.admin.section.contact')}
                  </CardTitle>
                  <CardDescription>{t('profile.admin.section.contactDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t('profile.field.fullName')}</Label>
                      <Input id="fullName" value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="—" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('profile.field.email')}</Label>
                      <Input id="email" type="email" value={form.email} disabled className="opacity-60" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-muted-foreground" /> {t('profile.field.phone')}
                      </Label>
                      <Input id="phone" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+57 300 000 0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" /> {t('profile.field.location')}
                      </Label>
                      <Input id="location" value={form.location} onChange={e => update('location', e.target.value)} placeholder={t('postJob.company.locationPlaceholder')} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          </>
        )}

        {/* ── CANDIDATE SECTION: personal + career preferences ── */}
        {currentRole === 'candidate' && (
          <>
            <FadeIn delay={0.05}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="size-5 text-primary" /> {t('profile.personal.title')}
                  </CardTitle>
                  <CardDescription>{t('profile.personal.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t('profile.field.fullName')}</Label>
                      <Input id="fullName" value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="—" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('profile.field.email')}</Label>
                      <Input id="email" type="email" value={form.email} disabled className="opacity-60" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-muted-foreground" /> {t('profile.field.phone')}
                      </Label>
                      <Input id="phone" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+57 300 000 0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" /> {t('profile.field.location')}
                      </Label>
                      <Input id="location" value={form.location} onChange={e => update('location', e.target.value)} placeholder={t('postJob.company.locationPlaceholder')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">{t('profile.field.bio')}</Label>
                    <textarea id="bio" value={form.bio} onChange={e => update('bio', e.target.value)} placeholder="—" rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-y" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="source" className="flex items-center gap-1.5">{t('marketing.sourceLabel')}</Label>
                    <select id="source" value={source} onChange={e => setSource(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">—</option>{[['marketing.sourceLinkedIn','LinkedIn'],['marketing.sourceReddit','Reddit'],['marketing.sourceUniversity','University'],['marketing.sourceJobBoard','Job board'],['marketing.sourceReferral','Referral'],['marketing.sourceSearch','Search engine'],['marketing.sourceOther','Other']].map(([key, fallback]) => <option key={key} value={fallback}>{t(key)}</option>)}</select>
                  </div>
                  <div className="flex items-start gap-2 text-sm"><input id="consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required className="mt-1" /><label htmlFor="consent" className="text-muted-foreground">{t('marketing.consent')}</label></div>
                  <div className="space-y-2">
                    <Label htmlFor="languages" className="flex items-center gap-1.5">
                      <Globe className="size-3.5 text-muted-foreground" /> {t('profile.field.languages')}
                    </Label>
                    <Input id="languages" value={form.languages} onChange={e => update('languages', e.target.value)}
                      placeholder={locale === 'es' ? 'Espanol (Nativo), Ingles (C1), Frances (A2)' : 'Spanish (Native), English (C1), French (A2)'} />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* Career Preferences — candidate only */}
            <FadeIn delay={0.08}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="size-5 text-primary" /> {t('profile.candidate.section.career')}
                  </CardTitle>
                  <CardDescription>{t('profile.candidate.section.careerDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="skills">{t('profile.field.skills')}</Label>
                    <Input id="skills" value={form.skills} onChange={e => update('skills', e.target.value)} placeholder={t('profile.field.skillsPlaceholder')} />
                    <div className="flex flex-wrap gap-1.5" aria-label={t('profile.field.skills')}>
                      {form.skills.split(',').map(s => s.trim()).filter(Boolean).map(skill => <span key={skill} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{skill}</span>)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="positionTitle">{t('profile.field.positionTitle')}</Label>
                    <Input id="positionTitle" value={form.positionTitle} onChange={e => update('positionTitle', e.target.value)}
                      placeholder={t('profile.field.positionTitlePlaceholder')} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="yearsOfExperience" className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground" /> {t('profile.field.yearsOfExperience')}
                      </Label>
                      <select id="yearsOfExperience" value={form.yearsOfExperience} onChange={e => update('yearsOfExperience', e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                        <option value="">—</option><option value="0">0</option><option value="1">1–2</option><option value="3">3–5</option><option value="5">5–10</option><option value="10">10+</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="preferredLocation" className="flex items-center gap-1.5">
                        <Laptop className="size-3.5 text-muted-foreground" /> {t('profile.field.preferredLocationType')}
                      </Label>
                      <Input id="preferredLocation" value={form.preferredLocationType} onChange={e => update('preferredLocationType', e.target.value)}
                        placeholder={t('profile.field.preferredLocationTypePlaceholder')} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="desiredSalaryMin" className="flex items-center gap-1.5">
                        <DollarSign className="size-3.5 text-muted-foreground" /> {t('profile.field.desiredSalaryMin')} ({t('profile.field.salaryCurrency')}: USD/COP)
                      </Label>
                      <Input id="desiredSalaryMin" value={form.desiredSalaryMin} onChange={e => update('desiredSalaryMin', e.target.value)} placeholder="3.000.000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="desiredSalaryMax" className="flex items-center gap-1.5">
                        <DollarSign className="size-3.5 text-muted-foreground" /> {t('profile.field.desiredSalaryMax')} ({t('profile.field.salaryCurrency')}: USD/COP)
                      </Label>
                      <Input id="desiredSalaryMax" value={form.desiredSalaryMax} onChange={e => update('desiredSalaryMax', e.target.value)} placeholder="6.000.000" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* CV link — candidate only */}
            <FadeIn delay={0.1}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="size-5 text-primary" /> {t('profile.cv.title')}
                  </CardTitle>
                  <CardDescription>{t('profile.cv.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {form.cvUrl ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-center h-10 w-10 shrink-0 rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {(() => {
                            try {
                              const url = new URL(form.cvUrl)
                              const pathname = decodeURIComponent(url.pathname)
                              return pathname.split('/').pop() || 'CV'
                            } catch { return form.cvUrl.split('/').pop() || 'CV' }
                          })()}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href={form.cvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                          >
                            View CV <ArrowUpRight className="size-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => update('cvUrl', '')}
                            className="text-xs text-muted-foreground hover:text-destructive underline underline-offset-2 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={uploadingCv}
                          onClick={() => cvInputRef.current?.click()}
                        >
                          {uploadingCv ? (
                            <><span className="inline-block size-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />Uploading...</>
                          ) : (
                            <><Upload className="size-3.5" />Upload CV</>
                          )}
                        </Button>
                        <span className="text-xs text-muted-foreground">PDF, DOC, DOCX — max 10 MB</span>
                      </div>
                      <input
                        ref={cvInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="sr-only"
                        onChange={e => { const file = e.target.files?.[0]; if (file) handleCvFile(file); e.target.value = '' }}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="cvUrl">{t('profile.field.cvUrl')}</Label>
                        <Input id="cvUrl" value={form.cvUrl} onChange={e => update('cvUrl', e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('profile.cv.uploadNote')}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </FadeIn>
          </>
        )}

        {/* ── EMPLOYER SECTION: personal + company affiliation ── */}
        {currentRole === 'employer' && (
          <>
            <FadeIn delay={0.05}>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="size-5 text-primary" /> {t('profile.personal.title')}
                  </CardTitle>
                  <CardDescription>{t('profile.personal.desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t('profile.field.fullName')}</Label>
                      <Input id="fullName" value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="—" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t('profile.field.email')}</Label>
                      <Input id="email" type="email" value={form.email} disabled className="opacity-60" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-1.5">
                        <Phone className="size-3.5 text-muted-foreground" /> {t('profile.field.phone')}
                      </Label>
                      <Input id="phone" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+57 300 000 0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location" className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground" /> {t('profile.field.location')}
                      </Label>
                      <Input id="location" value={form.location} onChange={e => update('location', e.target.value)} placeholder={t('postJob.company.locationPlaceholder')} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="positionTitle">{t('profile.field.positionTitle')}</Label>
                    <Input id="positionTitle" value={form.positionTitle} onChange={e => update('positionTitle', e.target.value)}
                      placeholder={t('profile.field.positionTitlePlaceholder')} />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            {/* Company affiliation — employer only */}
            <FadeIn delay={0.08}>
              <EmployerCompanyCard employerId={user?.id ?? ''} companyId={profile ? '' : undefined} />
            </FadeIn>
            <FadeIn delay={0.1}>
              <Card className="mb-6">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Video className="size-5 text-primary" /> {t('profile.employer.meeting.title')}</CardTitle><CardDescription>{t('profile.employer.meeting.desc')}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="meetingProvider">{t('profile.employer.meeting.providerLabel')}</Label><select id="meetingProvider" value={form.meetingProvider} onChange={e => update('meetingProvider', e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">{t('profile.employer.meeting.providerPlaceholder')}</option><option value="zoom">Zoom</option><option value="meet">Google Meet</option><option value="teams">Microsoft Teams</option><option value="manual">Manual</option></select></div>
                  <div className="space-y-2"><Label htmlFor="meetingLink">{t('profile.employer.meeting.linkLabel')}</Label><Input id="meetingLink" type="url" value={form.meetingLink} onChange={e => update('meetingLink', e.target.value)} placeholder={t('profile.employer.meeting.linkPlaceholder')} /></div>
                </CardContent>
              </Card>
            </FadeIn>
          </>
        )}

        {/* ── Notification preferences (all roles) ── */}
        <FadeIn delay={0.12}>
          <NotificationPrefsCard
            profile={profile ?? null}
            updateProfile={updateProfile}
            t={t}
          />
        </FadeIn>
        {/* ── Save button row ── */}
        <FadeIn delay={0.15}>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSave} size="lg" disabled={isPending} className="gap-2 font-medium">
              {isPending ? (
                <>{t('common.loading')}</>
              ) : savedFlag ? (
                <><CheckCircle2 className="size-4" />{t('profile.saved')}</>
              ) : (
                <><Save className="size-4" />{profile ? t('profile.save') : t('profile.create')}</>
              )}
            </Button>
            {savedFlag && (
              <span className="text-sm text-primary font-medium animate-fade-in">{t('profile.savedToast')}</span>
            )}
            {!profile && !isLoading && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <AlertCircle className="size-3.5" />{t('profile.notInDb')}
              </span>
            )}
          </div>
        </FadeIn>
      </div>
    </AuthGate>
  )
}

/* ── Employer company card — shown inside EMPLOYER profile only ── */
function EmployerCompanyCard({ employerId, companyId: _companyId }: { employerId: string; companyId?: string }) {
  const { t } = useI18n()
  const { data: company, isLoading } = useCompany(employerId)

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8">
          <div className="h-16 rounded bg-muted animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!company) {
    return (
      <Card className="mb-6 border-amber-500/30 bg-amber-500/[0.03]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="size-5 text-amber-600" /> {t('profile.employer.section.company')}
          </CardTitle>
          <CardDescription>{t('profile.employer.section.companyDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t('dashboard.noCompany')}</p>
            </div>
            <Button size="sm" asChild>
              <Link to="/employer/post-job"><PlusCircle className="size-3.5 mr-1.5" />{t('dashboard.registerCompany')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="size-5 text-primary" /> {t('profile.employer.section.company')}
        </CardTitle>
        <CardDescription>{t('profile.employer.section.companyDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-center h-12 w-12 shrink-0 rounded-lg bg-primary/10 text-primary font-bold text-lg font-serif">
            {company.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{company.name}</p>
            {company.industry && <p className="text-sm text-muted-foreground">{company.industry}{company.size ? ` · ${company.size}` : ''}</p>}
            {company.location && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="size-3" />{company.location}</p>}
          </div>
          <Button variant="outline" size="sm" asChild className="shrink-0 gap-1.5">
            <Link to="/dashboard">{t('profile.employer.companyLink')}<ArrowUpRight className="size-3.5" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
