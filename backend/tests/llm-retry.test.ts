import { describe, it, expect, vi, beforeEach } from "vitest";
import { llmJson, groqQueue } from "../src/services/llm.js";

describe("llm shared queue: 429 backoff + queueWaitMs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    process.env.GROQ_API_KEY = "test-key";
    groqQueue.clear();
  });

  it("retries 429 twice then succeeds", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls <= 2) return { status: 429, ok: false } as any;
      return { status: 200, ok: true, json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }) } as any;
    }));
    const acc = { ms: 0 };
    const r = await llmJson([{ role: "user", content: "hi" }], acc);
    expect(calls).toBe(3);
    expect(r.text).toContain("ok");
    expect(typeof r.queueWaitMs).toBe("number");
    expect(acc.ms).toBeGreaterThanOrEqual(0);
  });

  it("throws VALIDATION without key", async () => {
    delete process.env.GROQ_API_KEY;
    await expect(llmJson([{ role: "user", content: "hi" }])).rejects.toMatchObject({ code: "VALIDATION" });
    process.env.GROQ_API_KEY = "test-key";
  });
});
