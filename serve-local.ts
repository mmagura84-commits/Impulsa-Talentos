// Production static server for the prerendered site.
// TanStack Start with prerender emits fully static HTML into dist/.
// This wraps dist/ in a Bun server on port 3000 and adds two same-origin
// API proxies (OpenAI AI matching + transactional email) so secret keys
// (OPENAI_API_KEY, EMAIL_API_URL, EMAIL_API_KEY) stay server-side.
const PORT = 3100;
const HOST = "127.0.0.1";
const STATIC_DIR = `${import.meta.dir}/dist`;

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const readBody = async (req: Request): Promise<Record<string, unknown>> => {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
};

// Schema contract for the AI match result (gpt-4.1-mini, JSON mode).
const AI_MATCH_SYSTEM = `You are an expert bilingual recruitment analyst for Impulsa Talentos, a platform connecting Colombian bilingual professionals with top employers.
Analyze how well a CANDIDATE fits a JOB posting. Score each dimension (0-100), provide reasoning, a summary, strengths, and gaps.
Respond with VALID JSON ONLY, using exactly this shape:
{
  "score": number,
  "skillsFit": { "score": number, "reasoning": string },
  "languageFit": { "score": number, "reasoning": string },
  "experienceFit": { "score": number, "reasoning": string },
  "locationFit": { "score": number, "reasoning": string },
  "cultureFit": { "score": number, "reasoning": string },
  "summary": string,
  "strengths": string[],
  "gaps": string[]
}`;

async function handleAiMatch(body: Record<string, unknown>) {
  const prompt = body.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return json({ error: "missing prompt" }, 400);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY not configured" }, 503);
  }
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_MATCH_SYSTEM },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return json({ error: data?.error?.message ?? "OpenAI error" }, 502);
    }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return json({ error: "empty OpenAI response" }, 502);
    }
    return json({ object: JSON.parse(content) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

async function handleEmail(body: Record<string, unknown>) {
  const { to, subject, html, text } = body;
  if (typeof to !== "string" || typeof subject !== "string" || typeof html !== "string") {
    return json({ error: "missing to/subject/html" }, 400);
  }
  const apiUrl = process.env.EMAIL_API_URL;
  if (!apiUrl) {
    console.log(`[email] no EMAIL_API_URL configured — skipped (to=${to}, subject="${subject}")`);
    return json({ ok: true, skipped: true });
  }
  try {
    const apiKey = process.env.EMAIL_API_KEY;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ to, subject, html, text }),
    });
    if (!res.ok) {
      return json({ error: `email provider error ${res.status}` }, 502);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
}

for (let attempt = 1; ; attempt++) {
  try {
    Bun.serve({
      port: PORT,
      hostname: HOST,
      async fetch(req) {
        const { pathname } = new URL(req.url);

        // Same-origin API proxies (POST only).
        if (req.method === "POST") {
          const body = await readBody(req);
          if (pathname === "/api/ai-match") return handleAiMatch(body);
          if (pathname === "/api/email") return handleEmail(body);
          return json({ error: "not found" }, 404);
        }

        // Clean path: /jobs/123 -> jobs/123, / -> index.html
        const filePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");

        // Try exact path, then path/index.html (for route dirs)
        let file = Bun.file(`${STATIC_DIR}/${filePath}`);
        if (!(await file.exists())) {
          file = Bun.file(`${STATIC_DIR}/${filePath}/index.html`);
          if (!(await file.exists())) {
            // SPA fallback: serve index.html for any unmatched route
            file = Bun.file(`${STATIC_DIR}/index.html`);
          }
        }
        return new Response(file);
      },
    });
    break;
  } catch (err) {
    if (attempt >= 10) throw err;
    await Bun.sleep(200);
  }
}

console.log(`LOCAL-FIX Impulsa Talentos serving on http://${HOST}:${PORT}`);
