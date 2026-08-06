import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle2, Loader2, LogIn, Lock } from 'lucide-react'
import { useI18n } from '@/i18n/I18nProvider'
import { LanguageToggle } from '@/components/LanguageToggle'
import { BrandMark } from '@/components/BrandMark'
import { ResetPassword } from '@/components/ResetPassword'
import type { ReactNode } from 'react'

interface AuthGateProps {
  children: ReactNode
  /** Translation key for the fallback title. */
  fallbackKey?: string
  /** Translation key for the fallback description. */
  fallbackDescKey?: string
  /** Optional raw override (takes priority over the key). */
  fallbackMessage?: string
  fallbackDescription?: string
}

function AuthGateInner({ children, fallbackKey, fallbackDescKey, fallbackMessage, fallbackDescription }: AuthGateProps) {
  const { isAuthenticated, isLoading, sendMagicLink, signInWithPassword, signUpWithPassword } = useAuth()
  const { t } = useI18n()
  const [showReset, setShowReset] = useState(false)
  const [usePassword, setUsePassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    setErrorMsg('')
    try {
      const returnPath = window.location.pathname + window.location.search
      await sendMagicLink(email.trim(), window.location.origin + returnPath)
      setSent(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send the link')
    } finally {
      setSending(false)
    }
  }

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || sending) return
    setSending(true)
    setErrorMsg('')
    try {
      if (authMode === 'signUp') {
        const result = await signUpWithPassword(email.trim(), password, window.location.origin + '/employer')
        if (!result.data.session) setSent(true)
      } else {
        await signInWithPassword(email.trim(), password)
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid email or password')
    } finally {
      setSending(false)
    }
  }

  if (!isAuthenticated) {
    if (showReset) {
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <ResetPassword onBack={() => setShowReset(false)} />
        </div>
      )
    }

    const title = fallbackMessage ?? (fallbackKey ? t(fallbackKey) : t('auth.signInTitle'))
    const desc = fallbackDescription ?? (fallbackDescKey ? t(fallbackDescKey) : t('auth.signInDescription'))
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <Card className="max-w-md w-full text-center border-border shadow-lg">
          <CardHeader className="pb-4">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <BrandMark className="size-12 rounded-lg" title={t('brand.name')} />
            </div>
            <CardTitle className="font-serif text-xl">
              {title}
            </CardTitle>
            <CardDescription>{desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('auth.modeLabel')}>
              {(['signIn', 'signUp'] as const).map(mode => (
                <button key={mode} type="button" role="tab" aria-selected={authMode === mode}
                  onClick={() => { setAuthMode(mode); setErrorMsg(''); setSent(false) }}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t(mode === 'signUp' ? 'auth.signUpTab' : 'auth.signInTab')}
                </button>
              ))}
            </div>
            {!usePassword && sent ? (
              <>
                <div className="flex flex-col items-center gap-2 py-2">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                  <p className="text-sm font-medium text-foreground">Check your email</p>
                  <p className="text-xs text-muted-foreground">
                    We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
                    Open it to continue.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={sending}
                  onClick={handleMagicLink}
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                  Resend link
                </Button>
              </>
            ) : usePassword ? (
              <form onSubmit={handlePassword} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrorMsg('') }}
                    placeholder="you@example.com"
                    className="pl-9 text-center"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setErrorMsg('') }}
                    placeholder="Password"
                    className="pl-9 text-center"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {errorMsg && (
                  <p className="text-xs text-destructive">{errorMsg}</p>
                )}
                <Button type="submit" size="lg" disabled={sending || !email.trim() || !password} className="w-full gap-2 font-medium">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {sending ? t('auth.signingIn') : t('auth.signInWithPassword')}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setErrorMsg('') }}
                    placeholder="you@example.com"
                    className="pl-9 text-center"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                {errorMsg && (
                  <p className="text-xs text-destructive">{errorMsg}</p>
                )}
                <Button type="submit" size="lg" disabled={sending || !email.trim()} className="w-full gap-2 font-medium">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {sending ? t('auth.sending') : t('auth.signInCta')}
                </Button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setUsePassword(!usePassword); setSent(false); setErrorMsg('') }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {usePassword ? t('auth.sendMagicInstead') : t('auth.signInPasswordInstead')}
            </button>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer block"
            >
              {t('auth.forgotPassword')}
            </button>
            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">{t('auth.orContinueWith')}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => signInWithGoogle()}>
                <svg className="size-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => signInWithApple()}>
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Apple
              </Button>
            </div>
            <div className="flex justify-center pt-1">
              <LanguageToggle compact />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}

export function AuthGate({ children, fallbackKey, fallbackDescKey, fallbackMessage, fallbackDescription }: AuthGateProps) {
  return (
    <BlinkClientBoundary
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
        </div>
      }
    >
      <AuthGateInner
        fallbackKey={fallbackKey}
        fallbackDescKey={fallbackDescKey}
        fallbackMessage={fallbackMessage}
        fallbackDescription={fallbackDescription}
      >
        {children}
      </AuthGateInner>
    </BlinkClientBoundary>
  )
}
