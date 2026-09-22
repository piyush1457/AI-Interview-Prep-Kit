import PQueue from "p-queue";

// Single module-level shared queue: concurrency 1 + gap across ALL jobs.
// Tracks per-case queueWaitMs so per-case deadlines exclude queue contention (v2 fix A).
const GROQ_DELAY_MS = Number(process.env.GROQ_DELAY_MS || 500);
export const groqQueue = new PQueue({ concurrency: 1, intervalCap: 1, interval: GROQ_DELAY_MS });

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b"; // Groq retired Llama chat models; gpt-oss-20b is the fast free-tier default

export interface LlmCallResult {
  text: string;
  queueWaitMs: number;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function groqChat(messages: { role: string; content: string }[], timeoutMs = 45_000): Promise<string> {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) throw Object.assign(new Error("GROQ_API_KEY missing"), { code: "VALIDATION" });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, response_format: { type: "json_object" } }),
    });
    if (res.status === 429 || res.status >= 500) {
      const err: any = new Error(`Groq HTTP ${res.status}`);
      err.code = "RATE_LIMITED";
      err.status = res.status;
      throw err;
    }
    if (!res.ok) throw Object.assign(new Error(`Groq HTTP ${res.status}`), { code: "LLM_INVALID_JSON" });
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content || "";
    if (!text) throw Object.assign(new Error("Empty LLM response"), { code: "LLM_INVALID_JSON" });
    return text;
  } finally {
    clearTimeout(t);
  }
}

export interface QueueWaitAccum {
  ms: number;
}

/** Run one JSON chat via shared queue with 3x exponential backoff on 429/5xx.
 * Accumulates this call's queue wait into `acc` (v2 fix A: per-case deadline
 * excludes contention). When `acc` omitted, still returns the wait. */
export async function llmJson(messages: { role: string; content: string }[], acc?: QueueWaitAccum): Promise<LlmCallResult> {
  const enqueuedAt = Date.now();
  let waited = 0;
  const text = await groqQueue.add(async () => {
    waited = Date.now() - enqueuedAt;
    if (acc) acc.ms += waited;
    let lastErr: any;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await groqChat(messages);
      } catch (e: any) {
        lastErr = e;
        if (e?.code === "RATE_LIMITED" && attempt < 3) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  });
  return { text: String(text), queueWaitMs: waited };
}

/** Parse JSON with one repair attempt: strip fences, then ask model to fix. */
export function safeParseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as T;
}
