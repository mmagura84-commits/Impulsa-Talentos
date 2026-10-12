import { describe, expect, test } from 'bun:test'
import { CLAUDE_MODEL, CV_SCHEMA, extractWithClaude, redactCv, sanitizeExtraction } from '../supabase/functions/parse-cv/claude'

describe('CV redaction before Claude', () => {
  test('removes emails, links, phone and ID numbers but keeps dates', () => {
    const out = redactCv('María Peña · maria.pena@gmail.com · +57 300 123 4567 · C.C. 1.036.123.456 · linkedin.com/in/mpena · https://mpena.dev\nBancolombia 2019 - 2023 · Teleperformance 2016-2019')
    expect(out).not.toContain('gmail')
    expect(out).not.toContain('300 123')
    expect(out).not.toContain('1.036.123.456')
    expect(out).not.toContain('linkedin.com')
    expect(out).not.toContain('mpena.dev')
    expect(out).toContain('2019 - 2023')
    expect(out).toContain('2016-2019')
  })
})

describe('structured-output schema follows the API rules', () => {
  // Every object closes additionalProperties and requires all its keys; no
  // numeric or length constraints (unsupported by structured outputs).
  const walk = (node: unknown, path = '$'): string[] => {
    if (!node || typeof node !== 'object') return []
    const n = node as Record<string, unknown>
    const errs: string[] = []
    for (const bad of ['minimum', 'maximum', 'minLength', 'maxLength', 'multipleOf']) if (bad in n) errs.push(`${path}.${bad}`)
    if (n.type === 'object') {
      if (n.additionalProperties !== false) errs.push(`${path} additionalProperties`)
      const keys = Object.keys((n.properties ?? {}) as object).sort()
      if (JSON.stringify([...(n.required as string[] ?? [])].sort()) !== JSON.stringify(keys)) errs.push(`${path} required`)
    }
    for (const [k, v] of Object.entries(n)) errs.push(...(Array.isArray(v) ? v.flatMap((x, i) => walk(x, `${path}.${k}[${i}]`)) : walk(v, `${path}.${k}`)))
    return errs
  }
  test('no violations', () => expect(walk(CV_SCHEMA)).toEqual([]))
})

describe('extraction clean-up', () => {
  test('bounds and normalizes the model output', () => {
    const x = sanitizeExtraction({
      skills: ['SQL', 'SQL', ' Power BI ', ...Array.from({ length: 40 }, (_, i) => `s${i}`)],
      languages: [{ name: 'English', level: 'C1' }, { name: 'Spanish', level: 'fluentish' }],
      years_experience: 4.25, seniority: 'wizard', industries: [], education: [], summary: 'x'.repeat(900),
      current_title: '  ', desired_role: null,
    })
    expect(x.skills.length).toBe(25)
    expect(x.skills.slice(0, 2)).toEqual(['SQL', 'Power BI'])
    expect(x.languages).toEqual([{ name: 'English', level: 'C1' }, { name: 'Spanish', level: 'unknown' }])
    expect(x.years_experience).toBe(4.3)
    expect(x.seniority).toBe('unknown')
    expect(x.current_title).toBeNull()
    expect(x.summary.length).toBe(400)
    expect(sanitizeExtraction({ years_experience: -3 }).years_experience).toBeNull()
  })
})

describe('Claude request', () => {
  test('sends Haiku 5.5 with output_config json_schema and parses the reply', async () => {
    let sent: Record<string, unknown> = {}
    let headers = new Headers()
    const fake = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body)); headers = new Headers(init.headers)
      return Response.json({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ skills: ['SQL'], languages: [], years_experience: 3, current_title: null, desired_role: null, seniority: 'mid', industries: [], education: [], summary: 'Analista.' }) }] })
    }) as unknown as typeof fetch
    const out = await extractWithClaude('CV de prueba ana@x.co', 'test-key', fake)
    expect(sent.model).toBe(CLAUDE_MODEL)
    expect(CLAUDE_MODEL).toBe('claude-haiku-5-5')
    expect((sent.output_config as { format: { type: string } }).format.type).toBe('json_schema')
    expect(headers.get('anthropic-version')).toBe('2023-06-01')
    expect(JSON.stringify(sent.messages)).not.toContain('ana@x.co')
    expect(out.skills).toEqual(['SQL'])
    expect(out.years_experience).toBe(3)
  })
  test('a refusal or HTTP error throws (the caller keeps the CV anyway)', async () => {
    const refusal = (async () => Response.json({ stop_reason: 'refusal', content: [] })) as unknown as typeof fetch
    await expect(extractWithClaude('x', 'k', refusal)).rejects.toThrow('refusal')
    const down = (async () => new Response('{}', { status: 529 })) as unknown as typeof fetch
    await expect(extractWithClaude('x', 'k', down)).rejects.toThrow('529')
  })
})
