import { describe, it, expect } from "vitest";
import { findUncovered, uncoveredRequirements } from "../src/services/coverage.js";
import { extractRequirements } from "../src/services/extraction.js";
import type { Question, Requirement } from "@ai-prep/kit-schema";

const reqs: Requirement[] = [
  { id: "r1", text: "React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentoring", kind: "behavioural", priority: "must" },
  { id: "r3", text: "Go bonus", kind: "technical", priority: "nice" },
];

describe("coverage check (code's decision, not model's)", () => {
  it("flags must-haves with no question", () => {
    const qs: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 },
    ];
    expect(findUncovered(reqs, qs)).toEqual(["r2"]);
    expect(uncoveredRequirements(reqs, qs).map((r) => r.id)).toEqual(["r2"]);
  });

  it("ignores nice-to-haves and unknown ids", () => {
    const qs: Question[] = [
      { id: "q1", requirement_ids: ["r1", "r99"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 },
      { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "p", answer_outline: "a", difficulty: 1 },
    ];
    expect(findUncovered(reqs, qs)).toEqual([]);
  });

  it("thin JD yields thin honest extraction (no invention)", async () => {
    const ext = await extractRequirements("Go dev\nHiring fast");
    expect(ext.requirements.length).toBeLessThanOrEqual(3);
    expect(ext.thin).toBe(true);
  });
});
