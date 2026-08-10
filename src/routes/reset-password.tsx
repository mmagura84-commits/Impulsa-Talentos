import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
import { BrandMark } from '@/components/BrandMark'
import {
  Key,
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'

export const Route = createFileRoute('/reset-password')({
  head: () => ({
    meta: [{ title: 'Reset Password — Impulsa Talentos' }],
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { t } = useI18n()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'request' | 'loading' | 'sent' | 'done' | 'error'>('request')
  const [email, setEmail] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Supabase recovery link arrives either as ?token_hash=…&type=recovery
    // (PKCE) or as a #access_token fragment that supabase-js detects and
    // exchanges automatically (detectSessionInUrl: true).
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const authError = params.get('error_description') ?? params.get('error')
    if (authError) {
      setStatus('error')
      setErrorMsg(authError)
      return
    }
    // A plain visit is the password-recovery request entry point. Only links
    // carrying recovery state should attempt to exchange a session.
    if (!tokenHash && !window.location.hash) {
      setStatus('request')
      return
    }
    let settled = false
    const markSession = (session: { user?: unknown } | null) => {
      if (settled) return
      if (session) {
        settled = true
        setReady(true)
        setStatus('loading')
      }
    }
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') markSession(session)
    })
    if (tokenHash) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error }) => {
          if (error) { setStatus('error'); setErrorMsg(error.message); return }
          markSession({ user: {} })
        })
        .catch((error: unknown) => {
          setStatus('error')
          setErrorMsg(error instanceof Error ? error.message : t('reset.invalid'))
        })
    } else {
      // Hash sessions may arrive asynchronously; only fail after checking
      // both the current session and auth events rather than racing them.
      supabase.auth.getSession().then(({ data, error }) => {
        if (error) { setStatus('error'); setErrorMsg(error.message); return }
        if (data.session) markSession(data.session)
        else window.setTimeout(() => { if (!settled) { setStatus('error'); setErrorMsg(t('reset.invalidDesc')) } }, 1500)
      }).catch((error: unknown) => {
        setStatus('error')
        setErrorMsg(error instanceof Error ? error.message : t('reset.invalid'))
      })
    }
    return () => subscription.subscription.unsubscribe()
  }, [t])

  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault()
    const normalized = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return
    setStatus('loading')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
      })
      if (error) throw error
      setStatus('sent')
      toast.success(t('reset.requestSent'))
    } catch (error) {
      setStatus('error')
      setErrorMsg(error instanceof Error ? error.message : t('reset.requestError'))
    }
  }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!ready || !password.trim()) return
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters')
      setStatus('error')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setStatus('done')
      toast.success(t('reset.success'))
      // Redirect to dashboard after a moment
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2500)
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : t('reset.invalid')
      setErrorMsg(msg)
    }
  }

  if (status === 'request') {
    return (
      <div className="flex items-center justify-center min-h-dvh px-4">
        <Card className="max-w-md w-full border-border shadow-lg">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex items-center justify-center"><BrandMark className="size-12 rounded-lg" title={t('brand.name')} /></div>
            <CardTitle className="font-serif text-xl text-center">{t('reset.requestTitle')}</CardTitle>
            <CardDescription className="text-center">{t('reset.requestDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="reset-email">{t('reset.emailLabel')}</Label><Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus autoComplete="email" /></div>
              <Button type="submit" disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} className="w-full gap-2"><Mail className="size-4" />{t('reset.send')}</Button>
            </form>
            <div className="mt-4 text-center"><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">{t('reset.back')}</Link></div>
          </CardContent>
        </Card>
      </div>
    )
  }
  if (status === 'sent') {
    return (
      <div className="flex items-center justify-center min-h-dvh px-4"><Card className="max-w-md w-full border-border shadow-lg"><CardHeader className="text-center"><div className="mx-auto mb-4 flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-7" /></div><CardTitle className="font-serif text-xl">{t('reset.requestSent')}</CardTitle><CardDescription>{t('reset.requestDescription')}</CardDescription></CardHeader><CardContent className="text-center"><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">{t('reset.back')}</Link></CardContent></Card></div>
    )
  }
  if (status === 'done') {
    return (
      <div className="flex items-center justify-center min-h-dvh px-4">
        <Card className="max-w-md w-full border-border shadow-lg">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-4 flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-7" />
            </div>
            <CardTitle className="font-serif text-xl">Password reset</CardTitle>
            <CardDescription>
              Your password has been updated. Redirecting to your dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            <Button asChild className="gap-2 font-medium">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-dvh px-4">
      <Card className="max-w-md w-full border-border shadow-lg">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <BrandMark className="size-12 rounded-lg" title={t('brand.name')} />
          </div>
          <CardTitle className="font-serif text-xl text-center">Create a new password</CardTitle>
          <CardDescription className="text-center">
            Choose a strong password — at least 8 characters with letters and numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Checking reset link…
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg || t('reset.invalidDesc')}</span>
            </div>
          )}
          {status !== 'error' && ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">{t('reset.newPassword')}</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('reset.minChars')}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
                    className="pl-9 pr-9"
                    required
                    autoFocus
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={status === 'loading' || password.length < 8} className="w-full gap-2 font-medium">
                {status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : <Key className="size-4" />}
                {status === 'loading' ? 'Updating...' : 'Reset password'}
              </Button>
            </form>
          ) : null}

          <div className="mt-4 text-center">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-3.5" />
              Back to home
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
