import { describe, it, expect } from "vitest";
import { stripMeta, validateKit } from "@ai-prep/kit-schema";

describe("batch output hygiene (Appendix B exact)", () => {
  it("strips _meta everywhere and cleaned kit validates", () => {
    const kit: any = {
      source: { company: "A", company_url: "http://a", role: "R", location: "", jd_chars: 5, researched_at: new Date().toISOString(), pages_used: [] },
      company_brief: { summary: "s", what_they_do: "w", sources: [] },
      role: { title: "R", seniority: "", responsibilities: [], requirements: [{ id: "r1", text: "x", kind: "technical", priority: "must", _meta: { origin: "generated" } }] },
      questions: [],
      flashcards: [],
      schedule: { days_available: 1, days: [{ day: 1, focus: "Core", question_ids: [], minutes: 30 }] },
      coverage: { uncovered_requirement_ids: ["r1"], passes: 2 },
      _meta: { version: 2 },
    };
    const cleaned: any = stripMeta(kit);
    expect(JSON.stringify(cleaned)).not.toContain("_meta");
    expect(validateKit(cleaned).success).toBe(true);
  });
});
