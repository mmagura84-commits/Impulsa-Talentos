import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { AuthGate } from '@/components/AuthGate'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuth } from '@/hooks/useAuth'
import { ArrowLeft, LogIn, UserPlus } from 'lucide-react'

export const Route = createFileRoute('/candidate/create-account')({
  component: CandidateCreateAccountPage,
})

function RedirectToCandidate() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate({ to: '/candidate', replace: true })
  }, [navigate])
  return null
}

function CandidateCreateAccountPage() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading } = useAuth()
  const [mode, setMode] = useState<'choose' | 'signIn' | 'signUp'>('choose')
  const navigate = useNavigate()

  // If already authenticated, redirect to candidate dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: '/candidate', replace: true })
    }
  }, [isLoading, isAuthenticated, navigate])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
      </div>
    )
  }

  if (isAuthenticated) return null

  if (mode !== 'choose') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/5 px-4 py-10">
        <div className="w-full max-w-md">
          <button
            type="button"
            onClick={() => setMode('choose')}
            className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </button>
          <AuthGate
            initialMode={mode}
            showModeTabs={false}
            signupRedirectPath="/profile"
            fallbackKey={mode === 'signIn' ? 'auth.candidateSignInPageTitle' : 'auth.candidateCreateAccountPageTitle'}
            fallbackDescKey={mode === 'signIn' ? 'auth.candidateSignInPageDesc' : 'auth.candidateCreateAccountPageDesc'}
          >
            {mode === 'signIn' ? <RedirectToCandidate /> : null}
          </AuthGate>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/5 px-4 py-10">
      <Card className="w-full max-w-md overflow-hidden rounded-2xl border-border/70 text-center shadow-2xl shadow-primary/10">
        <CardHeader className="bg-gradient-to-b from-primary/10 to-transparent pb-5">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <BrandMark className="size-14 rounded-2xl shadow-lg" title={t('brand.name')} />
          </div>
          <CardTitle className="font-serif text-xl">{t('auth.candidateEntryTitle')}</CardTitle>
          <CardDescription>{t('auth.candidateEntryDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => setMode('signIn')}
          >
            <LogIn className="size-5" />
            {t('auth.signInTab')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            onClick={() => setMode('signUp')}
          >
            <UserPlus className="size-5" />
            {t('auth.signUpTab')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
