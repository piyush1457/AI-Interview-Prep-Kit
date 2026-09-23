// Shared frontend types for the kit document (mirrors packages/kit-schema Appendix A,
// kept structural/loose where the API tolerates gaps).

export type Origin = "generated" | "edited" | "pinned";

export interface Meta {
  origin: Origin;
}

export interface KitSource {
  company?: string;
  company_url?: string;
  role?: string;
  location?: string;
  jd_chars?: number;
  researched_at?: string;
  pages_used?: string[];
}

export interface CompanyBrief {
  summary?: string;
  what_they_do?: string;
  sources?: string[];
  _meta?: Meta;
}

export type RequirementPriority = "must" | "nice";
export type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";

export interface Requirement {
  id: string;
  text?: string;
  kind?: string;
  priority?: RequirementPriority | string;
}

export interface Question {
  id: string;
  requirement_ids?: string[];
  category: QuestionCategory | string;
  prompt: string;
  answer_outline?: string;
  difficulty?: number;
  _meta?: Meta;
}

export interface Flashcard {
  id: string;
  front: string;
  back?: string;
  requirement_ids?: string[];
  _meta?: Meta;
}

export interface ScheduleDay {
  day: number;
  focus?: string;
  question_ids?: string[];
  minutes?: number;
}

export interface Schedule {
  days_available?: number;
  days?: ScheduleDay[];
}

export interface Coverage {
  uncovered_requirement_ids?: string[];
  passes?: number;
}

export interface RoleInfo {
  title?: string;
  seniority?: string;
  responsibilities?: string[];
  requirements?: Requirement[];
}

export interface KitDoc {
  source?: KitSource;
  company_brief?: CompanyBrief;
  role?: RoleInfo;
  questions?: Question[];
  flashcards?: Flashcard[];
  schedule?: Schedule;
  coverage?: Coverage;
}

export type KitStatus = "queued" | "running" | "done" | "failed" | string;

export interface KitStep {
  step?: string;
  at?: string;
}

export interface KitError {
  code?: string;
  message?: string;
}

/** API envelope returned for single-kit endpoints (and list rows). */
export interface KitEnvelope {
  id: string;
  status: KitStatus;
  version?: number;
  kit?: KitDoc | null;
  steps?: KitStep[];
  warnings?: string[];
  error?: KitError | null;
  created_at?: string;
  days?: number;
}

export interface PracticeRecord {
  confidence?: Record<string, number>;
}

export interface WeakSpotCard {
  id: string;
  front?: string;
}

export interface WeakSpotMust {
  id: string;
  text?: string;
}

export interface WeakSpotsReport {
  summary?: string;
  lowConfidenceCards?: WeakSpotCard[];
  uncoveredMusts?: WeakSpotMust[];
}

export interface SessionUser {
  userId: string;
}

export interface AuthUser {
  id: string;
  email?: string;
}

export interface CreateKitResult {
  kitId: string;
}

export interface BatchRowError {
  index: number;
  error?: unknown;
}

export interface BatchResult {
  kitIds?: string[];
  rowErrors?: BatchRowError[];
}

export type RegenScope =
  | { type: "brief" }
  | { type: "category"; category: string }
  | { type: "schedule" };

export type BriefSave =
  | { regen: "brief" }
  | { summary: string; what_they_do: string; _meta: Meta };
