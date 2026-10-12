// Mint a long-lived Supabase-style API key (HS256) for the local e2e stack.
// usage: node e2e/jwt.mjs <secret> <role>
import { createHmac } from 'node:crypto'
const [secret, role] = process.argv.slice(2)
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const head = b64({ alg: 'HS256', typ: 'JWT' })
const body = b64({ iss: 'supabase', role, iat: 1700000000, exp: 2100000000 })
const sig = createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')
process.stdout.write(`${head}.${body}.${sig}`)
