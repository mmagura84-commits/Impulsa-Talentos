import { describe, expect, test } from 'bun:test'
import { scanText } from '../scripts/secret-scan.mjs'
import { failing } from '../scripts/audit-gate.mjs'

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ iss: 'supabase', role })).toString('base64url')}.c2lnbmF0dXJlLXZhbHVlLWhlcmU`

describe('secret-scan', () => {
  test('flags private keys, cloud/API tokens and non-anon JWTs, by category only', () => {
    const text = [
      '-----BEGIN RSA PRIVATE KEY-----',
      'const a = "AKIA' + 'ABCDEFGHIJKLMNOP"',
      'token: "ghp_' + 'a'.repeat(36) + '"',
      'k = "sk-ant-' + 'x'.repeat(30) + '"',
      `const j = "${jwt('service_role')}"`,
    ].join('\n')
    const cats = scanText(text).map(f => f.category)
    expect(cats).toEqual(expect.arrayContaining(['private key', 'AWS access key', 'GitHub token', 'Anthropic API key', 'JWT with role "service_role" (not the public anon key)']))
    expect(JSON.stringify(scanText(text))).not.toContain('ghp_')
  })
  test('the public anon key and ordinary code are not findings', () => {
    expect(scanText(`const anon = "${jwt('anon')}"`)).toEqual([])
    expect(scanText('const x = process.env.RESEND_API_KEY // re_ is just text here')).toEqual([])
  })
})

describe('audit-gate', () => {
  const audit = { vulnerabilities: { braces: { severity: 'high' }, lodash: { severity: 'critical' }, tiny: { severity: 'low' } } }
  const allow = { allow: [{ package: 'braces', expires: '2027-01-17' }] }
  test('allow-listed, unexpired findings pass; others fail; low severity is ignored', () => {
    const bad = failing(audit, allow, new Date('2026-10-17'))
    expect(bad.map(b => b.name)).toEqual(['lodash'])
  })
  test('an expired allow-list entry fails again', () => {
    expect(failing(audit, allow, new Date('2027-02-01')).map(b => b.name).sort()).toEqual(['braces', 'lodash'])
  })
})
