import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { PublicHeader } from '@/components/PublicHeader'
import { PreScreenedBadge } from '@/components/care/PreScreenedBadge'
import { CareSummaryDisclaimer } from '@/components/care/CareDisclaimer'
import { useCaregiversDirectory } from '@/hooks/useCare'
import { useI18n } from '@/i18n/I18nProvider'
import { Button } from '@/components/ui/button'
import {
  CARE_COMPETENCIES,
  CARE_LIVE_MODES,
  CARE_CERTIFICATIONS,
  MEDELLIN_BARRIOS,
  MEDELLIN_COMUNAS,
  CARE_COMPETENCY_KEYS,
  CARE_LIVE_MODE_KEYS,
  CARE_CERTIFICATION_KEYS,
  CARE_LANGUAGE_KEYS,
} from '@/lib/care'
import { MapPin, Languages, Award, Clock, Users } from 'lucide-react'

export const Route = createFileRoute('/caregivers')({
  component: CaregiversDirectoryPage,
  head: () => ({
    meta: [
      { title: 'Home & Care — Pre-screened Caregivers | Impulsa Talentos' },
      { name: 'description', content: 'Browse pre-screened nannies, housekeepers and nursing assistants in Medellín. Every caregiver is document-verified by our team before being listed.' },
    ],
  }),
})

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

function CaregiversDirectoryPage() {
  const { t } = useI18n()
  const [competency, setCompetency] = useState('')
  const [comuna, setComuna] = useState('')
  const [barrio, setBarrio] = useState('')
  const [live, setLive] = useState('')
  const [cert, setCert] = useState('')

  const { data: rows, isLoading } = useCaregiversDirectory({
    competency: competency || undefined,
    barrio: barrio || undefined,
    liveInLiveOut: live || undefined,
    certifications: cert || undefined,
  })

  const caregivers = useMemo(() => {
    const barriosInComuna = MEDELLIN_BARRIOS.filter(b => b.comuna === comuna).map(b => b.name)
    let out = rows ?? []
    if (comuna) out = out.filter(p => barriosInComuna.includes(p.barrio))
    return out
  }, [rows, comuna])

  const barriosForComuna = useMemo(
    () => (comuna ? MEDELLIN_BARRIOS.filter(b => b.comuna === comuna) : []),
    [comuna],
  )

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        {/* Hero / intro */}
        <div className="mb-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-emerald-600">
            {t('care.directory.eyebrow')}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl text-foreground">
            {t('care.directory.title')}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">{t('care.directory.desc')}</p>
        </div>

        {/* Filters */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('care.directory.filter.careType')}</span>
            <select value={competency} onChange={e => setCompetency(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{t('care.directory.all')}</option>
              {CARE_COMPETENCIES.map(c => (
                <option key={c} value={c}>{t(CARE_COMPETENCY_KEYS[c])}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('care.directory.filter.comuna')}</span>
            <select value={comuna} onChange={e => { setComuna(e.target.value); setBarrio('') }} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{t('care.directory.all')}</option>
              {MEDELLIN_COMUNAS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('care.directory.filter.barrio')}</span>
            <select value={barrio} onChange={e => setBarrio(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{t('care.directory.all')}</option>
              {barriosForComuna.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('care.directory.filter.live')}</span>
            <select value={live} onChange={e => setLive(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{t('care.directory.all')}</option>
              {CARE_LIVE_MODES.map(m => (
                <option key={m} value={m}>{t(CARE_LIVE_MODE_KEYS[m])}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t('care.directory.filter.cert')}</span>
            <select value={cert} onChange={e => setCert(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">{t('care.directory.all')}</option>
              {CARE_CERTIFICATIONS.map(c => (
                <option key={c} value={c}>{t(CARE_CERTIFICATION_KEYS[c])}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : caregivers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="font-medium text-foreground">{t('care.directory.empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('care.directory.emptyDesc')}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {caregivers.map(c => (
              <article key={c.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 font-bold text-emerald-700">
                    {initialsOf(c.userId)}
                  </div>
                  <div className="min-w-0">
                    <PreScreenedBadge />
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {c.barrio}, Medellín
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {c.competencies.map(comp => (
                    <span key={comp} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {t(CARE_COMPETENCY_KEYS[comp as keyof typeof CARE_COMPETENCY_KEYS] ?? 'care.competency.nanny')}
                    </span>
                  ))}
                </div>

                <dl className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5" aria-hidden="true" />
                    <span>{t('care.directory.availability')}: </span>
                    <span className="capitalize">{c.availability}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Languages className="size-3.5" aria-hidden="true" />
                    <span>{t('care.directory.languages')}: </span>
                    <span>{c.languages.map(l => t(CARE_LANGUAGE_KEYS[l as keyof typeof CARE_LANGUAGE_KEYS] ?? 'care.language.es')).join(', ')}</span>
                  </div>
                  {(c.certifications?.length ?? 0) > 0 && (
                    <div className="flex items-start gap-2">
                      <Award className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="line-clamp-2">
                        {t('care.directory.certifications')}: {c.certifications.map(cert => t(CARE_CERTIFICATION_KEYS[cert as keyof typeof CARE_CERTIFICATION_KEYS] ?? 'care.cert.cpr')).join(', ')}
                      </span>
                    </div>
                  )}
                </dl>

                {c.about && (
                  <p className="mt-3 line-clamp-2 text-sm text-foreground/80">{c.about}</p>
                )}

                <div className="mt-auto pt-4">
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                    <Link to="/for-employers">
                      <Users className="size-3.5" aria-hidden="true" />
                      {t('care.directory.postCare')}
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-10">
          <CareSummaryDisclaimer />
        </div>
      </main>
    </div>
  )
}
