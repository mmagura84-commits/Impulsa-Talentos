import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectFormat, extractCvText, normalizeCvText, UnsupportedCvError, MAX_CV_TEXT } from '../supabase/functions/parse-cv/extract'

const fixture = (name: string) => new Uint8Array(readFileSync(join(import.meta.dir, 'fixtures/cv', name)))

describe('parse-cv text extraction', () => {
  test('reads a browser/Word-style PDF with embedded fonts and Spanish accents', async () => {
    const { format, text } = await extractCvText(fixture('chrome-es.pdf'))
    expect(format).toBe('pdf')
    expect(text).toContain('María José Peña Gutiérrez')
    expect(text).toContain('Medellín')
    expect(text).toContain('Power BI')
    expect(text).toContain('Inglés C1')
  })

  test('reads a DOCX, including tables and escaped characters', async () => {
    const { format, text } = await extractCvText(fixture('en-table.docx'))
    expect(format).toBe('docx')
    expect(text).toContain('John Ramírez')
    expect(text).toContain('Zendesk, Salesforce & HubSpot')
    expect(text).toContain('Teleperformance')
    expect(text).toContain('Team Lead <CX>')
  })

  test('an image-only (scanned) PDF yields no text', async () => {
    const { text } = await extractCvText(fixture('scanned.pdf'))
    expect(text).toBe('')
  })

  test('legacy .doc and other files are rejected by content, not name', async () => {
    expect(detectFormat(fixture('legacy.doc'))).toBeNull()
    await expect(extractCvText(fixture('legacy.doc'))).rejects.toBeInstanceOf(UnsupportedCvError)
    await expect(extractCvText(new TextEncoder().encode('just text'))).rejects.toBeInstanceOf(UnsupportedCvError)
  })

  test('normalizes whitespace and caps the length', () => {
    expect(normalizeCvText('a\u0000b \t\t c\n\n\n\nd')).toBe('a b c\n\nd')
    expect(normalizeCvText('x'.repeat(MAX_CV_TEXT + 50)).length).toBe(MAX_CV_TEXT)
  })
})
