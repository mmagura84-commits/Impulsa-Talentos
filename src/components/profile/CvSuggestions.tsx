/**
 * "From your CV": what Claude read from the candidate's CV (profiles.cv_extracted)
 * that is not on their profile yet. Nothing is added without a click.
 */
import { useMemo, useState } from 'react'
import { Sparkles, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/I18nProvider'
import type { CvExtracted } from '@/types'
import { cvSuggestions, type CvCurrent, type CvPatch } from '@/lib/cvSuggestions'

export type { CvCurrent, CvPatch } from '@/lib/cvSuggestions'

const DISMISS_KEY = 'impulsa.cvSuggestions.dismissed'

export function CvSuggestions({ extracted, stamp, current, onAdd }: {
  extracted: CvExtracted
  stamp: string
  current: CvCurrent
  onAdd: (patch: CvPatch) => Promise<void>
}) {
  const { t } = useI18n()
  const patch = useMemo(() => cvSuggestions(extracted, current), [extracted, current])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(patch.skills ?? []))
  const [busy, setBusy] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === stamp } catch { return false }
  })
  if (dismissed || !Object.keys(patch).length) return null

  const toggle = (s: string) => setPicked(p => { const n = new Set(p); if (n.has(s)) n.delete(s); else n.add(s); return n })
  const add = async () => {
    setBusy(true)
    try { await onAdd({ ...patch, skills: (patch.skills ?? []).filter(s => picked.has(s)) }) } finally { setBusy(false) }
  }
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, stamp) } catch { /* private mode */ }
    setDismissed(true)
  }

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="size-4 text-primary" />{t('match.cv.title')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('match.cv.desc')}</p>
      </div>
      {patch.skills && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('match.cv.skills')}</p>
          <div className="flex flex-wrap gap-1.5">
            {patch.skills.map(s => (
              <button key={s} type="button" onClick={() => toggle(s)} aria-pressed={picked.has(s)}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${picked.has(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground line-through'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <dl className="grid gap-1 text-xs">
        {patch.years != null && <div className="flex gap-2"><dt className="text-muted-foreground">{t('match.cv.years')}:</dt><dd>{patch.years}</dd></div>}
        {patch.languages && <div className="flex gap-2"><dt className="text-muted-foreground">{t('match.cv.languages')}:</dt><dd>{patch.languages.join(', ')}</dd></div>}
        {patch.role && <div className="flex gap-2"><dt className="text-muted-foreground">{t('match.cv.role')}:</dt><dd>{patch.role}</dd></div>}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="gap-1.5" disabled={busy} onClick={add}><Plus className="size-3.5" />{t('match.cv.add')}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>{t('match.cv.dismiss')}</Button>
      </div>
    </div>
  )
}
