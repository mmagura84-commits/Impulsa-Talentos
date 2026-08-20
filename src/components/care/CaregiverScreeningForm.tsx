import { useState } from 'react'
import { toast } from 'sonner'
import { UploadCloud, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/i18n/I18nProvider'
import {
  CARE_COMPETENCIES,
  CARE_SCHEDULES,
  CARE_LIVE_MODES,
  CARE_AGE_BANDS,
  CARE_CERTIFICATIONS,
  MEDELLIN_BARRIOS,
  CARE_LANGUAGES,
  CARE_LIVE_MODE_KEYS,
  CARE_COMPETENCY_KEYS,
  CARE_SCHEDULE_KEYS,
  CARE_AGE_BAND_KEYS,
  CARE_CERTIFICATION_KEYS,
  CARE_LANGUAGE_KEYS,
  CERT_REQUIRED_COMPETENCIES,
} from '@/lib/care'
import {
  useSaveCaregiverProfile,
  useUploadCareDocument,
  useSaveCaregiverUploads,
} from '@/hooks/useCare'
import type { CaregiverProfile } from '@/lib/care'

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
}

/**
 * Caregiver onboarding + screening-application surface (scope item 2).
 * Caregivers self-attest their competencies/certs here and UPLOAD documents;
 * the verification STATUS is never set by this form — an admin sets it.
 */
