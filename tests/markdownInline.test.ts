// Regression tests for finding F-01 (stored XSS through markdown link URLs).
import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownPreview } from '../src/components/MarkdownPreview'
import { safeHref } from '../src/lib/markdownInline'

const html = (source: string) => renderToStaticMarkup(createElement(MarkdownPreview, { source }))
/** Attribute names present on any tag in the output. */
const attrs = (out: string) => [...out.matchAll(/<\w+([^>]*)>/g)].flatMap(m => [...m[1].matchAll(/\s([a-z-]+)=/g)].map(a => a[1]))

describe('F-01: attribute injection through link URLs', () => {
  const payloads = [
    '[click](/" onmouseover="window.__xss=1" x=")',
    '[a](https://x.test/" autofocus onfocus="window.__xss=1)',
    "[a](/' onmouseover='alert(1))",
    '[a](/" style="position:fixed;inset:0" onclick="alert(1))',
  ]
  for (const p of payloads) {
    test(`no event-handler or style attribute: ${p.slice(0, 40)}`, () => {
      const out = html(p)
      const names = attrs(out)
      expect(names.filter(n => n.startsWith('on'))).toEqual([])
      expect(names).not.toContain('style')
      expect(names).not.toContain('autofocus')
    })
  }
})

describe('safeHref allow-list', () => {
  test('allows http, https, mailto and same-site paths', () => {
    expect(safeHref('https://example.com/a_b?x=1')).toBe('https://example.com/a_b?x=1')
    expect(safeHref('http://example.com')).toBe('http://example.com/')
    expect(safeHref('mailto:jobs@impulsatalentos.expert')).toBe('mailto:jobs@impulsatalentos.expert')
    expect(safeHref('/jobs/123')).toBe('/jobs/123')
  })
  for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', '//evil.com', '/\\evil.com', '/ x', 'ftp://x', '', 'relative/path', 'java\tscript:alert(1)']) {
    test(`rejects ${JSON.stringify(bad)}`, () => expect(safeHref(bad)).toBe('#'))
  }
})

describe('rendering', () => {
  test('HTML in text is escaped', () => {
    const out = html('<script>alert(1)</script> & <img src=x onerror=alert(1)>')
    expect(out).not.toContain('<script')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;script&gt;')
  })
  test('supported markdown still renders', () => {
    const out = html('# Title\n\n**bold** _em_ `code` [site](https://example.com)\n\n- one\n- two\n\n1. a\n2. b\n\n> quote\n\n---')
    for (const frag of ['<strong>bold</strong>', '<em>em</em>', '<code', 'href="https://example.com/"', 'rel="noopener noreferrer"', '<ul', '<ol', '<blockquote', '<hr']) expect(out).toContain(frag)
  })
  test('bold inside a link and underscores in a URL work', () => {
    const out = html('[**hi**](https://example.com/a_b_c)')
    expect(out).toContain('href="https://example.com/a_b_c"')
    expect(out).toContain('<strong>hi</strong>')
  })
  test('empty input renders nothing and hostile nesting terminates', () => {
    expect(html('   ')).toBe('')
    expect(html('**'.repeat(5000) + '_'.repeat(5000)).length).toBeGreaterThan(0)
  })
})
