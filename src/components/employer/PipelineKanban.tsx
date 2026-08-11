import { useState, useMemo, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useProfileById } from '@/hooks/useProfile'
import { useUpdateApplicationStatus } from '@/hooks/useApplications'
import { createRow } from '@/lib/supabase'
import { useI18n } from '@/i18n/I18nProvider'
import {
  Users,
  Search,
  X,
  Filter,
  CheckSquare,
  Square,
  ChevronDown,
  ArrowUpDown,
  GripVertical,
  MessageSquare,
  RotateCcw,
  CheckCheck,
  Table,
  Columns2,
} from 'lucide-react'
import type { Application, ApplicationStatusHistory } from '@/types'

/* ── Kanban column definitions ─────────────────────────────── */
interface KanbanColumn {
  key: string
  labelEn: string
  labelEs: string
  statuses: Application['status'][]
  color: string
  bgColor: string
  step: number
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  { key: 'draft',         labelEn: 'Draft',        labelEs: 'Borrador',        statuses: ['draft'],              color: 'border-slate-400 text-slate-500',   bgColor: 'bg-slate-50',   step: 0 },
  { key: 'applied',       labelEn: 'Applied',      labelEs: 'Postulados',      statuses: ['applied'],            color: 'border-blue-500 text-blue-700',     bgColor: 'bg-blue-50',    step: 1 },
  { key: 'screening',     labelEn: 'Screening',    labelEs: 'Filtro',          statuses: ['recruiter_screening'],color: 'border-indigo-500 text-indigo-700', bgColor: 'bg-indigo-50',  step: 2 },
  { key: 'review',        labelEn: 'Review',       labelEs: 'Revisión',        statuses: ['under_review'],       color: 'border-cyan-500 text-cyan-700',     bgColor: 'bg-cyan-50',   step: 3 },
  { key: 'interview',     labelEn: 'Interview',    labelEs: 'Entrevista',      statuses: ['interview_scheduled'],color: 'border-amber-500 text-amber-700',   bgColor: 'bg-amber-50',  step: 4 },
  { key: 'assessment',    labelEn: 'Assessment',   labelEs: 'Evaluación',      statuses: ['assessment_required','assessment_submitted'], color: 'border-orange-500 text-orange-700', bgColor: 'bg-orange-50', step: 5 },
  { key: 'client',        labelEn: 'Client',       labelEs: 'Cliente',         statuses: ['submitted_to_client','client_interview'], color: 'border-purple-500 text-purple-700', bgColor: 'bg-purple-50', step: 6 },
  { key: 'final',         labelEn: 'Final',        labelEs: 'Final',           statuses: ['final_interview'],    color: 'border-violet-500 text-violet-700', bgColor: 'bg-violet-50', step: 7 },
  { key: 'offer',         labelEn: 'Offer',        labelEs: 'Oferta',          statuses: ['offer'],              color: 'border-pink-500 text-pink-700',     bgColor: 'bg-pink-50',  step: 8 },
  { key: 'hired',         labelEn: 'Hired',        labelEs: 'Contratados',     statuses: ['hired'],              color: 'border-emerald-500 text-emerald-700', bgColor: 'bg-emerald-50', step: 9 },
  { key: 'rejected',      labelEn: 'Rejected',     labelEs: 'Rechazados',      statuses: ['not_selected','position_closed','withdrawn'], color: 'border-red-400 text-red-600', bgColor: 'bg-red-50', step: -1 },
]

/* ── Time in stage helper ───────────────────────────────────── */
function timeInStageLabel(createdAt: string, t: (k: string, p?: Record<string, unknown>) => string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  if (days <= 0) return t('kanban.today')
  if (days === 1) return t('kanban.oneDay')
  if (days < 7) return t('kanban.nDays', { n: days })
  if (days < 30) return t('kanban.nWeeks', { n: Math.floor(days / 7) })
  return t('kanban.nMonths', { n: Math.floor(days / 30) })
}

