// Text extraction for candidate CVs (PDF and DOCX), shared by the parse-cv
// Edge Function (Deno) and its unit tests (bun). Pure: bytes in, text out.
//
// PDF: unpdf (a serverless build of Mozilla PDF.js). Unlike a regex scan of
//      content streams, PDF.js decodes embedded/CID fonts through their
//      ToUnicode maps, which is how Word, Google Docs and Canva export CVs.
// DOCX: a zip of XML parts; we read word/document.xml (plus headers/footers)
//      and keep the text runs, paragraphs and table cells.
// Legacy .doc (binary Word 97) and scanned/image-only PDFs are not supported;
// the caller tells the candidate to upload a PDF or DOCX instead.
import { extractText, getDocumentProxy } from 'unpdf'
import { strFromU8, unzipSync } from 'fflate'

export type CvFormat = 'pdf' | 'docx'
export const MAX_CV_TEXT = 20_000

export class UnsupportedCvError extends Error {}

/** Detect the format from the file's magic bytes (not its name). */
export function detectFormat(bytes: Uint8Array): CvFormat | null {
  if (bytes.length > 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf' // %PDF
  if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'docx' // PK zip
  return null
}

/** Collapse whitespace, drop control characters, cap the length. */
export function normalizeCvText(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CV_TEXT)
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const { text } = await extractText(pdf, { mergePages: true })
  return Array.isArray(text) ? text.join('\n') : text
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
}

function wordXmlText(xml: string): string {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:(br|cr)\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<w:delText\b[^>]*>[\s\S]*?<\/w:delText>/g, '') // tracked deletions
      .replace(/<[^>]+>/g, ''),
  )
}

function docxText(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, { filter: f => /^word\/(document|header\d*|footer\d*)\.xml$/.test(f.name) })
  } catch {
    throw new UnsupportedCvError('not a valid DOCX file')
  }
  const main = files['word/document.xml']
  if (!main) throw new UnsupportedCvError('not a Word document (no word/document.xml)')
  const parts = [main, ...Object.entries(files).filter(([n]) => n !== 'word/document.xml').map(([, v]) => v)]
  return parts.map(p => wordXmlText(strFromU8(p))).join('\n')
}

/** Extract normalized plain text from a CV file. */
export async function extractCvText(bytes: Uint8Array): Promise<{ format: CvFormat; text: string }> {
  const format = detectFormat(bytes)
  if (!format) throw new UnsupportedCvError('unsupported file type — upload a PDF or DOCX')
  const raw = format === 'pdf' ? await pdfText(bytes) : docxText(bytes)
  return { format, text: normalizeCvText(raw) }
}
