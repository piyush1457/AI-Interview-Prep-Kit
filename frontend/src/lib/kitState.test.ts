import { describe, it, expect } from "vitest";
import { markEdited, isPinned, reorderQuestions, moveQuestionCategory, orderPractice, nextQuestionId } from "./kitState";

describe("kitState (builder + practice ordering)", () => {
  it("hand edits are flagged so regen preserves them", () => {
    const q = { id: "q1", prompt: "p" };
    expect(isPinned(q)).toBe(false);
    const edited = markEdited(q);
    expect(isPinned(edited)).toBe(true);
    expect(edited._meta.origin).toBe("edited");
  });

  it("reorders by active/over ids", () => {
    const list = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];
    expect(reorderQuestions(list, "q1", "q3").map((q) => q.id)).toEqual(["q2", "q3", "q1"]);
    expect(reorderQuestions(list, "q9", "q1")).toEqual(list);
  });

  it("moving category marks edited (pinned through regen)", () => {
    const moved = moveQuestionCategory({ id: "q1", category: "technical" }, "behavioural");
    expect(moved.category).toBe("behavioural");
    expect(isPinned(moved)).toBe(true);
  });

  it("practice queue is least-confident-first", () => {
    const cards = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];
    expect(orderPractice(cards, { f1: 3, f2: 1 })).toEqual(["f3", "f2", "f1"]);
  });

  it("nextQuestionId avoids collisions", () => {
    expect(nextQuestionId([{ id: "q1" }, { id: "q7" }])).toBe("q8");
    expect(nextQuestionId([])).toBe("q1");
  });
});
