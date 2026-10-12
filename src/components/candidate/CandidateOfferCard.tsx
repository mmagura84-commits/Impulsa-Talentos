/**
 * Offers the candidate has received on one application, with accept / decline.
 * Answering goes through the `respond_to_offer` database function
 * (migration 041): accepting marks the application hired and notifies the
 * employer; declining notifies the employer.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gift, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOffersByApplication } from '@/hooks/useOffers'
import { supabase } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import { friendlyDbError } from '@/lib/dbErrors'
import type { Offer } from '@/types'

function money(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-CO' : 'en-US', {
      style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function CandidateOfferCard({ applicationId }: { applicationId: string }) {
  const { t, locale } = useI18n()
  const queryClient = useQueryClient()
  const { data: offers } = useOffersByApplication(applicationId)
  const [busy, setBusy] = useState<string | null>(null)
  if (!offers || offers.length === 0) return null

  const respond = async (offer: Offer, accept: boolean) => {
    setBusy(offer.id)
    const { error } = await supabase.rpc('respond_to_offer', { p_offer_id: offer.id, p_accept: accept })
    setBusy(null)
    if (error) {
      toast.error(friendlyDbError(new Error(error.message), t))
      return
    }
    toast.success(accept ? t('offer.candidate.accepted') : t('offer.candidate.declined'))
    queryClient.invalidateQueries({ queryKey: ['offers'] })
    queryClient.invalidateQueries({ queryKey: ['applications'] })
  }

  return (
    <div className="mt-2.5 space-y-2">
      {offers.map((offer) => {
        const open = offer.status === 'pending' || offer.status === 'revised'
        return (
          <div key={offer.id} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <Gift className="size-3.5" />
              {t('offer.candidate.title')}
              <span className="ml-auto rounded-full border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium">
                {t(`offers.status.${offer.status}`)}
              </span>
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">{money(offer.salary, offer.currency, locale)}</p>
            {offer.startDate && (
              <p className="text-xs text-muted-foreground">{t('offer.candidate.start')}: {offer.startDate}</p>
            )}
            {offer.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{offer.notes}</p>}
            {open && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-7 gap-1 text-[11px]" disabled={busy === offer.id} onClick={() => respond(offer, true)}>
                  <Check className="size-3" /> {t('offer.candidate.accept')}
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" disabled={busy === offer.id} onClick={() => respond(offer, false)}>
                  <X className="size-3" /> {t('offer.candidate.decline')}
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
