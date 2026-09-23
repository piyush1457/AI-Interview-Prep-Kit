import { describe, it, expect } from "vitest";
import { mergeRegen, tagGenerated } from "../src/routes/kits.js";

// Regen preserves hand edits: pinned/edited items survive category regen,
// stale non-pinned items of that category are replaced, others untouched.
describe("mergeRegen (pinned survives regen)", () => {
  const existing: any = {
    questions: [
      { id: "q1", category: "technical", prompt: "orig", _meta: { origin: "generated" } },
      { id: "q2", category: "technical", prompt: "mine", answer_outline: "a", _meta: { origin: "edited" } },
      { id: "q3", category: "behavioural", prompt: "b", _meta: { origin: "generated" } },
    ],
  };
  const fresh: any = {
    questions: [
      { id: "qx", category: "technical", prompt: "fresh1", answer_outline: "a", difficulty: 2, requirement_ids: ["r1"] },
      { id: "qy", category: "technical", prompt: "fresh2", answer_outline: "a", difficulty: 1, requirement_ids: ["r1"] },
    ],
  };

  it("keeps edited + other-category, replaces stale same-category", () => {
    const merged = mergeRegen(existing, fresh, { type: "category", category: "technical" });
    const ids = merged.questions.map((q: any) => q.prompt);
    expect(ids).toContain("mine"); // edited survives
    expect(ids).toContain("b"); // other category untouched
    expect(ids).not.toContain("orig"); // stale generated replaced
    expect(ids).toContain("fresh1");
    // fresh ids re-based to avoid collisions
    const qids = merged.questions.map((q: any) => q.id);
    expect(new Set(qids).size).toBe(qids.length);
  });

  it("tagGenerated marks everything generated", () => {
    const tagged = tagGenerated({ questions: [{ id: "q1" }], flashcards: [{ id: "f1" }], company_brief: { summary: "s" } });
    expect(tagged.questions[0]._meta.origin).toBe("generated");
    expect(tagged.flashcards[0]._meta.origin).toBe("generated");
  });

  it("brief regen only touches the brief", () => {
    const merged = mergeRegen(existing, { company_brief: { summary: "new", what_they_do: "w", sources: [] } }, { type: "brief" });
    expect(merged.company_brief.summary).toBe("new");
    expect(merged.questions).toHaveLength(3);
  });

  it("hand-edited brief survives brief regen", () => {
    const withEditedBrief = {
      ...existing,
      company_brief: { summary: "mine", what_they_do: "keep", sources: [], _meta: { origin: "edited" } },
    };
    const merged = mergeRegen(
      withEditedBrief,
      { company_brief: { summary: "fresh", what_they_do: "replace", sources: [] } },
      { type: "brief" }
    );
    expect(merged.company_brief.summary).toBe("mine");
    expect(merged.company_brief._meta.origin).toBe("edited");
    expect(merged.questions).toHaveLength(3);
  });
});
