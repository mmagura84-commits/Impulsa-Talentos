/**
 * Tiny, safe markdown preview used by the rich-text editor and any
 * other surface that needs to render user-authored descriptions
 * (job details, apply confirmation, etc.).
 *
 * Supports a deliberate subset: bold, italic, inline code, links,
 * bullet/numbered lists, blockquotes, headings (h1-h6), horizontal
 * rules, paragraphs. All input is HTML-escaped first; only an
 * allowlisted URL scheme is permitted for links.
 */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function MarkdownPreview({
  source,
  className,
}: {
  source: string
  className?: string
}) {
  if (!source || !source.trim()) return null

  // Escape HTML, then convert a safe subset of markdown.
  const escape = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

  const lines = source.split('\n')
  type Block =
    | { kind: 'h'; text: string }
    | { kind: 'p'; text: string }
    | { kind: 'ul'; items: string[] }
    | { kind: 'ol'; items: string[] }
    | { kind: 'quote'; items: string[] }
    | { kind: 'hr' }

  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*$/.test(line)) {
      i++
      continue
    }
    if (/^\s*---\s*$/.test(line)) {
      blocks.push({ kind: 'hr' })
      i++
      continue
    }
    const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'h', text: heading[2] })
      i++
      continue
    }
    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\s*>\s?(.*)$/.exec(lines[i])
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push({ kind: 'quote', items })
      continue
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line)
    if (ul) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\s*[-*+]\s+(.*)$/.exec(lines[i])
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push({ kind: 'ul', items })
      continue
    }
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\s*\d+\.\s+(.*)$/.exec(lines[i])
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push({ kind: 'ol', items })
      continue
    }
    const paraLines: string[] = []
    while (i < lines.length) {
      const cur = lines[i]
      if (/^\s*$/.test(cur)) break
      if (/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|---\s*$)/.test(cur)) break
      paraLines.push(cur)
      i++
    }
    blocks.push({ kind: 'p', text: paraLines.join('\n') })
  }

  const inline = (s: string) => {
    let out = escape(s)
    out = out.replace(/`([^`]+)`/g, (_, c) => `<code class="rounded bg-muted px-1 py-0.5 text-[12px]">${c}</code>`)
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    out = out.replace(/_([^_]+)_/g, '<em>$1</em>')
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
      const safeUrl = /^(https?:|mailto:|\/)/i.test(url) ? url : '#'
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${txt}</a>`
    })
    return out
  }

  const renderItems = (items: string[]): ReactNode[] =>
    items.map((it, j) => (
      <span
        key={j}
        className="block text-sm"
        dangerouslySetInnerHTML={{ __html: inline(it) }}
      />
    ))

  return (
    <div className={cn('space-y-3', className)}>
      {blocks.map((b, idx) => {
        if (b.kind === 'h') {
          return (
            <p
              key={idx}
              className="font-serif text-base font-bold text-foreground"
              dangerouslySetInnerHTML={{ __html: inline(b.text) }}
            />
          )
        }
        if (b.kind === 'p') {
          return (
            <p
              key={idx}
              className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line"
              dangerouslySetInnerHTML={{ __html: inline(b.text) }}
            />
          )
        }
        if (b.kind === 'ul') {
          return (
            <ul key={idx} className="space-y-1 list-disc pl-5 marker:text-muted-foreground">
              {b.items.map((it, j) => (
                <li
                  key={j}
                  className="text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: inline(it) }}
                />
              ))}
            </ul>
          )
        }
        if (b.kind === 'ol') {
          return (
            <ol key={idx} className="space-y-1 list-decimal pl-5 marker:text-muted-foreground">
              {b.items.map((it, j) => (
                <li
                  key={j}
                  className="text-sm text-muted-foreground leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: inline(it) }}
                />
              ))}
            </ol>
          )
        }
        if (b.kind === 'quote') {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground"
            >
              {renderItems(b.items)}
            </blockquote>
          )
        }
        if (b.kind === 'hr') {
          return <hr key={idx} className="border-border" />
        }
        return null
      })}
    </div>
  )
}
