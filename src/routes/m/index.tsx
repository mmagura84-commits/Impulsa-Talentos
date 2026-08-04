import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight, Briefcase, Building2, Globe, Heart, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider'
import { useAuth } from '@/hooks/useAuth'
import { heroPhoto, cityscapePhoto } from '@/lib/media'

export const Route = createFileRoute('/m/')({
  head: () => ({
    meta: [
      { title: 'Impulsa Talentos — Mobile' },
      { name: 'description', content: 'Bilingual jobs in your pocket.' },
      { name: 'theme-color', content: '#1f3a8a' },
    ],
  }),
  component: MobileLanding,
})

function MobileLanding() {
  const { t } = useI18n()
  const { isAuthenticated, login } = useAuth()

  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative px-5 pt-6 pb-10 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-25"
          aria-hidden="true"
        >
          <img
            src={cityscapePhoto.src}
            alt=""
            className="size-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/95 to-background" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground">
            <Sparkles className="size-3 text-accent" /> {t('landing.hero.badge')}
          </span>
          <h1 className="mt-4 font-serif text-[2.2rem] leading-[1.05] font-bold tracking-tight text-foreground">
            {t('mobile.hero.title').split('\n').map((line, i) => (
              <span key={i} className="block">
                {line.includes('phone') || line.includes('celular') ? (
                  <span className="text-primary">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm">
            {t('mobile.hero.subtitle')}
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button asChild size="lg" className="h-12 text-base font-semibold gap-2">
              <Link to="/m/jobs">
                {t('mobile.hero.cta')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            {!isAuthenticated && (
              <Button
                onClick={login}
                size="lg"
                variant="outline"
                className="h-12 text-base font-semibold"
              >
                {t('mobile.authRequiredCta')}
              </Button>
            )}
          </div>
        </motion.div>

        {/* Photo strip */}
        <div className="mt-8 -mx-5 overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 px-5 pb-2">
            <PhotoTile src={heroPhoto.src} label={t('media.heroBadge')} />
            <PhotoTile src={cityscapePhoto.src} label={t('landing.footer.tagline')} />
          </div>
        </div>
      </section>

      {/* ── Value props (cards stack vertically) ─────────── */}
      <section className="px-5 space-y-3 pb-8">
        <ValueRow
          icon={Briefcase}
          title={t('landing.candidates.s3.title')}
          desc={t('landing.candidates.s3.desc')}
        />
        <ValueRow
          icon={Heart}
          title={t('savedJobs.title')}
          desc={t('savedJobs.desc')}
        />
        <ValueRow
          icon={Building2}
          title={t('landing.employers.s3.title')}
          desc={t('landing.employers.s3.desc')}
        />
        <ValueRow
          icon={Globe}
          title={t('landing.hero.aiMatching')}
          desc={t('landing.hero.subtitle')}
        />
      </section>

      {/* ── CTA banner ────────────────────────────────────── */}
      <section className="px-5 pb-10">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="font-serif text-base font-bold text-foreground">
            {t('mobile.ctaBanner')}
          </p>
          <Button asChild size="lg" className="mt-3 w-full h-12 font-semibold">
            <Link to="/m/jobs">{t('mobile.ctaCta')}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}

function PhotoTile({ src, label }: { src: string; label: string }) {
  return (
    <div className="relative shrink-0 w-44 h-28 rounded-xl overflow-hidden border border-border">
      <img
        src={src}
        alt={label}
        className="absolute inset-0 size-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <p className="absolute bottom-1.5 left-2 right-2 text-[11px] text-white/90 font-medium line-clamp-2">
        {label}
      </p>
    </div>
  )
}

function ValueRow({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType
  title: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">
          {desc}
        </p>
      </div>
    </div>
  )
}