export function CaregiverScreeningForm({
  userId,
  existing,
  onSaved,
}: {
  userId: string
  existing?: CaregiverProfile | null
  onSaved?: () => void
}) {
  const { t } = useI18n()
  const save = useSaveCaregiverProfile()
  const upload = useUploadCareDocument()
  const saveUploads = useSaveCaregiverUploads()

  const [competencies, setCompetencies] = useState<string[]>(existing?.competencies ?? [])
  const [availability, setAvailability] = useState(existing?.availability ?? 'full_time')
  const [liveMode, setLiveMode] = useState(existing?.liveInLiveOut ?? 'flexible')
  const [ageBands, setAgeBands] = useState<string[]>(existing?.ageBands ?? [])
  const [barrio, setBarrio] = useState(existing?.barrio ?? '')
  const [languages, setLanguages] = useState<string[]>(existing?.languages ?? ['es'])
  const [years, setYears] = useState<number>(existing?.yearsExperience ?? 0)
  const [certs, setCerts] = useState<string[]>(existing?.certifications ?? [])
  const [about, setAbout] = useState(existing?.about ?? '')

  const needsNursingCert = competencies.includes('nursing_assistant')
  const certRequired = CERT_REQUIRED_COMPETENCIES.some(c => competencies.includes(c))

  const handleSubmit = async () => {
    if (competencies.length === 0) {
      toast.error(t('care.form.errors.noCompetency'))
      return
    }
    if (!barrio) {
      toast.error(t('care.form.errors.noBarrio'))
      return
    }
    if (certRequired && !certs.includes('nursing_assistant_certificate')) {
      toast.error(t('care.form.errors.nursingCertRequired'))
      return
    }
    try {
      await save.mutateAsync({
        userId,
        profile: {
          competencies,
          availability,
          liveInLiveOut: liveMode,
          ageBands,
          barrio,
          city: 'Medellín',
          languages,
          yearsExperience: years,
          certifications: certs,
          about,
          photoPointer: existing?.photoPointer ?? null,
        },
      })
      toast.success(t('care.form.saved'))
      onSaved?.()
    } catch (err) {
      toast.error(t('care.form.saveError'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  const handleUpload = async (kind: 'identity' | 'backgroundCheck' | 'certificate', file: File) => {
    try {
      const pointer = await upload.mutateAsync({ userId, kind, file })
      const current: Record<string, string | null> = {}
      await saveUploads.mutateAsync({
        userId,
        uploads: {
          identityPointer: kind === 'identity' ? pointer : existing?.identityPointer ?? null,
          backgroundCheckPointer:
            kind === 'backgroundCheck' ? pointer : existing?.backgroundCheckPointer ?? null,
          certificatePointer:
            kind === 'certificate' ? pointer : existing?.certificatePointer ?? null,
          references: existing?.references ?? '',
        },
      })
      void current
      toast.success(t('care.form.uploaded'))
    } catch (err) {
      toast.error(t('care.form.uploadError'), {
        description: err instanceof Error ? err.message : '',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('care.form.title')}</CardTitle>
        <CardDescription>{t('care.form.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Competencies */}
        <div className="space-y-2">
          <Label>{t('care.form.competencies')}</Label>
          <div className="flex flex-wrap gap-2">
            {CARE_COMPETENCIES.map(c => (
              <button
                key={c}
                type="button"
                aria-pressed={competencies.includes(c)}
                onClick={() => setCompetencies(prev => toggle(prev, c))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  competencies.includes(c)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/40'
                }`}
              >
                {t(CARE_COMPETENCY_KEYS[c])}
              </button>
            ))}
          </div>
        </div>

        {/* Availability */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="care-availability">{t('care.form.availability')}</Label>
            <select
              id="care-availability"
              value={availability}
              onChange={e => setAvailability(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            >
              {CARE_SCHEDULES.map(s => (
                <option key={s} value={s}>{t(CARE_SCHEDULE_KEYS[s])}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="care-live">{t('care.form.liveMode')}</Label>
            <select
              id="care-live"
              value={liveMode}
              onChange={e => setLiveMode(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            >
              {CARE_LIVE_MODES.map(m => (
                <option key={m} value={m}>{t(CARE_LIVE_MODE_KEYS[m])}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Nanny age bands */}
        {competencies.includes('nanny') && (
          <div className="space-y-2">
            <Label>{t('care.form.ageBands')}</Label>
            <div className="flex flex-wrap gap-2">
              {CARE_AGE_BANDS.map(a => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={ageBands.includes(a)}
                  onClick={() => setAgeBands(prev => toggle(prev, a))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    ageBands.includes(a)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent/40'
                  }`}
                >
                  {t(CARE_AGE_BAND_KEYS[a])}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Barrio + languages + experience */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="care-barrio">{t('care.form.barrio')}</Label>
            <select
              id="care-barrio"
              value={barrio}
              onChange={e => setBarrio(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            >
              <option value="">{t('care.form.barrioPlaceholder')}</option>
              {MEDELLIN_BARRIOS.map(b => (
                <option key={b.name} value={b.name}>{b.name} — {b.comuna}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="care-languages">{t('care.form.languages')}</Label>
            <select
              id="care-languages"
              value={languages}
              multiple
              onChange={e =>
                setLanguages(Array.from(e.target.selectedOptions).map(o => o.value))
              }
              className="h-24 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
            >
              {CARE_LANGUAGES.map(l => (
                <option key={l} value={l}>{t(CARE_LANGUAGE_KEYS[l])}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="care-years">{t('care.form.years')}</Label>
            <Input
              id="care-years"
              type="number"
              min={0}
              max={60}
              value={years === 0 ? '' : years}
              onChange={e => setYears(Number(e.target.value) || 0)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Certifications */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            {t('care.form.certifications')}
            {needsNursingCert && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                {t('care.form.nursingCertRequired')}
              </span>
            )}
          </Label>
          <div className="flex flex-wrap gap-2">
            {CARE_CERTIFICATIONS.map(c => (
              <button
                key={c}
                type="button"
                aria-pressed={certs.includes(c)}
                onClick={() => setCerts(prev => toggle(prev, c))}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                  certs.includes(c)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent/40'
                }`}
              >
                {t(CARE_CERTIFICATION_KEYS[c])}
              </button>
            ))}
          </div>
          {certRequired && !certs.includes('nursing_assistant_certificate') && (
            <p className="text-xs text-amber-700">{t('care.form.nursingCertHint')}</p>
          )}
        </div>

        {/* About */}
        <div className="space-y-2">
          <Label htmlFor="care-about">{t('care.form.about')}</Label>
          <textarea
            id="care-about"
            value={about}
            onChange={e => setAbout(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-y"
            placeholder={t('care.form.aboutPlaceholder')}
          />
        </div>

        {/* Document uploads */}
        <div className="space-y-3 rounded-lg border border-muted p-3">
          <Label className="text-sm font-semibold">{t('care.form.docs.title')}</Label>
          <p className="text-xs text-muted-foreground">{t('care.form.docs.desc')}</p>
          {(
            [
              ['identity', t('care.form.docs.identity')],
              ['backgroundCheck', t('care.form.docs.background')],
              ['certificate', t('care.form.docs.certificate')],
            ] as const
          ).map(([kind, label]) => (
            <div key={kind} className="flex items-center justify-between gap-3">
              <Label htmlFor={`doc-${kind}`} className="text-sm font-medium">
                {label}
                <span className="block text-[11px] font-normal text-muted-foreground">
                  {t('care.form.docs.private')}
                </span>
              </Label>
              <label
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent/40 ${
                  (kind === 'identity' && existing?.identityPointer) ||
                  (kind === 'backgroundCheck' && existing?.backgroundCheckPointer) ||
                  (kind === 'certificate' && existing?.certificatePointer)
                    ? 'border-emerald-500/40 text-emerald-700'
                    : 'border-border text-muted-foreground'
                }`}
              >
                <UploadCloud className="size-3.5" aria-hidden="true" />
                {(kind === 'identity' && existing?.identityPointer) ||
                (kind === 'backgroundCheck' && existing?.backgroundCheckPointer) ||
                (kind === 'certificate' && existing?.certificatePointer) ? (
                  <>
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {t('care.form.docs.uploaded')}
                  </>
                ) : (
                  t('care.form.docs.upload')
                )}
                <input
                  id={`doc-${kind}`}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(kind, file)
                    e.currentTarget.value = ''
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <Button onClick={handleSubmit} disabled={save.isPending} className="gap-2">
          {save.isPending ? t('common.loading') : t('care.form.saveCta')}
        </Button>
      </CardContent>
    </Card>
  )
}
