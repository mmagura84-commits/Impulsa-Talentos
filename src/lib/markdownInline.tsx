/**
 * Inline markdown (code, bold, italic, links) rendered as React elements.
 *
 * Security: nothing here builds an HTML string. Text reaches the DOM only
 * through React children and attributes, so it is escaped by React, and link
 * targets pass `safeHref` first. (The previous version assembled an HTML
 * string and used dangerouslySetInnerHTML; a quote inside a link URL could
 * break out of the href attribute and inject event handlers — finding F-01.)
 */
import type { ReactNode } from 'react'

/** Only http(s), mailto and same-site absolute paths are linkable. Everything else becomes '#'. */
export function safeHref(raw: string): string {
  const url = raw.trim()
  if (/^mailto:[^\s]+$/i.test(url)) return url
  if (/^https?:\/\//i.test(url)) {
    try {
      const u = new URL(url)
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '#'
    } catch { return '#' }
  }
  // "/path" only: "//host" and "/\host" are protocol-relative in browsers.
  // eslint-disable-next-line no-control-regex -- control characters are exactly what this check rejects
  if (/^\/(?![/\\])/.test(url) && !/[\s\u0000-\u001f]/.test(url)) return url
  return '#'
}

const RULES: { kind: 'code' | 'bold' | 'link' | 'em'; re: RegExp }[] = [
  { kind: 'code', re: /`([^`]+)`/ },
  { kind: 'bold', re: /\*\*([^*]+)\*\*/ },
  { kind: 'link', re: /\[([^\]]+)\]\(([^)]+)\)/ },
  { kind: 'em', re: /_([^_]+)_/ },
]

export function renderInline(source: string, depth = 0): ReactNode[] {
  const out: ReactNode[] = []
  let rest = source
  let key = 0
  while (rest) {
    let best: { kind: (typeof RULES)[number]['kind']; m: RegExpExecArray } | null = null
    for (const r of RULES) {
      const m = r.re.exec(rest)
      if (m && (best === null || m.index < best.m.index)) best = { kind: r.kind, m }
    }
    if (!best) { out.push(rest); break }
    const { kind, m } = best
    if (m.index > 0) out.push(rest.slice(0, m.index))
    const k = `${depth}-${key++}`
    // Nesting is bounded so a hostile string cannot recurse deeply.
    const inner = (s: string) => (depth < 3 ? renderInline(s, depth + 1) : [s])
    if (kind === 'code') out.push(<code key={k} className="rounded bg-muted px-1 py-0.5 text-[12px]">{m[1]}</code>)
    else if (kind === 'bold') out.push(<strong key={k}>{inner(m[1])}</strong>)
    else if (kind === 'em') out.push(<em key={k}>{inner(m[1])}</em>)
    else out.push(<a key={k} href={safeHref(m[2])} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{inner(m[1])}</a>)
    rest = rest.slice(m.index + m[0].length)
  }
  return out
}
