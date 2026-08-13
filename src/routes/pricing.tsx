import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
import { JOB_PACKAGES } from '@/lib/pricing'
import { PublicHeader } from '@/components/PublicHeader'
import { LeadCaptureForm } from '@/components/LeadCaptureForm'
import { useAuth } from '@/hooks/useAuth'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
  head: () => ({
    meta: [
      { title: 'Pricing — Post Jobs on Impulsa Talentos' },
      { name: 'description', content: 'Job posting packages for employers: single post $49, 5-pack $199, featured listing add-on $29.' },
    ],
  }),
})

function PackageCard({ id }: { id: string }) {
  const { t } = useI18n()
  const pkg = JOB_PACKAGES.find(p => p.id === id)!
  const buy = () => {
    if (pkg.paymentLink) {
      window.open(pkg.paymentLink, '_blank', 'noopener')
      return
    }
    toast.info(t('pricing.pending'), { description: t('pricing.pendingDesc') })
  }

  const isFeatured = pkg.id === 'featured'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={isFeatured ? 'md:-mt-3 md:mb-3' : ''}
    >
      <Card className={`h-full flex flex-col hover:shadow-lg transition-shadow ${isFeatured ? 'border-primary/40 bg-gradient-to-b from-primary/5 to-card' : ''}`}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {isFeatured && <Sparkles className="size-4 text-primary" />}
            {t(pkg.nameKey)}
          </CardTitle>
          <CardDescription className="min-h-10">{t(pkg.descKey)}</CardDescription>
          <p className="text-3xl font-bold font-serif mt-1">
            ${pkg.priceUsd}
            <span className="text-sm font-normal text-muted-foreground"> USD</span>
          </p>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 gap-4">
          <ul className="space-y-2 flex-1">
            {pkg.featuresKeys.map(k => (
              <li key={k} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                {t(k)}
              </li>
            ))}
          </ul>
          <Button onClick={buy} className="w-full" variant={isFeatured ? 'default' : 'outline'}>
            {t('pricing.buy')}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function PricingPage() {
  const { t } = useI18n(); const { user } = useAuth(); const [unlocked, setUnlocked] = useState(false)
  useEffect(() => { setUnlocked(!!user || sessionStorage.getItem('impulsa_pricing_lead') === '1') }, [user])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader transparentOnTop={false} />
      <main id="main" className="max-w-5xl mx-auto px-5 py-12">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-2">{t('pricing.kicker')}</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold">{t('pricing.title')}</h1>
          <p className="mt-2 text-muted-foreground max-w-xl mx-auto">{t('pricing.subtitle')}</p>
        </div>

        {!unlocked ? <LeadCaptureForm onSuccess={() => setUnlocked(true)} /> : <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {JOB_PACKAGES.map(pkg => <PackageCard key={pkg.id} id={pkg.id} />)}
        </div>}

        <p className="mt-8 text-center text-xs text-muted-foreground max-w-2xl mx-auto">
          {t('pricing.footnote')}
        </p>
      </main>
    </div>
  )
}
