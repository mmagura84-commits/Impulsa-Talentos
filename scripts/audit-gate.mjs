#!/usr/bin/env node
// Dependency gate (security review, CI): fail on high/critical `npm audit`
// findings unless the package is in docs/security/audit-allowlist.json and the
// entry has not expired. Needs network access to the npm registry.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** Pure decision: which vulnerabilities fail the gate. */
export function failing(auditJson, allowlist, now = new Date()) {
  const allow = new Map((allowlist.allow ?? []).map((a) => [a.package, a]))
  const bad = []
  for (const [name, v] of Object.entries(auditJson.vulnerabilities ?? {})) {
    if (v.severity !== 'high' && v.severity !== 'critical') continue
    const a = allow.get(name)
    if (!a) { bad.push({ name, severity: v.severity, why: 'not allow-listed' }); continue }
    if (!a.expires || new Date(a.expires) < now) bad.push({ name, severity: v.severity, why: `allow-list entry expired ${a.expires ?? '(no date)'}` })
  }
  return bad
}

function main() {
  const allowlist = JSON.parse(readFileSync(new URL('../docs/security/audit-allowlist.json', import.meta.url), 'utf8'))
  const r = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  let json
  try { json = JSON.parse(r.stdout) } catch { console.error('audit-gate: could not read npm audit output (registry unreachable?)\n' + (r.stderr || '').slice(0, 500)); process.exit(2) }
  if (json.error) { console.error('audit-gate: npm audit failed:', json.error.summary ?? json.error.code); process.exit(2) }
  const bad = failing(json, allowlist)
  const totals = json.metadata?.vulnerabilities ?? {}
  console.log(`audit-gate: npm audit reports ${JSON.stringify(totals)}`)
  if (bad.length) { for (const b of bad) console.error(`audit-gate: ${b.severity} ${b.name} — ${b.why}`); process.exit(1) }
  console.log('audit-gate: no un-allow-listed high/critical findings')
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
