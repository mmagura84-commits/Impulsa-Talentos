import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle2, Loader2, LogIn } from 'lucide-react'
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
  const { isAuthenticated, isLoading, sendMagicLink } = useAuth()
  const { t } = useI18n()
  const [showReset, setShowReset] = useState(false)
  const [email, setEmail] = useState('')
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
      await sendMagicLink(email.trim())
      setSent(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not send the link')
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
            {sent ? (
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
                  {sending ? 'Sending…' : t('auth.signInCta')}
                </Button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Forgot your password?
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
