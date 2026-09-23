import { describe, it, expect, vi } from "vitest";
import pLimit from "p-limit";
import { llmJson, groqQueue } from "../src/services/llm.js";

// p-limit(3) over cases + shared Groq queue at concurrency 1:
// network-bound crawl parallelizes, Groq calls serialize (no 429 storm),
// and per-case deadlines exclude queue wait (no spurious timeouts).
describe("batch-concurrency (p-limit 3 + shared queue 1)", () => {
  it("serializes Groq calls across concurrent cases (max 1 in flight)", async () => {
    process.env.GROQ_API_KEY = "test-key";
    groqQueue.clear();
    let inFlight = 0;
    let maxInFlight = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 120));
      inFlight--;
      return { status: 200, ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) } as any;
    }));
    const limit = pLimit(3);
    const accs = [{ ms: 0 }, { ms: 0 }, { ms: 0 }];
    await Promise.all(accs.map((acc) => limit(() => llmJson([{ role: "user", content: "hi" }], acc))));
    expect(maxInFlight).toBe(1);
    vi.unstubAllGlobals();
  });

  it("late cases accumulate queue wait (deadline excludes it)", async () => {
    process.env.GROQ_API_KEY = "test-key";
    groqQueue.clear();
    vi.stubGlobal("fetch", vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 150));
      return { status: 200, ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) } as any;
    }));
    const limit = pLimit(3);
    const accs = [{ ms: 0 }, { ms: 0 }, { ms: 0 }];
    await Promise.all(accs.map((acc) => limit(() => llmJson([{ role: "user", content: "hi" }], acc))));
    // at least one case waited behind others in the serial queue
    expect(Math.max(...accs.map((a) => a.ms))).toBeGreaterThanOrEqual(100);
    vi.unstubAllGlobals();
  });
});
