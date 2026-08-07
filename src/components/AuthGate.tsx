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
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const clearError = () => { setErrorMsg(''); setErrorKey(null) }
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn')

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
      setErrorKey(null); setErrorMsg(err instanceof Error ? err.message : t('auth.error.sendLink'))
    } finally {
      setSending(false)
    }
  }

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password || sending) return
    if (password.length < 8) {
      setErrorKey('auth.passwordTooShort')
      setErrorMsg('')
      return
    }
    setSending(true)
    clearError()
    try {
      if (authMode === 'signUp') {
        // Preserve the lane where signup started (candidate, employer, etc.) so
        // email confirmation returns to the correct role-gated route.
        const returnPath = window.location.pathname + window.location.search
        const result = await signUpWithPassword(email.trim(), password, window.location.origin + returnPath)
        if (!result.data.session) setSent(true)
      } else {
        await signInWithPassword(email.trim(), password)
      }
    } catch (err) {
      setErrorMsg(t('auth.invalidCredentials'))
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

    const title = fallbackMessage ?? (fallbackKey ? t(fallbackKey) : t(authMode === 'signUp' ? 'auth.signUpTitle' : 'auth.signInTitle'))
    const desc = fallbackDescription ?? (fallbackDescKey ? t(fallbackDescKey) : t(authMode === 'signUp' ? 'auth.signUpDescription' : 'auth.signInDescription'))
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4 py-10 bg-gradient-to-br from-background via-muted/30 to-primary/5">
        <Card className="max-w-md w-full text-center border-border/70 shadow-2xl shadow-primary/10 rounded-2xl overflow-hidden">
          <CardHeader className="pb-5 bg-gradient-to-b from-primary/10 to-transparent">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <BrandMark className="size-14 rounded-2xl shadow-lg" title={t('brand.name')} />
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
                  onClick={() => { setAuthMode(mode); clearError(); setSent(false) }}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                  {t(mode === 'signUp' ? 'auth.signUpTab' : 'auth.signInTab')}
                </button>
              ))}
            </div>
            {!usePassword && sent ? (
              <>
                <div className="flex flex-col items-center gap-2 py-2">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                  <p className="text-sm font-medium text-foreground">{t('auth.checkEmail')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('auth.magicLinkSent', { email })}
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
                  {t('auth.resendLink')}
                </Button>
              </>
            ) : usePassword ? (
              <form onSubmit={handlePassword} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError() }}
                    placeholder={t('auth.emailPlaceholder')}
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
                    onChange={e => { setPassword(e.target.value); clearError() }}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="pl-9 text-center"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {(errorMsg || errorKey) && (
                  <p className="text-xs text-destructive">{errorKey ? t(errorKey) : errorMsg}</p>
                )}
                <Button type="submit" size="lg" disabled={sending || !email.trim() || !password} className="w-full gap-2 font-medium">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {sending ? (authMode === 'signUp' ? t('auth.signingUp') : t('auth.signingIn')) : (authMode === 'signUp' ? t('auth.signUpCta') : t('auth.signInWithPassword'))}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); clearError() }}
                    placeholder={t('auth.emailPlaceholder')}
                    className="pl-9 text-center"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                {(errorMsg || errorKey) && (
                  <p className="text-xs text-destructive">{errorKey ? t(errorKey) : errorMsg}</p>
                )}
                <Button type="submit" size="lg" disabled={sending || !email.trim()} className="w-full gap-2 font-medium">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {sending ? (authMode === 'signUp' ? t('auth.signingUpWithEmail') : t('auth.sending')) : (authMode === 'signUp' ? t('auth.signUpMagicLinkCta') : t('auth.signInCta'))}
                </Button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setUsePassword(!usePassword); setSent(false); clearError() }}
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
