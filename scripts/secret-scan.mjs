#!/usr/bin/env node
// Secret scan for tracked files (security review, CI gate). Prints file:line and
// the secret CATEGORY only — never the value. Exit 1 when anything is found.
// Public Supabase anon keys are allowed (role=anon is public by design); a JWT
// whose role is anything else (service_role, supabase_admin, ...) is a finding.
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const PATTERNS = [
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/],
  ['Stripe live key', /\b[sr]k_live_[A-Za-z0-9]{16,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ['Resend API key', /\bre_[A-Za-z0-9]{24,}\b/],
  ['Anthropic API key', /\bsk-ant-[A-Za-z0-9_-]{20,}\b/],
  ['OpenAI API key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/],
  ['Wompi production key', /\b(?:prod_integrity|prod_events|prv_prod)_[A-Za-z0-9]{16,}\b/],
]
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}\b/g
const SKIP = /(^|\/)(bun\.lock|package-lock\.json|dist|node_modules|public\/images|\.git)(\/|$)|\.(png|jpe?g|webp|gif|ico|pdf|docx|woff2?|ttf|mp4|glb)$/i

/** Returns [{ line, category }] for one file's text. */
export function scanText(text) {
  const findings = []
  text.split('\n').forEach((line, i) => {
    for (const [category, re] of PATTERNS) if (re.test(line)) findings.push({ line: i + 1, category })
    for (const m of line.matchAll(JWT)) {
      try {
        const role = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role
        if (role !== 'anon') findings.push({ line: i + 1, category: `JWT with role "${role ?? 'none'}" (not the public anon key)` })
      } catch { /* not a JWT after all */ }
    }
  })
  return findings
}

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  let count = 0
  for (const f of files) {
    if (SKIP.test(f)) continue
    let text
    try { if (statSync(f).size > 2_000_000) continue; text = readFileSync(f, 'utf8') } catch { continue }
    if (text.includes('\u0000')) continue
    for (const x of scanText(text)) { console.error(`secret-scan: ${f}:${x.line}  ${x.category}`); count++ }
  }
  if (count) { console.error(`secret-scan: ${count} finding(s). Remove the value, then rotate the credential (removal alone does not revoke it).`); process.exit(1) }
  console.log(`secret-scan: ${files.length} tracked files checked, nothing found`)
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