/* ── Applicant card ─────────────────────────────────────────── */
function ApplicantCard({
  app,
  column,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onOpen,
}: {
  app: Application
  column: KanbanColumn
  isSelected: boolean
  onToggleSelect: (id: string) => void
  onStatusChange: (id: string, status: Application['status']) => void
  onOpen: (app: Application) => void
}) {
  const { t, locale } = useI18n()
  const { data: candidate } = useProfileById(app.candidateId)
  const [statusOpen, setStatusOpen] = useState(false)
  const candidateName = candidate?.fullName || t('manage.candidate')
  const initials = candidateName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(app)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(app) }
      }}
      aria-label={t('kanban.reviewCandidate', { name: candidateName })}
      className={`rounded-lg border bg-card p-3 cursor-pointer hover:shadow-sm transition-shadow relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? 'ring-2 ring-primary border-primary/50' : 'border-border'}`}
    >
      {/* Selection checkbox */}
      <button
        type="button"
        className="absolute top-2 right-2 z-10 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onToggleSelect(app.id) }}
        aria-label={isSelected ? t('kanban.deselect') : t('kanban.select')}
      >
        {isSelected
          ? <CheckSquare className="size-4 text-primary" />
          : <Square className="size-4 text-muted-foreground/40" />
        }
      </button>

      {/* Candidate info */}
      <div className="flex items-center gap-2 pr-6">
        <div className="flex items-center justify-center h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary font-semibold text-xs">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{candidateName}</p>
          <p className="text-[10px] text-muted-foreground">{t('kanban.inStage', { time: timeInStageLabel(app.createdAt, t) })}</p>
        </div>
      </div>

      {/* Status change dropdown */}
      <div className="mt-2 relative">
        <button
          type="button"
          className="w-full flex items-center justify-between rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setStatusOpen(!statusOpen) }}
        >
          <span>{t(`kanban.column.${column.key}`)}</span>
          <ChevronDown className="size-3" />
        </button>
        <AnimatePresence>
          {statusOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-30" onClick={() => setStatusOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 right-0 top-full mt-1 z-40 rounded-lg border border-border bg-card shadow-lg p-1 max-h-[240px] overflow-y-auto"
              >
                {KANBAN_COLUMNS.filter(c => c.key !== column.key).map(c => (
                  c.statuses.map(s => (
                    <button
                      key={s}
                      type="button"
                      className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); onStatusChange(app.id, s); setStatusOpen(false) }}
                    >
                      {t('kanban.moveTo', { stage: t(`kanban.column.${c.key}`) })}
                    </button>
                  ))
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Kanban column ──────────────────────────────────────────── */
function KanbanColumnView({
  column,
  apps,
  selectedIds,
  onToggleSelect,
  onStatusChange,
  onOpenApplication,
  t,
}: {
  column: KanbanColumn
  apps: Application[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onStatusChange: (id: string, status: Application['status']) => void
  onOpenApplication: (app: Application) => void
  t: (k: string, p?: Record<string, unknown>) => string
}) {
  const label = t(`kanban.column.${column.key}`) || column.labelEn
  return (
    <div className="flex-shrink-0 w-[280px] flex flex-col rounded-xl border border-border bg-muted/30">
      {/* Column header */}
      <div className={`px-3 py-2.5 rounded-t-xl border-b ${column.bgColor} ${column.color.replace(/text-\S+/, '')}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className={`text-xs font-bold uppercase tracking-wider ${column.color.split(' ').find(c => c.startsWith('text-')) || 'text-foreground'}`}>
              {label}
            </h3>
          </div>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {apps.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
        {apps.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-[11px] text-muted-foreground italic">{t('kanban.emptyColumn')}</p>
          </div>
        ) : (
          apps.map(app => (
            <ApplicantCard
              key={app.id}
              app={app}
              column={column}
              isSelected={selectedIds.has(app.id)}
              onToggleSelect={onToggleSelect}
              onStatusChange={onStatusChange}
              onOpen={onOpenApplication}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ── Filters bar ────────────────────────────────────────────── */
interface KanbanFilters {
  search: string
  stages: Set<string>
}

function KanbanFilterBar({
  filters,
  onChange,
  selectedCount,
  onBulkStatus,
  onClearSelection,
  onSelectAllVisible,
  t,
}: {
  filters: KanbanFilters
  onChange: (f: KanbanFilters) => void
  selectedCount: number
  onBulkStatus: (status: Application['status']) => void
  onClearSelection: () => void
  onSelectAllVisible: () => void
  t: (k: string, p?: Record<string, unknown>) => string
}) {
  const [bulkOpen, setBulkOpen] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder={t('kanban.searchPlaceholder')}
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
          className="pl-8 h-9 text-sm"
        />
        {filters.search && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            onClick={() => onChange({ ...filters, search: '' })}
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-xs gap-1">
            <CheckSquare className="size-3" />
            {t('kanban.selected', { count: selectedCount })}
          </Badge>
          <div className="relative">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => setBulkOpen(!bulkOpen)}>
              <ArrowUpDown className="size-3" />
              {t('kanban.moveStage')}
            </Button>
            <AnimatePresence>
              {bulkOpen && (
                <>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-30" onClick={() => setBulkOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 top-full mt-1 z-40 rounded-lg border border-border bg-card shadow-lg p-1 w-52">
                    {KANBAN_COLUMNS.map(c => c.statuses.map(s => (
                      <button key={s} type="button"
                        className="w-full text-left text-xs px-2.5 py-1.5 rounded hover:bg-accent cursor-pointer"
                        onClick={() => { onBulkStatus(s); setBulkOpen(false) }}>
                        {t('kanban.moveAllTo', { stage: t(`kanban.column.${c.key}`) })}
                      </button>
                    )))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={onClearSelection}>
            <RotateCcw className="size-3 mr-1" />
            {t('kanban.clearSelection')}
          </Button>
        </div>
      )}
      {/* Select all visible — always visible when there are apps */}
      <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground ml-auto" onClick={onSelectAllVisible}>
        <CheckCheck className="size-3 mr-1" />
        {t('kanban.selectAllVisible')}
      </Button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════
   PipelineKanban — main component
   ════════════════════════════════════════════════════════════════ */
export function PipelineKanban({
  applications,
  onOpenApplication,
}: {
  applications: Application[]
  onOpenApplication?: (app: Application) => void
}) {
  const openApp = onOpenApplication ?? (() => {})
  const { t } = useI18n()
  const updateStatus = useUpdateApplicationStatus()
  const [filters, setFilters] = useState<KanbanFilters>({ search: '', stages: new Set() })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filter applications
  const filteredApps = useMemo(() => {
    let apps = applications
    if (filters.search) {
      const q = filters.search.toLowerCase()
      apps = apps.filter(a => {
        // We can't pre-load all profiles for filtering; filter by application data
        return a.id.toLowerCase().includes(q)
          || a.status.toLowerCase().includes(q)
      })
    }
    return apps
  }, [applications, filters.search])

  // Group by kanban column
  const columnApps = useMemo(() => {
    const map = new Map<string, Application[]>()
    for (const col of KANBAN_COLUMNS) map.set(col.key, [])
    for (const app of filteredApps) {
      for (const col of KANBAN_COLUMNS) {
        if (col.statuses.includes(app.status)) {
          map.get(col.key)!.push(app)
          break
        }
      }
    }
    return map
  }, [filteredApps])

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleStatusChange = useCallback(async (id: string, status: Application['status']) => {
    try {
      await updateStatus.mutateAsync({ id, status })
      // Write to status history
      await createRow<ApplicationStatusHistory>('application_status_history', {
        applicationId: id,
        status,
        note: `Moved to ${status} via kanban`,
      }).catch(() => { /* history is best-effort */ })
      toast.success(t('kanban.stageChanged'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    }
  }, [updateStatus, t])

  const handleBulkStatus = useCallback(async (status: Application['status']) => {
    try {
      for (const id of selectedIds) {
        await updateStatus.mutateAsync({ id, status })
        await createRow<ApplicationStatusHistory>('application_status_history', {
          applicationId: id,
          status,
          note: `Bulk moved to ${status} via kanban`,
        }).catch(() => {})
      }
      toast.success(t('kanban.bulkMoved', { count: selectedIds.size }))
      setSelectedIds(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('common.retry'))
    }
  }, [selectedIds, updateStatus, t])

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleSelectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredApps.map(a => a.id)))
  }, [filteredApps])

  return (
    <div>
      {/* Filters */}
      <KanbanFilterBar
        filters={filters}
        onChange={setFilters}
        selectedCount={selectedIds.size}
        onBulkStatus={handleBulkStatus}
        onClearSelection={handleClearSelection}
        onSelectAllVisible={handleSelectAllVisible}
        t={t}
      />

      {/* Kanban board — horizontal scroll on mobile */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 snap-x snap-mandatory">
        {KANBAN_COLUMNS.map(col => (
          <div key={col.key} className="snap-start">
            <KanbanColumnView
              column={col}
              apps={columnApps.get(col.key) || []}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onStatusChange={handleStatusChange}
              onOpenApplication={openApp}
              t={t}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
