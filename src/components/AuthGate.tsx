import { getAttribution } from '@/lib/marketing'
import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { getOnboardingIntent, setOnboardingIntent, type OnboardingIntent } from '@/lib/intent'
import { useAuth } from '@/hooks/useAuth'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, CheckCircle2, Loader2, LogIn, Lock, User, Search, Briefcase } from 'lucide-react'
import { passwordProblem } from '@/lib/passwordPolicy'
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
  /** Show a sign-in-ONLY gate (no sign-up tab). Used for owner-provisioned
   *  lanes like the Managing Director workspace, where accounts are assigned
   *  by the owner rather than self-created. */
  signUpDisabled?: boolean
}

/** Which side someone is signing up for, guessed from where they are. */
function laneFromLocation(): OnboardingIntent | null {
  if (typeof window === 'undefined') return null
  const p = window.location.pathname
  if (/^\/(employer|for-employers|pricing)/.test(p)) return 'employer'
  if (/^\/(candidate|jobs|apply|companies)/.test(p)) return 'candidate'
  return getOnboardingIntent()
}
function startsInSignUp(): boolean {
  if (typeof window === 'undefined') return false
  // The router may JSON-encode search values (?signup=%221%22), so accept both.
  return (new URLSearchParams(window.location.search).get('signup') ?? '').replace(/"/g, '') === '1'
}

function AuthGateInner({ children, fallbackKey, fallbackDescKey, fallbackMessage, fallbackDescription, signUpDisabled }: AuthGateProps) {
  const { isAuthenticated, isLoading, signInWithPassword, signUpWithPassword, resendVerificationEmail, signInWithGoogle } = useAuth()
  const [googleBusy, setGoogleBusy] = useState(false)
  const { t, locale } = useI18n()
  const [showReset, setShowReset] = useState(false)
  // Password-only auth (owner decision 2026-08-11): magic-link/passwordless
  // sign-in is out of scope and was REMOVED from the UI — the password form
  // is THE form. No mode toggle, no second flow.
  const [email, setEmail] = useState('')
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)
  // True after sign-up when no session was returned → email-CONFIRM
  // interstitial (signup confirmation, NOT magic-link sign-in).
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const clearError = () => { setErrorMsg(''); setErrorKey(null) }
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>(() => (startsInSignUp() ? 'signUp' : 'signIn'))
  // One front door: role, name and consent are asked here, so the profile is
  // created with the account (migration 043) and nobody has to find the
  // Profile page before the site works for them.
  const [signUpRole, setSignUpRole] = useState<OnboardingIntent | null>(() => laneFromLocation())
  const [fullName, setFullName] = useState('')
  const [dataConsent, setDataConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  // When sign-up is disabled (owner-provisioned lanes) force sign-in mode.
  const effectiveMode = signUpDisabled ? ('signIn' as const) : authMode

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  const handlePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!validEmail || !password || sending) return
    // New passwords must meet the policy; existing ones are never re-checked.
    const problem = effectiveMode === 'signUp'
      ? (!signUpRole ? 'auth.chooseRole'
        : !fullName.trim() ? 'profile.nameRequired'
        : passwordProblem(password) ?? (!dataConsent ? 'privacy.authorizationRequired' : null))
      : null
    if (problem) {
      setErrorKey(problem)
      setErrorMsg('')
      return
    }
    setSending(true)
    clearError()
    try {
      if (effectiveMode === 'signUp') {
        // Preserve the lane where signup started (candidate, employer, etc.) so
        // email confirmation returns to the correct role-gated route.
        const returnPath = window.location.pathname + window.location.search
        if (signUpRole) setOnboardingIntent(signUpRole)
        const result = await signUpWithPassword(email.trim(), password, window.location.origin + returnPath, {
          locale,
          role: signUpRole ?? 'candidate',
          full_name: fullName.trim(),
          data_consent: dataConsent,
          marketing_consent: marketingConsent,
          // First-touch campaign tags → profiles.signup_attribution (migration 047).
          attribution: JSON.stringify(getAttribution()),
        })
        if (result.error) {
          // supabase-js v2 returns { data, error } on HTTP 4xx instead of
          // throwing — surface the failure instead of silently falling
          // through to the "check your email" state.
          setErrorMsg(t('auth.signUpFailed'))
        } else if (!result.data.session) {
          setSent(true)
        }
      } else {
        const result = await signInWithPassword(email.trim(), password)
        if (result.error) {
          // supabase-js v2 returns { data, error } on invalid credentials
          // (HTTP 400) instead of throwing — without this check the form
          // stayed silent (QA: silent auth failure UX).
          setErrorMsg(t('auth.invalidCredentials'))
        }
      }
    } catch {
      // Network-level failures (fetch throws) — same friendly message.
      setErrorMsg(t('auth.invalidCredentials'))
    } finally {
      setSending(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!validEmail || sending) return
    setSending(true)
    clearError()
    try {
      const returnPath = window.location.pathname + window.location.search
      const result = await resendVerificationEmail(email.trim(), window.location.origin + returnPath)
      if (result.error) setErrorMsg(t('auth.signUpFailed'))
    } catch {
      setErrorMsg(t('auth.signUpFailed'))
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

    // The Create account tab always says so; page-specific wording is for sign-in.
    const title = effectiveMode === 'signUp' ? t('auth.signUpTitle') : fallbackMessage ?? (fallbackKey ? t(fallbackKey) : t('auth.signInTitle'))
    const desc = effectiveMode === 'signUp' ? t('auth.signUpDescription') : fallbackDescription ?? (fallbackDescKey ? t(fallbackDescKey) : t('auth.signInDescription'))
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4 py-10 bg-secondary">
        <Card className="max-w-md w-full text-center rounded-xl overflow-hidden">
          <CardHeader className="pb-5">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <BrandMark className="size-14 rounded-xl" title={t('brand.name')} />
            </div>
            <CardTitle className="font-serif text-xl">
              {title}
            </CardTitle>
            <CardDescription>{desc}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!signUpDisabled && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label={t('auth.modeLabel')}>
                {(['signIn', 'signUp'] as const).map(mode => (
                  <button key={mode} type="button" role="tab" aria-selected={authMode === mode}
                    onClick={() => { setAuthMode(mode); clearError(); setSent(false) }}
                    className={`rounded-md px-3 py-2 text-sm font-medium ${authMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {t(mode === 'signUp' ? 'auth.signUpTab' : 'auth.signInTab')}
                  </button>
                ))}
              </div>
            )}
            {sent && authMode === 'signUp' ? (
              <>
                <div className="flex flex-col items-center gap-2 py-2">
                  <CheckCircle2 className="size-8 text-emerald-600" />
                  <p className="text-sm font-medium text-foreground">{t('auth.checkEmail')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('auth.signUpConfirmationSent', { email })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={sending}
                  onClick={handleResendConfirmation}
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                  {t('auth.resendLink')}
                </Button>
              </>
            ) : (
              <form onSubmit={handlePassword} className="space-y-3">
                {effectiveMode === 'signUp' && (
                  <fieldset className="space-y-2 text-left">
                    <legend className="mb-2 text-sm font-medium text-foreground">{t('auth.roleQuestion')}</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([['candidate', Search, 'auth.roleCandidate', 'auth.roleCandidateHint'], ['employer', Briefcase, 'auth.roleEmployer', 'auth.roleEmployerHint']] as const).map(([r, Icon, label, hint]) => (
                        <button key={r} type="button" aria-pressed={signUpRole === r}
                          onClick={() => { setSignUpRole(r); clearError() }}
                          className={`flex min-h-20 flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${signUpRole === r ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'border-border hover:border-primary/50'}`}>
                          <Icon className="size-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{t(label)}</span>
                          <span className="text-xs text-muted-foreground">{t(hint)}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                {effectiveMode === 'signUp' && (
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      value={fullName}
                      onChange={e => { setFullName(e.target.value); clearError() }}
                      placeholder={t('auth.fullNamePlaceholder')}
                      aria-label={t('auth.fullNamePlaceholder')}
                      className="pl-9 text-center"
                      maxLength={120}
                      autoComplete="name"
                    />
                  </div>
                )}
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
                    autoComplete={effectiveMode === 'signUp' ? 'new-password' : 'current-password'}
                  />
                </div>
                {effectiveMode === 'signUp' && !(errorMsg || errorKey) && (
                  <p className="text-xs text-muted-foreground">{t('auth.passwordRule')}</p>
                )}
                {effectiveMode === 'signUp' && (
                  <div className="space-y-2 text-left text-xs">
                    <label htmlFor="signup-data-consent" className="flex items-start gap-2 text-foreground">
                      <input id="signup-data-consent" type="checkbox" checked={dataConsent} onChange={e => { setDataConsent(e.target.checked); clearError() }} className="mt-0.5" />
                      <span>{t('privacy.authorization')} <Link to="/privacy" className="text-primary underline">{t('privacy.policyLink')}</Link></span>
                    </label>
                    <label htmlFor="signup-marketing" className="flex items-start gap-2 text-muted-foreground">
                      <input id="signup-marketing" type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} className="mt-0.5" />
                      <span>{t('marketing.consent')} ({t('privacy.optional')})</span>
                    </label>
                  </div>
                )}
                {(errorMsg || errorKey) && (
                  <p className="text-xs text-destructive">{errorKey ? t(errorKey) : errorMsg}</p>
                )}
                <Button type="submit" size="lg" disabled={sending || !validEmail || !password} className="w-full gap-2 font-medium">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  {sending ? (authMode === 'signUp' ? t('auth.signingUp') : t('auth.signingIn')) : (authMode === 'signUp' ? t('auth.signUpCta') : t('auth.signInWithPassword'))}
                </Button>
              </form>
            )}
            {/* Google: one tap, no confirmation email. On "Create account" the
                same role choice and data-processing consent apply first. */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{t('auth.or')}<span className="h-px flex-1 bg-border" /></div>
              <Button type="button" variant="outline" size="lg" className="w-full gap-2 font-medium"
                disabled={googleBusy || (authMode === 'signUp' && !dataConsent)}
                onClick={async () => {
                  if (authMode === 'signUp') {
                    if (!dataConsent) { setErrorKey('privacy.authorizationRequired'); setErrorMsg(''); return }
                    if (signUpRole) setOnboardingIntent(signUpRole)
                  }
                  setGoogleBusy(true)
                  const { error } = await signInWithGoogle(window.location.origin + window.location.pathname + window.location.search)
                  if (error) { setGoogleBusy(false); setErrorKey(''); setErrorMsg(t('auth.googleFailed')) }
                }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
                {googleBusy ? t('common.loading') : t('auth.continueWithGoogle')}
              </Button>
              {authMode === 'signUp' && !dataConsent && <p className="text-xs text-muted-foreground">{t('auth.googleConsentFirst')}</p>}
            </div>
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

export function AuthGate({ children, fallbackKey, fallbackDescKey, fallbackMessage, fallbackDescription, signUpDisabled }: AuthGateProps) {
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
        signUpDisabled={signUpDisabled}
      >
        {children}
      </AuthGateInner>
    </BlinkClientBoundary>
  )
}
