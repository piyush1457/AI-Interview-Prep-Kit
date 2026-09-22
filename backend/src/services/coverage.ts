import type { Question, Requirement } from "@ai-prep/kit-schema";

// Deterministic coverage check (code's decision, not the model's per brief Sec 3).
export function findUncovered(requirements: Requirement[], questions: Question[]): string[] {
  const covered = new Set<string>();
  const valid = new Set(requirements.map((r) => r.id));
  for (const q of questions) for (const id of q.requirement_ids) if (valid.has(id)) covered.add(id);
  return requirements.filter((r) => r.priority === "must" && !covered.has(r.id)).map((r) => r.id);
}

export function uncoveredRequirements(requirements: Requirement[], questions: Question[]): Requirement[] {
  const ids = new Set(findUncovered(requirements, questions));
  return requirements.filter((r) => ids.has(r.id));
}
