import { describe, it, expect } from "vitest";
import { validateKit, BatchOutputSchema, stripMeta } from "@ai-prep/kit-schema";

const goodKit: any = {
  source: { company: "Acme", company_url: "http://x", role: "Dev", location: "", jd_chars: 10, researched_at: new Date().toISOString(), pages_used: [] },
  company_brief: { summary: "s", what_they_do: "w", sources: [] },
  role: { title: "Dev", seniority: "", responsibilities: [], requirements: [{ id: "r1", text: "React", kind: "technical", priority: "must" }] },
  questions: [{ id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 }],
  flashcards: [{ id: "f1", front: "p", back: "a", requirement_ids: ["r1"] }],
  schedule: { days_available: 2, days: [{ day: 1, focus: "Core", question_ids: ["q1"], minutes: 60 }, { day: 2, focus: "Review", question_ids: [], minutes: 30 }] },
  coverage: { uncovered_requirement_ids: [], passes: 1 },
};

describe("Appendix A exactness", () => {
  it("accepts a valid kit", () => {
    expect(validateKit(goodKit).success).toBe(true);
  });

  it("rejects bad enums, float minutes, bad difficulty", () => {
    const bad = JSON.parse(JSON.stringify(goodKit));
    bad.questions[0].difficulty = 5;
    expect(validateKit(bad).success).toBe(false);
    const bad2 = JSON.parse(JSON.stringify(goodKit));
    bad2.schedule.days[0].minutes = 62.5;
    expect(validateKit(bad2).success).toBe(false);
    const bad3 = JSON.parse(JSON.stringify(goodKit));
    bad3.role.requirements[0].priority = "required";
    expect(validateKit(bad3).success).toBe(false);
  });

  it("stripMeta removes _meta deeply and batch output validates", () => {
    const withMeta = { ...goodKit, _meta: { version: 3 }, questions: [{ ...goodKit.questions[0], _meta: { origin: "edited" } }] };
    const cleaned: any = stripMeta(withMeta);
    expect(JSON.stringify(cleaned)).not.toContain("_meta");
    expect(validateKit(cleaned).success).toBe(true);
    const out = { version: "1.0", generated_at: new Date().toISOString(), kits: [{ id: "c1", status: "ok", kit: cleaned, error: null }] };
    expect(BatchOutputSchema.safeParse(out).success).toBe(true);
  });
});
