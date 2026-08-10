import { createFileRoute, Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { useI18n } from '@/i18n/I18nProvider'

export const Route = createFileRoute('/candidate/create-account')({
  component: CandidateCreateAccountPage,
})

function CandidateCreateAccountPage() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-gradient-to-br from-background via-muted/30 to-primary/5 px-4 py-10">
      <Card className="w-full max-w-md overflow-hidden rounded-2xl border-border/70 text-center shadow-2xl shadow-primary/10">
        <CardHeader className="bg-gradient-to-b from-primary/10 to-transparent pb-5">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <BrandMark className="size-14 rounded-2xl shadow-lg" title={t('brand.name')} />
          </div>
          <CardTitle className="font-serif text-xl">{t('auth.candidateSignInTitle')}</CardTitle>
          <CardDescription>{t('auth.candidateSignInDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button asChild size="lg" className="w-full">
            <Link to="/candidate?mode=signIn">{t('auth.signInTab')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link to="/candidate" search={{ mode: 'signUp' }}>{t('auth.signUpTab')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
