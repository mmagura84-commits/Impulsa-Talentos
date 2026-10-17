// Regression tests for finding F-06: a small DOCX that inflates to a huge document.xml.
import { describe, expect, test } from 'bun:test'
import { zipSync } from 'fflate'
import { extractCvText, UnsupportedCvError, MAX_DOCX_PART_BYTES } from '../supabase/functions/parse-cv/extract'

const docx = (parts: Record<string, Uint8Array>) => {
  const entries: Record<string, [Uint8Array, { level: 9 }]> = {}
  for (const [k, v] of Object.entries(parts)) entries[k] = [v, { level: 9 }]
  return zipSync(entries)
}
const xml = (body: string) => new TextEncoder().encode(`<w:document><w:body><w:p><w:r><w:t>${body}</w:t></w:r></w:p></w:body></w:document>`)

describe('DOCX zip-bomb guard', () => {
  test('a ~25 KB file that inflates to 24 MB is refused without being inflated', async () => {
    const bomb = docx({ 'word/document.xml': new Uint8Array(24 * 1024 * 1024) })
    expect(bomb.length).toBeLessThan(100_000)
    await expect(extractCvText(bomb)).rejects.toThrow(UnsupportedCvError)
  })
  test('several parts that together exceed the total cap are refused', async () => {
    const part = new Uint8Array(MAX_DOCX_PART_BYTES - 1024)
    const z = docx({ 'word/document.xml': part, 'word/header1.xml': part, 'word/footer1.xml': part })
    await expect(extractCvText(z)).rejects.toThrow(UnsupportedCvError)
  })
  test('a header that lies about the size cannot inflate past it', async () => {
    const z = docx({ 'word/document.xml': new Uint8Array(8 * 1024 * 1024) })
    const dv = new DataView(z.buffer, z.byteOffset, z.byteLength)
    dv.setUint32(22, 1000, true)
    for (let i = z.length - 22; i > 0; i--) if (dv.getUint32(i, true) === 0x02014b50) { dv.setUint32(i + 24, 1000, true); break }
    const r = await extractCvText(z).catch(e => e)
    // Either refused or truncated to the declared 1000 bytes — never an 8 MB string.
    if (!(r instanceof Error)) expect(r.text.length).toBeLessThanOrEqual(1000)
  })
  test('a normal DOCX still extracts', async () => {
    const r = await extractCvText(docx({ 'word/document.xml': xml('Hola Mundo') }))
    expect(r.format).toBe('docx')
    expect(r.text).toContain('Hola Mundo')
  })
})
