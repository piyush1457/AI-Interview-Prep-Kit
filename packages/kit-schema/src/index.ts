import { z } from "zod";
import { createHash } from "crypto";
import { ErrorCode } from "./errors.js";
export { ErrorCode } from "./errors.js";
export type { ErrorCode as ErrorCodeType } from "./errors.js";

// Appendix A enums - exact strings required by automated checker
export const RequirementKind = z.enum(["technical", "behavioural", "domain"]);
export const RequirementPriority = z.enum(["must", "nice"]);
export const QuestionCategory = z.enum(["technical", "behavioural", "system-design", "company-fit"]);

export const RequirementSchema = z.object({
  id: z.string().regex(/^r\d+$/),
  text: z.string().min(1),
  kind: RequirementKind,
  priority: RequirementPriority,
});

export const QuestionSchema = z.object({
  id: z.string().regex(/^q\d+$/),
  requirement_ids: z.array(z.string().regex(/^r\d+$/)).min(1),
  category: QuestionCategory,
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.number().int().min(1).max(3),
});

export const FlashcardSchema = z.object({
  id: z.string().regex(/^f\d+$/),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().regex(/^r\d+$/)).min(1),
});

export const ScheduleDaySchema = z.object({
  day: z.number().int().min(1),
  focus: z.string().min(1),
  question_ids: z.array(z.string()),
  minutes: z.number().int().min(1),
});

export const ScheduleSchema = z.object({
  days_available: z.number().int().min(1).max(60),
  days: z.array(ScheduleDaySchema).min(1),
});

export const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().min(0),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().min(1),
});

export const KitSchema = z.object({
  source: SourceSchema,
  company_brief: CompanyBriefSchema,
  role: RoleSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
});

export type Kit = z.infer<typeof KitSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type Flashcard = z.infer<typeof FlashcardSchema>;

// Appendix B batch shapes
export const BatchCaseSchema = z.object({
  id: z.string().min(1),
  jd: z.string(),
  company_url: z.string().min(1),
  days: z.number().int().min(1).max(60),
});

export const BatchErrorSchema = z.object({
  code: z.nativeEnum(ErrorCode),
  message: z.string(),
});

export const BatchKitEntrySchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "failed"]),
  kit: KitSchema.nullable(),
  error: BatchErrorSchema.nullable(),
});

export const BatchOutputSchema = z.object({
  version: z.literal("1.0"),
  generated_at: z.string(),
  kits: z.array(BatchKitEntrySchema),
});

export type BatchOutput = z.infer<typeof BatchOutputSchema>;
export type BatchKitEntry = z.infer<typeof BatchKitEntrySchema>;

// Helpers
export function validateKit(kit: unknown) {
  return KitSchema.safeParse(kit);
}

export function validateBatchOutput(out: unknown) {
  return BatchOutputSchema.safeParse(out);
}

export function dedupeHash(userId: string, jd: string, companyUrl: string, days: number): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const payload = `${userId}|${norm(jd)}|${norm(companyUrl)}|${days}`;
  return createHash("sha256").update(payload).digest("hex");
}

/** Strip internal _meta fields before writing Appendix B kits.json */
export function stripMeta<T>(kit: T): T {
  // deep clone excluding keys named _meta
  return JSON.parse(
    JSON.stringify(kit, (k, v) => (k === "_meta" ? undefined : v))
  ) as T;
}

export function assertValidKitOrThrow(kit: unknown): Kit {
  const res = validateKit(kit);
  if (!res.success) throw new Error(`Kit validation failed: ${res.error.message}`);
  return res.data;
}
