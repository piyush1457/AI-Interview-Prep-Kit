// Pure kit-state helpers: origin flags, reorder, practice ordering.
// Tested in __tests__/kitState.test.ts (vitest).

export type Origin = "generated" | "edited" | "pinned";

export function markEdited(item: any): any {
  return { ...item, _meta: { origin: "edited" as Origin } };
}

export function isPinned(item: any): boolean {
  return item?._meta?.origin === "edited" || item?._meta?.origin === "pinned";
}

/** Reorder questions array (dnd-kit gives active/over ids). */
export function reorderQuestions(list: any[], activeId: string, overId: string): any[] {
  const from = list.findIndex((q) => q.id === activeId);
  const to = list.findIndex((q) => q.id === overId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Move a question to another category (marks edited so regen preserves it). */
export function moveQuestionCategory(q: any, category: string): any {
  return markEdited({ ...q, category });
}

/** Least-confident-first queue: unpracticed (0) first, then 1..3. */
export function orderPractice(cards: any[], confidence: Record<string, number>): string[] {
  return [...cards]
    .sort((a, b) => (confidence[a.id] ?? 0) - (confidence[b.id] ?? 0))
    .map((c) => c.id);
}

/** Next fresh question id after existing qN ids. */
export function nextQuestionId(questions: any[]): string {
  let n = 0;
  for (const q of questions) {
    const m = /^q(\d+)$/.exec(q?.id || "");
    if (m) n = Math.max(n, Number(m[1]));
  }
  return `q${n + 1}`;
}
