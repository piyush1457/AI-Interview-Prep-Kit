import { describe, it, expect } from "vitest";
import { ErrorCode, BatchOutputSchema } from "@ai-prep/kit-schema";
import { withWallClock } from "../src/evaluate.js";

const fullKit = () => ({
  source: { company: "Acme", company_url: "https://a.com", role: "Dev", location: "", jd_chars: 10, researched_at: new Date().toISOString(), pages_used: [] },
  company_brief: { summary: "s", what_they_do: "w", sources: [] },
  role: { title: "Dev", seniority: "", responsibilities: [], requirements: [{ id: "r1", text: "Go", kind: "technical", priority: "must" }] },
  questions: [{ id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 }],
  flashcards: [{ id: "f1", front: "p", back: "a", requirement_ids: ["r1"] }],
  schedule: { days_available: 3, days: [{ day: 1, focus: "f", question_ids: ["q1"], minutes: 45 }] },
  coverage: { uncovered_requirement_ids: [], passes: 1 },
});

// Outer wall-clock contract: pathological contention still writes output
// within the budget; already-finished cases keep their real results and only
// pending cases become BATCH_TIMEOUT (never hangs, never discards completed).
describe("batch-wall-clock (outer budget, real withWallClock)", () => {
  it("flushes completed results + BATCH_TIMEOUT for pending on expiry", async () => {
    const WALL = 300;
    const hanging = new Promise<any[]>(() => {}); // never resolves
    const completed = [
      { id: "c1", status: "ok" as const, kit: fullKit(), error: null },
      { id: "c2", status: "failed" as const, kit: null, error: { code: ErrorCode.LLM_INVALID_JSON, message: "bad json" } },
    ];
    const started = Date.now();
    const kits = await withWallClock(
      hanging,
      ["c1", "c2", "c3"],
      WALL,
      () => completed
    );
    expect(Date.now() - started).toBeLessThan(5000);
    expect(kits).toHaveLength(3);
    // completed ok survives
    expect(kits.find((k) => k.id === "c1")?.status).toBe("ok");
    // completed failure keeps its real code
    expect(kits.find((k) => k.id === "c2")?.error.code).toBe(ErrorCode.LLM_INVALID_JSON);
    // only the pending case becomes BATCH_TIMEOUT
    const pending = kits.find((k) => k.id === "c3");
    expect(pending?.status).toBe("failed");
    expect(pending?.error.code).toBe(ErrorCode.BATCH_TIMEOUT);
    const out = { version: "1.0" as const, generated_at: new Date().toISOString(), kits };
    expect(BatchOutputSchema.safeParse(out).success).toBe(true);
  });

  it("returns batch results intact when they finish before the wall", async () => {
    const batch = Promise.resolve([
      { id: "a", status: "ok" as const, kit: fullKit(), error: null },
    ]);
    const kits = await withWallClock(batch, ["a"], 60_000, () => []);
    expect(kits).toHaveLength(1);
    expect(kits[0].status).toBe("ok");
  });
});
