// One origin for the local stack, like a hosted Supabase project:
//   /rest/v1/*  -> PostgREST     /auth/v1/* -> GoTrue
//   /storage/v1/*, /functions/v1/* -> 404 (not part of the e2e stack)
const PORT = Number(process.env.PROXY_PORT ?? 54321)
const REST = process.env.REST_URL ?? 'http://127.0.0.1:54331'
const AUTH = process.env.AUTH_URL ?? 'http://127.0.0.1:54332'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Expose-Headers': 'content-range, x-supabase-api-version',
}
Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const url = new URL(req.url)
    let target: string | null = null
    if (url.pathname.startsWith('/rest/v1')) target = REST + url.pathname.slice('/rest/v1'.length) + url.search
    else if (url.pathname.startsWith('/auth/v1')) target = AUTH + url.pathname.slice('/auth/v1'.length) + url.search
    if (!target) return new Response(JSON.stringify({ message: 'not available in e2e stack' }), { status: 404, headers: { ...cors, 'content-type': 'application/json' } })
    const headers = new Headers(req.headers)
    headers.delete('host')
    const res = await fetch(target, {
      method: req.method, headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
      redirect: 'manual',
    })
    const out = new Headers(res.headers)
    for (const [k, v] of Object.entries(cors)) out.set(k, v)
    out.delete('content-encoding'); out.delete('content-length')
    return new Response(await res.arrayBuffer(), { status: res.status, headers: out })
  },
})
console.log(`e2e proxy on :${PORT}`)
