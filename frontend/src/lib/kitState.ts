// Pure kit-state helpers: origin flags, reorder, practice ordering.
// Tested in kitState.test.ts (vitest).

import type { Meta, Origin, Question } from "./types";

export type { Origin, Meta };

export function markEdited<T extends object>(item: T): T & { _meta: Meta } {
  return { ...item, _meta: { origin: "edited" as Origin } };
}

export function isPinned(item: unknown): boolean {
  const origin = (item as { _meta?: { origin?: string } } | null)?._meta?.origin;
  return origin === "edited" || origin === "pinned";
}

/** Reorder questions array (dnd-kit gives active/over ids). */
export function reorderQuestions<T extends { id: string }>(
  list: T[],
  activeId: string,
  overId: string
): T[] {
  const from = list.findIndex((q) => q.id === activeId);
  const to = list.findIndex((q) => q.id === overId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Move a question to another category (marks edited so regen preserves it). */
export function moveQuestionCategory<T extends { id: string }>(q: T, category: string): T {
  return { ...markEdited(q), category } as T;
}

/** Least-confident-first queue: unpracticed (0) first, then 1..3. */
export function orderPractice<T extends { id: string }>(
  cards: T[],
  confidence: Record<string, number>
): string[] {
  return [...cards]
    .sort((a, b) => (confidence[a.id] ?? 0) - (confidence[b.id] ?? 0))
    .map((c) => c.id);
}

/** Next fresh question id after existing qN ids. */
export function nextQuestionId(questions: Array<Pick<Question, "id">>): string {
  let n = 0;
  for (const q of questions) {
    const m = /^q(\d+)$/.exec(q?.id || "");
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `q${n + 1}`;
}
