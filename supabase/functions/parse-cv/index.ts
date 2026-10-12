// parse-cv — Supabase Edge Function (Deno)
//
// Extracts plain text from a candidate's CV stored in Supabase Storage.
// The text is used for MATCHING only (populates profiles.parsed_cv_text);
// it is never displayed to anyone.
//
// ── Request ────────────────────────────────────────────────────────────
//   POST /functions/v1/parse-cv
//   Authorization: Bearer <signed-in user's access token>
//   Content-Type: application/json
//   { "fileUrl": "https://<ref>.supabase.co/storage/v1/object/public/cvs/<name>.pdf" }
//
// `fileUrl` may be a public object URL or a signed URL
// (/storage/v1/object/sign/cvs/...). Only this project's own Storage host and
// the `cvs` bucket are accepted (SSRF guard); files over 5 MB are refused.
// Only signed-in users can call it.
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
//   supabase functions deploy parse-cv --project-ref cmdqlybsgkegolqydmbh
//   # then call it from the app:
//   # https://cmdqlybsgkegolqydmbh.supabase.co/functions/v1/parse-cv

// Provided by the Edge runtime: the project's own URL and anon key.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const MAX_BYTES = 5 * 1024 * 1024

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
    // Signed-in users only (the anon key alone is public).
    const auth = req.headers.get('authorization') ?? ''
    if (!auth.startsWith('Bearer ') || !SUPABASE_URL) return json({ error: 'sign in required' }, 401)
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
    })
    if (!who.ok) return json({ error: 'sign in required' }, 401)

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
    const ownHost = new URL(SUPABASE_URL).hostname
    if (
      u.protocol !== 'https:' ||
      u.hostname !== ownHost ||
      !/^\/storage\/v1\/object\/(public|sign|authenticated)\/cvs\//.test(u.pathname)
    ) {
      return json(
        { error: 'fileUrl must be a Supabase Storage URL inside the cvs bucket' },
        400,
      )
    }

    const res = await fetch(u.toString(), { redirect: 'error' })
    if (!res.ok) return json({ error: `download failed (HTTP ${res.status})` }, 502)
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return json({ error: 'file is larger than 5 MB' }, 413)
    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > MAX_BYTES) return json({ error: 'file is larger than 5 MB' }, 413)

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
    }, 200)
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
