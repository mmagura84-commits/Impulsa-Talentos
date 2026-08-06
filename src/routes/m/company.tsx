import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Building2, BadgeCheck } from 'lucide-react'
import { AuthGate } from '@/components/AuthGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useProfile } from '@/hooks/useProfile'
import { useCompany, useUpdateCompany } from '@/hooks/useCompanies'
import { useI18n } from '@/i18n/I18nProvider'
import { CANONICAL_INDUSTRIES, industryLabelKey, matchIndustry } from '@/lib/industries'

export const Route = createFileRoute('/m/company')({ component: MobileCompany })

const selectCls = 'h-11 w-full rounded-md border border-input bg-background px-3 text-sm'

interface CompanyForm {
  name: string
  industry: string
  size: string
  location: string
  website: string
  contactEmail: string
  description: string
}

function MobileCompany() {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id)
  const { data: company, isLoading } = useCompany(user?.id)
  const updateCompany = useUpdateCompany()
  const navigate = useNavigate()
  const { t } = useI18n()

  const [form, setForm] = useState<CompanyForm | null>(null)
  const [requesting, setRequesting] = useState(false)

  // Employer-only gate (mirror m/applications).
  useEffect(() => {
    if (!profileLoading && profile && profile.role !== 'employer' && profile.role !== 'admin') {
      navigate({ to: '/m/home', replace: true })
    }
  }, [profileLoading, profile, navigate])

  // Prefill from the company once loaded.
  useEffect(() => {
    if (!company || form) return
    setForm({
      name: company.name ?? '',
      industry: matchIndustry(company.industry) ?? (CANONICAL_INDUSTRIES.includes(company.industry) ? company.industry : ''),
      size: company.size ?? '',
      location: company.location ?? '',
      website: company.website ?? '',
      contactEmail: company.contactEmail ?? '',
      description: company.description ?? '',
    })
  }, [company, form])

  const update = (key: keyof CompanyForm, value: string) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))

  const handleSave = async () => {
    if (!company || !form) return
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        data: {
          name: form.name.trim(),
          industry: form.industry.trim(),
          size: form.size.trim(),
          location: form.location.trim(),
          website: form.website.trim(),
          contactEmail: form.contactEmail.trim() || undefined,
          description: form.description.trim(),
        },
      })
      toast.success(t('mobile.companyUpdated'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('mobile.errorTitle'))
    }
  }

  const handleRequestVerification = async () => {
    if (!company) return
    setRequesting(true)
    try {
      await updateCompany.mutateAsync({ id: company.id, data: { verificationRequested: true } })
      toast.success(t('verification.requestSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    } finally {
      setRequesting(false)
    }
  }

  const dirty = !!form && !!company && (
    form.name.trim() !== (company.name ?? '') ||
    form.industry !== matchIndustry(company.industry) ||
    form.size.trim() !== (company.size ?? '') ||
    form.location.trim() !== (company.location ?? '') ||
    form.website.trim() !== (company.website ?? '') ||
    (form.contactEmail.trim() || undefined) !== (company.contactEmail ?? undefined) ||
    form.description.trim() !== (company.description ?? '')
  )

  return (
    <AuthGate fallbackKey="auth.fallback.employerDashboard" fallbackDescKey="auth.fallback.employerDashboardDesc">
      <div className="px-4 pt-4 pb-4 space-y-4">
        <div>
          <h1 className="font-serif text-xl font-bold flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> {t('mobile.companySettings')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">{t('applications.subtitle')}</p>
        </div>

        {isLoading || !company ? (
          !company && !isLoading ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">{t('dashboard.noCompany')}</p>
              <Button asChild size="sm" variant="outline" className="mt-3">
                <Link to="/m/post">{t('mobile.noCompanySetup')}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-11 rounded-md bg-muted animate-pulse" />
              <div className="h-11 rounded-md bg-muted animate-pulse" />
              <div className="h-24 rounded-xl bg-muted animate-pulse" />
            </div>
          )
        ) : (
          <>
            <Card>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">{t('postJob.company.name')}</Label>
                  <Input id="companyName" value={form?.name ?? ''} onChange={e => update('name', e.target.value)} className="h-11" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">{t('postJob.company.industry')}</Label>
                  <select id="industry" value={form?.industry ?? ''} onChange={e => update('industry', e.target.value)} className={selectCls}>
                    <option value="">{t('postJob.company.industryPlaceholder')}</option>
                    {CANONICAL_INDUSTRIES.map(c => {
                      const key = industryLabelKey(c)
                      return (
                        <option key={c} value={c}>{key ? t(key) : c}</option>
                      )
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="size">{t('postJob.company.size')}</Label>
                    <Input id="size" value={form?.size ?? ''} onChange={e => update('size', e.target.value)} className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">{t('postJob.company.location')}</Label>
                    <Input id="location" value={form?.location ?? ''} onChange={e => update('location', e.target.value)} placeholder="Medellín, Colombia" className="h-11" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">{t('postJob.company.website')}</Label>
                  <Input id="website" value={form?.website ?? ''} onChange={e => update('website', e.target.value)} placeholder="https://" className="h-11" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t('dashboard.company.contactEmailLabel')}</Label>
                  <Input id="contactEmail" type="email" value={form?.contactEmail ?? ''} onChange={e => update('contactEmail', e.target.value)} placeholder={t('postJob.company.contactEmailPlaceholder')} className="h-11" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">{t('postJob.company.description')}</Label>
                  <textarea
                    id="description"
                    value={form?.description ?? ''}
                    onChange={e => update('description', e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-y"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Verification card */}
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <BadgeCheck className="size-4 text-primary shrink-0" /> {t('verification.verified')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {company.verificationRequested ? t('verification.requestedDesc') : t('verification.requestDesc')}
                  </p>
                </div>
                {company.verificationRequested ? (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {t('verification.requested')}
                  </span>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleRequestVerification} disabled={requesting || updateCompany.isPending} className="shrink-0 gap-1.5">
                    <BadgeCheck className="size-3.5" />
                    {requesting ? t('common.loading') : t('verification.request')}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={updateCompany.isPending || !dirty} size="lg" className="w-full h-12 font-semibold gap-2">
              {updateCompany.isPending ? (
                <>
                  <span className="inline-block size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                  {t('editJob.saving')}
                </>
              ) : (
                t('editJob.save')
              )}
            </Button>
          </>
        )}
      </div>
    </AuthGate>
  )
}
