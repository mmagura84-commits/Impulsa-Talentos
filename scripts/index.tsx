import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Briefcase, Building2, Globe, LogIn, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nProvider'
import { cityscapePhoto, heroPhoto } from '@/lib/media'
import { BrandMark } from '@/components/BrandMark'
import { LanguageToggle } from '@/components/LanguageToggle'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Impulsa Talentos — Connecting Bilingual Talent with the World' },
      { name: 'description', content: 'Find bilingual jobs in Colombia. AI-powered matching for tech, CX, healthcare, and finance roles.' },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  const { t } = useI18n()
  const { isAuthenticated, isLoading, login } = useAuth()

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-5 py-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <img
            src={cityscapePhoto.src}
            alt=""
            className="size-full object-cover opacity-25"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background" />
        </div>

        {/* Language toggle — top right */}
        <div className="absolute top-4 right-4 z-10">
          <LanguageToggle compact />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center max-w-2xl mx-auto"
        >
          {/* Brand logo */}
          <div className="mb-6 flex justify-center">
            <BrandMark className="size-16 rounded-xl" title="Impulsa Talentos" />
          </div>

          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-muted-foreground mb-6">
            <Sparkles className="size-4 text-accent" />
            AI-powered bilingual recruitment
          </span>

          {/* Heading */}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.08]">
            Connecting Bilingual Talent
            <span className="block text-primary mt-1">with the World</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Colombia's premier platform matching bilingual professionals with top local and international employers in tech, CX, healthcare, and finance.
          </p>

          {/* CTAs */}
          <BlinkClientBoundary
            fallback={
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="h-12 w-48 rounded-lg bg-muted animate-pulse" />
                <div className="h-12 w-48 rounded-lg bg-muted animate-pulse" />
              </div>
            }
          >
            <LandingCTAs isAuthenticated={isAuthenticated} isLoading={isLoading} login={login} />
          </BlinkClientBoundary>

          {/* Stats */}
          <div className="mt-12 grid grid-cols-3 gap-6 sm:gap-10 max-w-lg mx-auto">
            {[
              { icon: Briefcase, label: 'Open Positions', value: '200+' },
              { icon: Building2, label: 'Partner Companies', value: '50+' },
              { icon: Globe, label: 'Countries Hiring', value: '15+' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center h-10 w-10 mx-auto rounded-xl bg-primary/10 text-primary mb-2">
                  <stat.icon className="size-5" />
                </div>
                <p className="text-2xl font-bold text-foreground font-serif">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Photo strip — desktop only */}
          <div className="hidden sm:flex items-center justify-center gap-4 mt-12">
            <div className="relative w-48 h-32 rounded-xl overflow-hidden border border-border shadow-lg">
              <img src={heroPhoto.src} alt="Bilingual professional at work" className="size-full object-cover" loading="lazy" />
            </div>
            <div className="relative w-48 h-32 rounded-xl overflow-hidden border border-border shadow-lg">
              <img src={cityscapePhoto.src} alt="Colombia cityscape" className="size-full object-cover" loading="lazy" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-5 text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Impulsa Talentos. Connecting Colombian bilingual professionals with global opportunities.
        </p>
        <nav className="mt-2 flex items-center justify-center gap-4 text-xs">
          <Link to="/terms" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Terms of Service</Link>
          <span className="text-border">•</span>
          <Link to="/privacy" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Privacy Policy</Link>
        </nav>
      </footer>
    </div>
  )
}

function LandingCTAs({
  isAuthenticated,
  isLoading,
  login,
}: {
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
}) {
  if (isLoading) return null

  return (
    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
      <Button asChild size="lg" className="h-12 px-8 text-base font-semibold gap-2">
        <Link to="/jobs">
          <Briefcase className="size-4" />
          Find Bilingual Jobs
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      {isAuthenticated ? (
        <Button asChild variant="outline" size="lg" className="h-12 px-8 text-base font-semibold gap-2">
          <Link to="/dashboard">
            Go to Dashboard
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <Button onClick={login} variant="outline" size="lg" className="h-12 px-8 text-base font-semibold gap-2">
          <LogIn className="size-4" />
          Sign In / Register
        </Button>
      )}
    </div>
  )
}
