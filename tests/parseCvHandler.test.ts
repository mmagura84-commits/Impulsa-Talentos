import { beforeAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Run the Deno Edge Function handler under bun with a stand-in runtime and a
// fake Supabase (auth, profiles, storage) so every branch is exercised.
const URL_ = 'https://proj.supabase.co'
const USER = '11111111-1111-1111-1111-111111111111'
const PROFILE = '22222222-2222-2222-2222-222222222222'
const pdf = new Uint8Array(readFileSync(join(import.meta.dir, 'fixtures/cv/chrome-es.pdf')))
const scanned = new Uint8Array(readFileSync(join(import.meta.dir, 'fixtures/cv/scanned.pdf')))

let handler: (req: Request) => Promise<Response>
const saved: { body?: Record<string, unknown>; url?: string; extracted?: Record<string, unknown> } = {}
let claudeDown = false
let files: Record<string, Uint8Array> = {}

beforeAll(async () => {
  ;(globalThis as Record<string, unknown>).Deno = {
    env: { get: (k: string) => ({ SUPABASE_URL: URL_, SUPABASE_ANON_KEY: 'anon', ANTHROPIC_API_KEY: 'test-key' } as Record<string, string>)[k] },
    serve: (h: typeof handler) => { handler = h },
  }
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = String(input)
    const auth = new Headers(init?.headers).get('authorization')
    if (u.startsWith('https://api.anthropic.com/')) {
      if (claudeDown) return new Response('{}', { status: 529 })
      return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ skills: ['SQL', 'Power BI'], languages: [{ name: 'English', level: 'C1' }], years_experience: 4, current_title: 'Analista de Riesgo', desired_role: null, seniority: 'mid', industries: ['Banking'], education: [], summary: 'Analista de datos bilingüe.' }) }] })
    }
    if (!u.startsWith(URL_)) return realFetch(input, init)
    if (u.endsWith('/auth/v1/user')) return auth === 'Bearer good' ? Response.json({ id: USER }) : new Response('{}', { status: 401 })
    if (u.includes('/rest/v1/profiles?select=id')) return Response.json([{ id: PROFILE }])
    if (u.includes('/storage/v1/object/authenticated/cvs/')) {
      const path = decodeURIComponent(u.split('/cvs/')[1])
      return files[path] ? new Response(files[path]) : new Response('{}', { status: 400 })
    }
    if (u.includes(`/rest/v1/profiles?id=eq.${PROFILE}`) && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      if ('cv_extracted' in body) saved.extracted = body; else { saved.url = u; saved.body = body }
      return new Response(null, { status: 204 })
    }
    return new Response('{}', { status: 500 })
  }) as typeof fetch
  await import('../supabase/functions/parse-cv/index.ts')
})

const call = (body: unknown, token = 'good') =>
  handler(new Request(`${URL_}/functions/v1/parse-cv`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))

describe('parse-cv handler', () => {
  test('reads the caller\'s own CV and saves the text on their profile', async () => {
    files = { [`cvs/${USER}/cv.pdf`]: pdf }
    const res = await call({ path: `cvs/${USER}/cv.pdf` })
    expect(res.status).toBe(200)
    expect((await res.json()).format).toBe('pdf')
    expect(String(saved.body?.parsed_cv_text)).toContain('Power BI')
  })
  test('Claude\'s structured fields are saved after the text', async () => {
    files = { [`cvs/${USER}/cv.pdf`]: pdf }
    saved.extracted = undefined
    const res = await call({ path: `cvs/${USER}/cv.pdf` })
    expect((await res.json()).extracted).toBe(true)
    const ex = saved.extracted?.cv_extracted as { skills: string[]; model: string }
    expect(ex.skills).toEqual(['SQL', 'Power BI'])
    expect(ex.model).toBe('claude-haiku-5-5')
  })
  test('Claude being down never fails the upload', async () => {
    files = { [`cvs/${USER}/cv.pdf`]: pdf }
    claudeDown = true
    const res = await call({ path: `cvs/${USER}/cv.pdf` })
    claudeDown = false
    expect(res.status).toBe(200)
    expect((await res.json()).extracted).toBe(false)
  })
  test('application CVs under resumes/<own profile>/ work too', async () => {
    files = { [`resumes/${PROFILE}/job-1.pdf`]: pdf }
    expect((await call({ path: `resumes/${PROFILE}/job-1.pdf` })).status).toBe(200)
  })
  test('someone else\'s file is refused before download', async () => {
    const other = '33333333-3333-3333-3333-333333333333'
    expect((await call({ path: `cvs/${other}/cv.pdf` })).status).toBe(403)
    expect((await call({ path: `resumes/${other}/cv.pdf` })).status).toBe(403)
  })
  test('bad paths, missing sign-in and missing files', async () => {
    expect((await call({ path: '../etc/passwd' })).status).toBe(400)
    expect((await call({ path: `avatars/${USER}/me.png` })).status).toBe(400)
    expect((await call({ path: `cvs/${USER}/cv.pdf` }, 'bad')).status).toBe(401)
    files = {}
    expect((await call({ path: `cvs/${USER}/nope.pdf` })).status).toBe(404)
  })
  test('a scanned CV is reported as unreadable (422), not an error', async () => {
    files = { [`cvs/${USER}/scan.pdf`]: scanned }
    const res = await call({ path: `cvs/${USER}/scan.pdf` })
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('no_text')
  })
})
