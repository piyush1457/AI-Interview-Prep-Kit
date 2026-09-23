import { describe, it, expect, vi } from "vitest";
import { runCase } from "../src/evaluate.js";

// CLI reruns must always re-run the pipeline (bypassDedupe), never return stale kits.
describe("dedupe-bypass (CLI always fresh)", () => {
  it("passes bypassDedupe:true to the pipeline", async () => {
    let seen: any = null;
    const fakePipeline = vi.fn(async (input: any, ev: any) => {
      seen = { input, ev };
      return { kit: minimalKit(), warnings: [], context: { hiring: "", discText: "", crawlText: "" } };
    });
    const entry = await runCase(
      { id: "c1", jd: "Senior Dev with 5 years Node, mentoring juniors, bonus Go", company_url: "https://acme.com", days: 3 },
      fakePipeline as any
    );
    expect(fakePipeline).toHaveBeenCalledOnce();
    expect(seen.input.bypassDedupe).toBe(true);
    expect(entry.status).toBe("ok");
    expect(entry.error).toBeNull();
  });

  it("second run on same input re-runs (no cache)", async () => {
    let n = 0;
    const fakePipeline = vi.fn(async () => ({ kit: minimalKit(n++), warnings: [], context: { hiring: "", discText: "", crawlText: "" } }));
    const c = { id: "c1", jd: "x".repeat(100), company_url: "https://acme.com", days: 2 };
    const r1 = await runCase(c, fakePipeline as any);
    const r2 = await runCase(c, fakePipeline as any);
    expect(fakePipeline).toHaveBeenCalledTimes(2);
    expect(r1.status).toBe("ok");
    expect(r2.status).toBe("ok");
  });

  it("invalid rows fail VALIDATION without touching the pipeline", async () => {
    const fakePipeline = vi.fn();
    const entry = await runCase({ id: "bad", jd: "", company_url: "x", days: 99 }, fakePipeline as any);
    expect(entry.status).toBe("failed");
    expect(entry.error.code).toBe("VALIDATION");
    expect(fakePipeline).not.toHaveBeenCalled();
  });
});

function minimalKit(n = 0): any {
  return {
    source: { company: "A", company_url: "https://acme.com", role: `R${n}`, location: "", jd_chars: 100, researched_at: new Date().toISOString(), pages_used: [] },
    company_brief: { summary: "s", what_they_do: "w", sources: [] },
    role: { title: "R", seniority: "", responsibilities: [], requirements: [{ id: "r1", text: "x", kind: "technical", priority: "must" }] },
    questions: [{ id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 }],
    flashcards: [{ id: "f1", front: "p", back: "a", requirement_ids: ["r1"] }],
    schedule: { days_available: 2, days: [{ day: 1, focus: "Core", question_ids: ["q1"], minutes: 60 }, { day: 2, focus: "Review", question_ids: [], minutes: 30 }] },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}
