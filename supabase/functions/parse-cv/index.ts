// parse-cv — Supabase Edge Function (Deno)
//
// Reads the signed-in candidate's CV from the private `cvs` bucket, extracts
// its text (PDF or DOCX, see extract.ts) and stores it in their own
// profiles.parsed_cv_text, which the matcher uses as evidence of skills.
// The text is never shown to anyone. When ANTHROPIC_API_KEY is set, Claude
// then turns the text into structured fields (claude.ts) stored in
// profiles.cv_extracted: suggestions for the candidate's profile and extra
// evidence for matching. Extraction failing never fails the upload.
//
// Request:  POST /functions/v1/parse-cv  { "path": "cvs/<auth-user-id>/<file>" | "resumes/<profile-id>/<file>" }
// Response: 200 { format, charCount, extracted } · 400 · 401 · 403 · 413 · 415 · 422 (no text) · 429 (quota)
import { extractCvText, UnsupportedCvError } from './extract.ts'
import { CLAUDE_MODEL, extractWithClaude } from './claude.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const MAX_BYTES = 10 * 1024 * 1024
// One line per cold start, so the logs show whether the Claude step is wired
// up without anyone having to upload a CV to find out. Never logs the key.
console.info(`parse-cv ready · claude ${ANTHROPIC_KEY ? 'on' : 'OFF (set ANTHROPIC_API_KEY)'}`)
const PATH_RE = /^(cvs|resumes)\/([0-9a-f-]{36})\/[^/]{1,200}$/i

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  try {
    const auth = req.headers.get('authorization') ?? ''
    if (!auth.startsWith('Bearer ') || !SUPABASE_URL) return json({ error: 'sign in required' }, 401)
    const asUser = { apikey: ANON, Authorization: auth }
    const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: asUser })
    if (!who.ok) return json({ error: 'sign in required' }, 401)
    const userId = String((await who.json())?.id ?? '')

    const { path } = (await req.json().catch(() => ({}))) as { path?: string }
    const m = typeof path === 'string' ? PATH_RE.exec(path) : null
    if (!m || path!.includes('..')) return json({ error: 'path must be cvs/<user>/<file> or resumes/<profile>/<file>' }, 400)

    // The file must be the caller's own CV.
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&user_id=eq.${encodeURIComponent(userId)}`, { headers: asUser })
    const own = profRes.ok ? ((await profRes.json()) as { id: string }[])[0] : undefined
    if (!own) return json({ error: 'create your profile first' }, 403)
    const owner = m[2].toLowerCase()
    if ((m[1] === 'cvs' && owner !== userId.toLowerCase()) || (m[1] === 'resumes' && owner !== own.id.toLowerCase())) {
      return json({ error: 'not your file' }, 403)
    }

    // Per-user quota (migration 052): each parse can call the Claude API. Fails open only when
    // the function does not exist yet (HTTP 404, i.e. the migration has not been applied).
    const quota = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_cv_parse`, {
      method: 'POST', headers: { ...asUser, 'Content-Type': 'application/json' }, body: '{}',
    })
    if (quota.status !== 404 && (!quota.ok || (await quota.json()) !== true)) {
      return json({ error: 'too many CV uploads — try again in an hour', code: 'rate_limited' }, 429)
    }

    const file = await fetch(`${SUPABASE_URL}/storage/v1/object/authenticated/cvs/${path!.split('/').map(encodeURIComponent).join('/')}`, { headers: asUser })
    if (file.status === 400 || file.status === 404) return json({ error: 'file not found' }, 404)
    if (!file.ok) return json({ error: `download failed (HTTP ${file.status})` }, 502)
    if (Number(file.headers.get('content-length') ?? 0) > MAX_BYTES) return json({ error: 'file is larger than 10 MB' }, 413)
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > MAX_BYTES) return json({ error: 'file is larger than 10 MB' }, 413)

    let result
    try {
      result = await extractCvText(bytes)
    } catch (err) {
      if (err instanceof UnsupportedCvError) return json({ error: err.message, code: 'unsupported' }, 415)
      throw err
    }
    if (!result.text) return json({ error: 'no text found — this looks like a scanned image', code: 'no_text' }, 422)

    const upd = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${own.id}`, {
      method: 'PATCH',
      headers: { ...asUser, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ parsed_cv_text: result.text }),
    })
    if (!upd.ok) return json({ error: `could not save (HTTP ${upd.status})` }, 502)

    // Structured fields with Claude (optional; the text is already saved).
    let extracted = false
    if (ANTHROPIC_KEY) {
      try {
        const fields = await extractWithClaude(result.text, ANTHROPIC_KEY)
        const save = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${own.id}`, {
          method: 'PATCH',
          headers: { ...asUser, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ cv_extracted: { ...fields, model: CLAUDE_MODEL }, cv_extracted_at: new Date().toISOString() }),
        })
        extracted = save.ok
      } catch (err) {
        console.error('parse-cv extraction', err instanceof Error ? err.message : err)
      }
    }
    return json({ format: result.format, charCount: result.text.length, extracted })
  } catch (err) {
    console.error('parse-cv', err)
    return json({ error: 'internal error' }, 500)
  }
})
