import type { Question, Requirement } from "@ai-prep/kit-schema";

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

// Deterministic arithmetic allocation (NEVER LLM per brief Sec 3/8):
// - exactly N days; every must-have appears somewhere; int minutes;
// - harder (difficulty 3) + must priority first, not the night before.
// `variant` (default 0) is only used on explicit Regenerate: keeps day 1's
// hard pack, rotates the remaining day buckets so the plan actually changes.
export function allocateSchedule(
  days: number,
  questions: Question[],
  reqs: Requirement[],
  variant = 0
): ScheduleDay[] {
  const n = Math.max(1, Math.min(60, Math.floor(days)));
  const qById = new Map(questions.map((q) => [q.id, q]));
  const mustIds = new Set(reqs.filter((r) => r.priority === "must").map((r) => r.id));
  const weight = (q: Question) => (q.requirement_ids.some((id) => mustIds.has(id)) ? 10 : 0) + q.difficulty * 3;
  const sorted = [...questions].sort((a, b) => weight(b) - weight(a));

  const buckets: Question[][] = Array.from({ length: n }, () => []);
  sorted.forEach((q, i) => buckets[i % n].push(q));

  // Regen variant: day 0 keeps the hard/must pack; days 1..n-1 rotate.
  if (variant > 0 && n > 1) {
    const head = buckets[0];
    const tail = buckets.slice(1);
    // variant 1 => shift by 1 (never a no-op unless tail.length === 1)
    const r = ((variant % tail.length) + tail.length) % tail.length;
    buckets.length = 0;
    buckets.push(head, ...tail.slice(r), ...tail.slice(0, r));
  }

  // guarantee: every must appears (if a must has zero questions, coverage flags it; schedule still exact)
  const covered = new Set<string>();
  for (const b of buckets) for (const q of b) for (const id of q.requirement_ids) covered.add(id);
  // (coverage.ts owns the gap signal; schedule never invents ids)

  const totalMin = Math.min(90 * n, Math.max(45 * n, questions.length * 20));
  const perDayBase = Math.floor(totalMin / n);
  return buckets.map((b, i) => {
    const hard = b.some((q) => q.difficulty === 3);
    const mustCount = b.filter((q) => q.requirement_ids.some((id) => mustIds.has(id))).length;
    const focus =
      i === 0 ? `Core must-haves${hard ? " + hard questions" : ""}` :
      i === n - 1 && n > 1 ? "Review + company fit" :
      mustCount > 0 ? "Must-have depth" : "Breadth + practice";
    const minutes = Math.max(20, perDayBase + (i === 0 ? 10 : 0) - (i === n - 1 && n > 2 ? 5 : 0));
    return {
      day: i + 1,
      focus,
      question_ids: b.map((q) => q.id).filter((id) => qById.has(id)),
      minutes: Math.floor(minutes),
    };
  });
}
