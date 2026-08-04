import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
import { BrandMark } from '@/components/BrandMark'
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

interface ResetPasswordProps {
  onBack: () => void
}

export function ResetPassword({ onBack }: ResetPasswordProps) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : undefined,
      })
      setStatus('sent')
      toast.success('Reset link sent to your email')
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setErrorMsg(msg)
      // eslint-disable-next-line no-console
      console.warn('[reset-password]', err)
    }
  }

  if (status === 'sent') {
    return (
      <Card className="max-w-md w-full border-border shadow-lg">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-4 flex items-center justify-center h-14 w-14 rounded-full bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-7" />
          </div>
          <CardTitle className="font-serif text-xl">Email sent</CardTitle>
          <CardDescription>
            If an account exists for <span className="font-medium text-foreground">{email}</span>, we sent a password reset link. Check your inbox and spam folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <Button variant="outline" size="sm" onClick={() => { setStatus('idle'); setEmail('') }} className="gap-1.5">
            Send again
          </Button>
          <br />
          <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-md w-full border-border shadow-lg">
      <CardHeader className="pb-4">
        <div className="mx-auto mb-4 flex items-center justify-center">
          <BrandMark className="size-12 rounded-lg" title={t('brand.name')} />
        </div>
        <CardTitle className="font-serif text-xl text-center">Reset your password</CardTitle>
        <CardDescription className="text-center">
          Enter the email address associated with your account and we'll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reset-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-9"
                required
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          {status === 'error' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <Button type="submit" disabled={status === 'loading' || !email.trim()} className="w-full gap-2 font-medium">
            {status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {status === 'loading' ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </button>
        </div>
      </CardContent>
    </Card>
  )
}