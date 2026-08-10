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
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    // Supabase recovery links arrive either as ?token_hash=…&type=recovery
    // (PKCE) or as a #access_token fragment that supabase-js exchanges when
    // detectSessionInUrl is enabled. Keep the page in a bounded loading state
    // while that exchange completes instead of racing getSession().
    if (typeof window === 'undefined') return
    let active = true
    let settled = false
    const finish = (next: 'ready' | 'error', message?: string) => {
      if (!active || settled) return
      settled = true
      if (next === 'ready') setReady(true)
      else {
        setStatus('error')
        setErrorMsg(message || t('reset.invalidDesc'))
      }
    }
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const hashError = hash.get('error_description') || hash.get('error')
    if (hashError) finish('error', decodeURIComponent(hashError.replace(/\\+/g, ' ')))
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    let timer: ReturnType<typeof setTimeout> | undefined
    if (!hashError && tokenHash) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        .then(({ error }) => {
          if (error) finish('error', error.message)
          else finish('ready')
        })
        .catch(() => finish('error'))
    } else if (!hashError) {
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) finish('ready')
      })
      supabase.auth.getSession().then(({ data, error }) => {
        if (data.session) finish('ready')
        else if (error) finish('error', error.message)
      }).catch(() => finish('error'))
      timer = setTimeout(() => finish('error'), 5000)
      return () => {
        active = false
        if (timer) clearTimeout(timer)
        sub.subscription.unsubscribe()
      }
    }
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [t])

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
