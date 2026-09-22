import { describe, it, expect } from "vitest";
import { allocateSchedule } from "../src/services/scheduling.js";
import type { Question, Requirement } from "@ai-prep/kit-schema";

const reqs: Requirement[] = [
  { id: "r1", text: "5 years React", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentor juniors", kind: "behavioural", priority: "must" },
  { id: "r3", text: "Go bonus", kind: "technical", priority: "nice" },
];
const qs: Question[] = [
  { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p1", answer_outline: "a1", difficulty: 3 },
  { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "p2", answer_outline: "a2", difficulty: 2 },
  { id: "q3", requirement_ids: ["r3"], category: "technical", prompt: "p3", answer_outline: "a3", difficulty: 1 },
];

describe("allocateSchedule (deterministic, never LLM)", () => {
  it("spans exactly the days requested", () => {
    expect(allocateSchedule(5, qs, reqs)).toHaveLength(5);
    expect(allocateSchedule(1, qs, reqs)).toHaveLength(1);
    expect(allocateSchedule(60, qs, reqs)).toHaveLength(60);
  });

  it("places every must-have requirement somewhere", () => {
    const days = allocateSchedule(4, qs, reqs);
    const placed = new Set(days.flatMap((d) => d.question_ids));
    const mustQs = qs.filter((q) => q.requirement_ids.some((id) => id === "r1" || id === "r2"));
    expect(mustQs.every((q) => placed.has(q.id))).toBe(true);
  });

  it("uses integer minutes and valid question refs", () => {
    const days = allocateSchedule(3, qs, reqs);
    const ids = new Set(qs.map((q) => q.id));
    for (const d of days) {
      expect(Number.isInteger(d.minutes)).toBe(true);
      expect(d.minutes).toBeGreaterThan(0);
      for (const qid of d.question_ids) expect(ids.has(qid)).toBe(true);
    }
  });

  it("puts harder/higher-priority material on day 1, not the night before", () => {
    const days = allocateSchedule(3, qs, reqs);
    expect(days[0].question_ids).toContain("q1"); // diff 3 + must
  });

  it("1-day packs everything; 60-day stays exact", () => {
    const one = allocateSchedule(1, qs, reqs);
    expect(one[0].question_ids).toEqual(expect.arrayContaining(["q1", "q2", "q3"]));
    expect(allocateSchedule(60, qs, reqs)[59].day).toBe(60);
  });
});
