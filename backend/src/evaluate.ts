// Batch entry point (Sec 9, exact): npm run evaluate -- --input <cases.json> --output <kits.json>
// Reuses runPipeline (same code as app), bypassDedupe always, p-limit(3),
// per-case 2.5min+queueWaitMs, 13min outer wall-clock -> BATCH_TIMEOUT, _meta strip + re-validate.
import "dotenv/config";
import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { BatchCaseSchema, BatchOutputSchema, stripMeta, validateKit, ErrorCode } from "@ai-prep/kit-schema";
import { runPipeline, PIPELINE_BUDGET_MS } from "./services/runPipeline.js";

export const BATCH_WALL_MS = 13 * 60 * 1000;
export const CASE_CONCURRENCY = 3;

function parseArgs() {
  const args = process.argv.slice(2);
  let input = "", output = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input") input = args[++i];
    else if (args[i] === "--output") output = args[++i];
    else if (!input && !args[i].startsWith("-")) input = args[i];
    else if (!output && !args[i].startsWith("-")) output = args[i];
  }
  if (!input || !output) {
    const positional = args.filter((a) => !a.startsWith("-"));
    if (positional.length >= 2) { input = input || positional[0]; output = output || positional[1]; }
  }
  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }
  return { input, output };
}

function loadCases() {
  const { input, output } = parseArgs();
  const resolvedInput = path.resolve(input);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`[evaluate] input not found: ${input} (cwd ${process.cwd()}, resolved ${resolvedInput})`);
    process.exit(1);
  }
  let rawCases: any;
  try {
    rawCases = JSON.parse(fs.readFileSync(resolvedInput, "utf8"));
  } catch (e: any) {
    console.error(`[evaluate] input is not valid JSON: ${e?.message || e}`);
    process.exit(1);
  }
  if (!Array.isArray(rawCases)) { console.error("[evaluate] input must be an array"); process.exit(1); }
  return { rawCases, output };
}

const limit = pLimit(CASE_CONCURRENCY);

export async function runCase(c: any, pipeline = runPipeline) {
  const p = BatchCaseSchema.safeParse(c);
  if (!p.success) return { id: String(c?.id || "unknown"), status: "failed" as const, kit: null, error: { code: ErrorCode.VALIDATION, message: p.error.message.slice(0, 300) } };
  const { id, jd, company_url, days } = p.data;
  let queueWaitMs = 0;
  const perCase = (async () => {
    try {
      // v2 fix A: per-case accumulator excludes shared-queue contention from the deadline
      const acc: { ms: number } = { ms: 0 };
      const perCaseWithWait = (async () => {
        const r = await pipeline({ jd, company_url, days, bypassDedupe: true }, { queueWaitAccum: acc });
        queueWaitMs = acc.ms;
        return r;
      })();
      const { kit } = await perCaseWithWait;
      void PIPELINE_BUDGET_MS;
      const cleaned = stripMeta(kit);
      const v = validateKit(cleaned);
      if (!v.success) return { id, status: "failed" as const, kit: null, error: { code: ErrorCode.SCHEMA_INVALID, message: v.error.message.slice(0, 300) } };
      return { id, status: "ok" as const, kit: v.data, error: null };
    } catch (e: any) {
      const code = Object.values(ErrorCode).includes(e?.code) ? e.code : ErrorCode.SCHEMA_INVALID;
      return { id, status: "failed" as const, kit: null, error: { code, message: String(e?.message || "failed").slice(0, 300) } };
    }
  })();
  const timeout = new Promise((_, rej) => {
    const t = setTimeout(() => rej(Object.assign(new Error("per-case timeout"), { code: ErrorCode.PIPELINE_TIMEOUT })), PIPELINE_BUDGET_MS + 120_000);
    (t as any)?.unref?.();
  });
  try {
    return await Promise.race([perCase, timeout]) as any;
  } catch (e: any) {
    return { id, status: "failed" as const, kit: null, error: { code: ErrorCode.PIPELINE_TIMEOUT, message: "per-case budget exceeded" } };
  }
}

/**
 * Outer wall-clock race: resolves batch results as they complete, or merges
 * already-finished entries with BATCH_TIMEOUT for still-pending ids on expiry.
 * Completed cases are never discarded (getCompleted is read at timeout).
 */
export async function withWallClock<T extends { id: string }>(
  batchPromise: Promise<T[]>,
  ids: string[],
  wallMs = BATCH_WALL_MS,
  getCompleted?: () => T[]
): Promise<T[]> {
  let wallTimer: any;
  const wall = new Promise<T[]>((resolve) => {
    wallTimer = setTimeout(() => {
      const done = getCompleted?.() ?? [];
      const byId = new Map(done.map((x) => [x.id, x]));
      const merged = ids.map(
        (id) =>
          byId.get(id) ??
          ({
            id,
            status: "failed",
            kit: null,
            error: { code: ErrorCode.BATCH_TIMEOUT, message: "outer wall-clock exceeded" },
          } as unknown as T)
      );
      resolve(merged);
    }, wallMs);
    wallTimer?.unref?.();
  });
  try {
    return await Promise.race([batchPromise, wall]);
  } finally {
    clearTimeout(wallTimer);
  }
}

async function main() {
  const { rawCases, output } = loadCases();
  // Track finished entries so wall-clock expiry can flush them (not discard).
  const finished = new Map<string, any>();
  const batchPromise = Promise.all(
    rawCases.map((c) =>
      limit(() =>
        runCase(c).then((entry) => {
          finished.set(String(entry.id), entry);
          return entry;
        })
      )
    )
  );
  const kits = await withWallClock(
    batchPromise,
    rawCases.map((c: any) => String(c?.id || "unknown")),
    BATCH_WALL_MS,
    () => [...finished.values()]
  );
  const out: any = { version: "1.0", generated_at: new Date().toISOString(), kits };
  const v = BatchOutputSchema.safeParse(out);
  if (!v.success) { console.error("[evaluate] output schema invalid", v.error.message); process.exit(1); }
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(v.data, null, 2));
  console.log(`[evaluate] wrote ${kits.length} entries to ${output}`);
  process.exit(0);
}

// Top-level arg parsing has side effects (process.exit); only run main as CLI entry.
const isEntry = process.argv[1] ? import.meta.url.endsWith(path.basename(process.argv[1])) : false;
if (isEntry) await main();
