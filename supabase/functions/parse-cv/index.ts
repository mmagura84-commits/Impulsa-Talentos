// parse-cv — Supabase Edge Function (Deno)
//
// Extracts plain text from a candidate's CV stored in Supabase Storage.
// The text is used for MATCHING only (populates profiles.parsed_cv_text);
// it is never displayed to anyone.
//
// ── Request ────────────────────────────────────────────────────────────
//   POST /functions/v1/parse-cv
//   Authorization: Bearer <anon or service_role key>
//   Content-Type: application/json
//   { "fileUrl": "https://<ref>.supabase.co/storage/v1/object/public/cvs/<name>.pdf" }
//
// `fileUrl` may be a public object URL or a signed URL
// (/storage/v1/object/sign/cvs/...). Only Supabase Storage URLs in the
// `cvs` bucket are accepted (SSRF guard).
//
// ── Response ───────────────────────────────────────────────────────────
//   200 { "text": "...", "charCount": 1234, "format": "pdf" }
//   400 { "error": "..." }        invalid request / URL
//   422 { "error": "..." }        no extractable text (scanned/image PDF)
//   502 { "error": "..." }        download failure
//
// ── Supported formats ──────────────────────────────────────────────────
//   .txt / .md / .csv  — raw text
//   .pdf               — digitally-generated PDFs (FlateDecode streams +
//                        text operators). Scanned/image-only PDFs are not
//                        supported yet → 422 (consider OCR or a vision
//                        model as a follow-up).
//   .docx / .doc       — NOT supported (zip/OLE containers). Returns 400
//                        with a clear message.
//
// ── Deploy (requires Supabase CLI + project access token) ──────────────
//   supabase login
//   supabase link --project-ref wpnkeryyhsdsislqaegb
//   supabase functions deploy parse-cv
//   # then call it from the app:
//   # https://wpnkeryyhsdsislqaegb.supabase.co/functions/v1/parse-cv

const PROJECT_REF = 'wpnkeryyhsdsislqaegb'

interface ParseCvRequest {
  fileUrl?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const body = (await req.json()) as ParseCvRequest
    const fileUrl = body.fileUrl?.trim()
    if (!fileUrl) return json({ error: 'fileUrl is required' }, 400)

    // SSRF guard: only Supabase Storage URLs in the cvs bucket.
    let u: URL
    try {
      u = new URL(fileUrl)
    } catch {
      return json({ error: 'fileUrl is not a valid URL' }, 400)
    }
    if (!u.hostname.endsWith('supabase.co') || !u.pathname.includes('/cvs/')) {
      return json(
        { error: 'fileUrl must be a Supabase Storage URL inside the cvs bucket' },
        400,
      )
    }

    const res = await fetch(u.toString())
    if (!res.ok) return json({ error: `download failed (HTTP ${res.status})` }, 502)
    const buf = new Uint8Array(await res.arrayBuffer())

    const fileName = (u.pathname.split('/').pop() || 'unknown').toLowerCase()
    if (!/\.(txt|md|csv|pdf)$/.test(fileName)) {
      return json(
        { error: `unsupported format "${fileName}" — supported: .txt, .md, .csv, .pdf` },
        400,
      )
    }

    const text = await extractText(buf, fileName)
    if (!text.trim()) {
      return json(
        {
          error:
            'no extractable text found — this CV may be a scanned/image PDF (OCR not supported yet)',
        },
        422,
      )
    }
    return json({
      text: text.trim(),
      charCount: text.trim().length,
      format: fileName.split('.').pop(),
    })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function extractText(buf: Uint8Array, fileName: string): Promise<string> {
  if (/\.(txt|md|csv)$/.test(fileName)) {
    return new TextDecoder().decode(buf)
  }
  return extractPdfText(buf)
}

// ── Minimal text-based PDF extractor (zero external dependencies) ──────
// Handles digitally-generated PDFs (typical resumes): finds stream objects,
// decompresses /FlateDecode streams (zlib) with DecompressionStream, then
// pulls text-showing operators: (…) Tj, (…) ', (…) " and […] TJ arrays.
// Scanned/image-only PDFs yield no text → caller returns 422.
//
// NOTE: we never use TextDecoder('latin1') — per the WHATWG Encoding spec
// that label maps to windows-1252, silently corrupting bytes 0x80–0x9F.
// bytesToLatin1() below is the portable 1:1 byte↔string mapping.

/** 1:1 byte → latin1 string (safe across Deno/bun/browsers). */
function bytesToLatin1(buf: Uint8Array): string {
  let s = ''
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i])
  return s
}

async function extractPdfText(buf: Uint8Array): Promise<string> {
  // Binary-safe decode keeps stream offsets exact for regex scanning.
  const src = bytesToLatin1(buf)
  const chunks: string[] = []

  const streamRe = /<<([^]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g
  let m: RegExpExecArray | null
  while ((m = streamRe.exec(src)) !== null) {
    const dict = m[1]
    const raw = m[2]
    if (/\/Fl(ate)?Decode/.test(dict)) {
      try {
        // raw is a 1:1 latin1 string — convert back to bytes before inflating.
        const bytes = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff
        chunks.push(bytesToLatin1(await inflateZlib(bytes)))
      } catch {
        continue // corrupt stream — skip
      }
    } else if (!/\/Filter/.test(dict)) {
      chunks.push(raw) // uncompressed stream
    }
    // Other filters (LZW, ASCIIHex, ...) are rare in resumes — skip.
  }

  const all = chunks.join('\n')
  const pieces: string[] = []

  // (…) Tj | (…) ' | (…) "
  const tjRe = /\(((?:[^()\\]|\\.)*)\)\s*(?:Tj|'|")/g
  let tm: RegExpExecArray | null
  while ((tm = tjRe.exec(all)) !== null) pieces.push(unescapePdfString(tm[1]))

  // [ (…) -250 (…) -300 ] TJ — extract each parenthesized string
  const arrRe = /\[([^\]]*)\]\s*TJ/g
  let am: RegExpExecArray | null
  while ((am = arrRe.exec(all)) !== null) {
    const innerRe = /\(((?:[^()\\]|\\.)*)\)/g
    let im: RegExpExecArray | null
    while ((im = innerRe.exec(am[1])) !== null) pieces.push(unescapePdfString(im[1]))
  }

  return pieces.join(' ')
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\([nrtbf()\\])/g, (_, c: string) =>
      c === 'n' ? '\n' : c === 'r' ? '\r' : c === 't' ? '\t' : c === 'b' ? '\b' : c === 'f' ? '\f' : c,
    )
    .replace(/\\(\d{1,3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\([()\\])/g, '$1')
}

async function inflateZlib(data: Uint8Array): Promise<Uint8Array> {
  // Compression Streams API "deflate" == zlib (RFC 1950) — what PDF
  // /FlateDecode stores. Supported in the Supabase Edge runtime (Deno).
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([data]).stream().pipeThrough(ds)
  const out = await new Response(stream).arrayBuffer()
  return new Uint8Array(out)
}
