/**
 * Lightweight rich-text editor backed by a plain `<textarea>` + a
 * markdown toolbar. The toolbar wraps the current selection with
 * common markdown tokens (**bold**, _italic_, # heading, list item,
 * [link](url)). Output is plain text + markdown that the job
 * description view parses with a small markdown renderer.
 *
 * Designed for the post-job / edit-job description field where
 * employers want formatting (headings, lists, bold) but a full
 * WYSIWYG would be overkill and would force an extra dependency.
 */
import { useRef, useState, useCallback, type ReactNode } from 'react'
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  Quote,
  Code,
  Eye,
  Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/I18nProvider'
import { MarkdownPreview } from '@/components/MarkdownPreview'

interface RichTextEditorProps {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  rows?: number
  /** Optional a11y label for screen readers. */
  ariaLabel?: string
  /** Optional id for the underlying textarea (used by <Label htmlFor>). */
  id?: string
  /** Additional className for the wrapper. */
  className?: string
}

type ToolbarAction =
  | { kind: 'wrap'; before: string; after?: string; placeholder?: string }
  | { kind: 'line'; prefix: string }

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
  ariaLabel,
  id,
  className,
}: RichTextEditorProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [tab, setTab] = useState<'write' | 'preview'>('write')

  const apply = useCallback(
    (action: ToolbarAction) => {
      const ta = ref.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const before = value.slice(0, start)
      const selected = value.slice(start, end)
      const after = value.slice(end)
      const text = selected || ('placeholder' in action ? action.placeholder ?? '' : '')

      if (action.kind === 'wrap') {
        const afterToken = action.after ?? action.before
        const next =
          before +
          action.before +
          text +
          afterToken +
          after
        onChange(next)
        // Restore caret to the end of the inserted text.
        const caretPos =
          before.length +
          action.before.length +
          text.length +
          afterToken.length
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(caretPos, caretPos)
        })
      } else {
        // Line prefix — insert at the start of the current line(s).
        const lineStart = before.lastIndexOf('\n') + 1
        const linesText = value.slice(lineStart, end)
        const transformed = linesText
          .split('\n')
          .map(l => action.prefix + l)
          .join('\n')
        const next = before + transformed + after
        onChange(next)
        requestAnimationFrame(() => {
          ta.focus()
          ta.setSelectionRange(
            lineStart + transformed.length,
            lineStart + transformed.length,
          )
        })
      }
    },
    [value, onChange],
  )

  const insertLink = useCallback(() => {
    const url = typeof window !== 'undefined'
      ? window.prompt(t('editor.linkPrompt'), 'https://')
      : null
    if (!url) return
    apply({ kind: 'wrap', before: '[', after: `](${url})`, placeholder: 'link text' })
  }, [apply, t])

  return (
    <div
      className={cn(
        'rounded-md border border-input bg-background overflow-hidden focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] transition-shadow',
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-muted/30 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          <ToolbarButton
            label={t('editor.bold')}
            onClick={() => apply({ kind: 'wrap', before: '**' })}
            icon={<Bold className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.italic')}
            onClick={() => apply({ kind: 'wrap', before: '_' })}
            icon={<Italic className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.heading')}
            onClick={() => apply({ kind: 'line', prefix: '## ' })}
            icon={<Heading2 className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.bulletList')}
            onClick={() => apply({ kind: 'line', prefix: '- ' })}
            icon={<List className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.numberedList')}
            onClick={() => apply({ kind: 'line', prefix: '1. ' })}
            icon={<ListOrdered className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.quote')}
            onClick={() => apply({ kind: 'line', prefix: '> ' })}
            icon={<Quote className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.code')}
            onClick={() => apply({ kind: 'wrap', before: '`' })}
            icon={<Code className="size-3.5" />}
          />
          <ToolbarButton
            label={t('editor.link')}
            onClick={insertLink}
            icon={<LinkIcon className="size-3.5" />}
          />
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-0.5">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
              tab === 'write'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Pencil className="size-3" /> {t('editor.write')}
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
              tab === 'preview'
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Eye className="size-3" /> {t('editor.preview')}
          </button>
        </div>
      </div>

      {tab === 'write' ? (
        <textarea
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full bg-background px-3 py-2.5 text-sm text-foreground font-mono outline-none resize-y"
        />
      ) : (
        <div className="px-3 py-2.5 min-h-[8rem] max-h-96 overflow-y-auto">
          {value.trim() ? (
            <MarkdownPreview source={value} />
          ) : (
            <p className="text-muted-foreground italic text-xs">
              {t('editor.emptyPreview')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
    >
      {icon}
    </Button>
  )
}

/* ── Inline markdown renderer kept here for backward compat ─── */
// Rendering is delegated to the shared `MarkdownPreview` component.
