import { BatchCaseSchema, KitSchema, validateKit, type Kit, type Question } from "@ai-prep/kit-schema";
import { crawlCompany } from "./crawl.js";
import { searchInterviewDiscussion } from "./search.js";
import { extractRequirements } from "./extraction.js";
import { generateBrief, generateCategory, generateGapFill, buildFlashcards, type Category } from "./generation.js";
import { allocateSchedule } from "./scheduling.js";
import { findUncovered, uncoveredRequirements } from "./coverage.js";

export const PIPELINE_BUDGET_MS = 150_000; // 2.5min per case + queueWaitMs (v2 fix A)
export const CRAWL_BUDGET_MS = 60_000;

export interface PipelineInput {
  jd: string;
  company_url: string;
  days: number;
  bypassDedupe?: boolean; // CLI always true; app false
  jobId?: string;
}

export interface PipelineEvents {
  onStep?: (step: string, status: string) => void;
  queueWaitAccum?: { ms: number };
}

function companyNameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").split(".")[0] || "Company";
  } catch {
    return "Company";
  }
}

export interface PipelineContext {
  hiring: string;
  discText: string;
  crawlText: string;
}

export async function runPipeline(input: PipelineInput, ev: PipelineEvents = {}): Promise<{ kit: Kit; warnings: string[]; context: PipelineContext }> {
  const parsed = BatchCaseSchema.extend({
    jd: BatchCaseSchema.shape.jd.trim().min(1, "job description is required"),
  }).safeParse({ id: "x", ...input });
  if (!parsed.success) {
    throw Object.assign(new Error(parsed.error.issues[0]?.message || "invalid pipeline input"), {
      code: "VALIDATION",
      status: 400,
    });
  }
  const started = Date.now();
  // v2 fix A: accumulate shared-queue contention here; deadline excludes it.
  const acc: { ms: number } = ev.queueWaitAccum ?? { ms: 0 };
  if (ev.queueWaitAccum && ev.queueWaitAccum !== acc) acc.ms = ev.queueWaitAccum.ms;
  const step = (s: string, st = "running") => ev.onStep?.(s, st);
  const deadline = () => started + PIPELINE_BUDGET_MS + acc.ms;
  const timedOut = () => Date.now() > deadline();
  const warnings: string[] = [];

  const days = Math.max(1, Math.min(60, Math.floor(input.days)));
  const jd = String(input.jd || "");
  const companyUrl = String(input.company_url || "");
  const company = companyNameFromUrl(companyUrl);

  // S1 extract (pasted JD needs no retrieval)
  step("extracting");
  const ext = await extractRequirements(jd, acc).catch((e) => {
    throw e;
  });
  if (ext.thin) warnings.push("JD_TOO_THIN: description has almost nothing; kit is intentionally thin.");
  if (timedOut()) warnings.push("PIPELINE_TIMEOUT after extraction.");

  // S2 crawl + discussion (parallel-ish, budgeted)
  step("crawling");
  const [crawl, discussion] = await Promise.all([
    crawlCompany(companyUrl, { maxPages: 5, crawlBudgetMs: CRAWL_BUDGET_MS }).catch((e: any) => ({
      pages: [], pages_used: [], notes: [] as string[], errors: [{ url: companyUrl, message: e?.message || "crawl failed" }],
    })),
    searchInterviewDiscussion(company, companyUrl).catch(() => ({ hits: [], note: "NO_DISCUSSION" })),
  ]);
  const crawlText = crawl.pages.map((p) => p.text).join("\n\n").slice(0, 9000);
  for (const n of crawl.notes) warnings.push(n);
  for (const e of crawl.errors) warnings.push(`${e.url}: ${e.message}`.slice(0, 200));
  if (discussion.note) warnings.push(discussion.note);
  const hiring = crawl.pages.map((p) => p.text).join("\n").slice(0, 3000);
  const discText = discussion.hits.map((h) => `${h.title}: ${h.snippet}`).join("\n");

  // S3 brief
  step("brief");
  const brief = await generateBrief(crawlText, company, acc).catch(() => ({
    summary: "Brief unavailable; sources listed honestly.",
    what_they_do: "Unknown from available sources.",
  }));

  // S4 per-category questions (4 separate calls)
  step("generating");
  const cats: Category[] = ["technical", "behavioural", "system-design", "company-fit"];
  let questions: Question[] = [];
  for (const c of cats) {
    if (timedOut()) {
      warnings.push(`PIPELINE_TIMEOUT before ${c}; shipping partial.`);
      break;
    }
    try {
      const qs = await generateCategory(c, ext.requirements, hiring, discText, questions.length, acc);
      questions = questions.concat(qs);
    } catch (e: any) {
      warnings.push(`${c} generation failed: ${e?.message || "error"}`.slice(0, 200));
    }
  }

  // S5 coverage + gap-fill (max 2 passes)
  step("coverage");
  let passes = 1;
  let uncovered = findUncovered(ext.requirements, questions);
  if (uncovered.length > 0 && !timedOut()) {
    passes = 2;
    try {
      const missing = uncoveredRequirements(ext.requirements, questions);
      const filled = await generateGapFill(missing, ext.requirements, hiring, questions.length, acc);
      questions = questions.concat(filled);
    } catch (e: any) {
      warnings.push(`gap-fill failed: ${e?.message || "error"}`.slice(0, 200));
    }
    uncovered = findUncovered(ext.requirements, questions);
  }

  // S6 flashcards + CODE schedule
  step("scheduling");
  const flashcards = buildFlashcards(questions, ext.requirements);
  const scheduleDays = allocateSchedule(days, questions, ext.requirements);

  const kit: any = {
    source: {
      company,
      company_url: companyUrl,
      role: ext.title,
      location: "",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl.pages_used,
    },
    company_brief: { summary: brief.summary, what_they_do: brief.what_they_do, sources: crawl.pages_used },
    role: {
      title: ext.title,
      seniority: ext.seniority,
      responsibilities: ext.responsibilities,
      requirements: ext.requirements,
    },
    questions,
    flashcards,
    schedule: { days_available: days, days: scheduleDays },
    coverage: { uncovered_requirement_ids: uncovered, passes },
  };

  const v = validateKit(kit);
  if (!v.success) throw Object.assign(new Error(`Kit schema invalid: ${v.error.message}`), { code: "SCHEMA_INVALID" });
  step("done", "done");
  return { kit: v.data, warnings, context: { hiring, discText, crawlText } };
}
