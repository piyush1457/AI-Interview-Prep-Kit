import { Router } from "express";
import { z } from "zod";
import { dedupeHash, validateKit } from "@ai-prep/kit-schema";
import { requireAuth } from "../middleware/owner.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { Kit } from "../models/Kit.js";
import { Job } from "../models/Job.js";
import { runPipeline } from "../services/runPipeline.js";

// Only these origins are legal in _meta; client PATCHes cannot invent others.
const META_ORIGINS = new Set(["generated", "edited", "pinned"]);

/** Sanitize client-supplied _meta on PATCH (Zod strips it during validate; we persist intentionally). */
export function sanitizePatchMeta(patch: any): any {
  const kit = JSON.parse(JSON.stringify(patch));
  const fix = (item: any) => {
    if (!item || typeof item !== "object") return;
    const origin = item._meta?.origin;
    if (origin && META_ORIGINS.has(origin)) return;
    // Missing/invalid origin on a user mutation counts as a hand edit (pinned through regen).
    item._meta = { origin: "edited" };
  };
  for (const q of kit.questions || []) fix(q);
  for (const f of kit.flashcards || []) fix(f);
  if (kit.company_brief && typeof kit.company_brief === "object") fix(kit.company_brief);
  return kit;
}

/** Parse a version header value: returns a positive integer or null if missing/invalid. */
export function parseIfMatch(header: unknown): number | null {
  if (header == null || header === "") return null;
  const raw = Array.isArray(header) ? header[0] : header;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Kit concurrency version from X-Kits-Version (preferred) or legacy If-Match.
 * If-Match is only a fallback: Vercel's edge enforces RFC 7232 on it and
 * returns a plain-text 412 that can never match our integer version.
 */
export function parseVersionHeader(headers: Record<string, unknown>): number | null {
  return parseIfMatch(headers["x-kits-version"] || headers["if-match"]);
}

// Tag every generated item so later regens can preserve hand edits.
export function tagGenerated(out: any): any {
  const kit = JSON.parse(JSON.stringify(out));
  for (const q of kit.questions || []) q._meta = { origin: "generated" };
  for (const f of kit.flashcards || []) f._meta = { origin: "generated" };
  kit.company_brief = { ...(kit.company_brief || {}), _meta: { origin: "generated" } };
  return kit;
}

// Merge fresh regen output into existing kit, preserving pinned/edited items.
export function mergeRegen(existing: any, fresh: any, scope: { type: "brief" } | { type: "category"; category: string } | { type: "schedule" }): any {
  const kit = JSON.parse(JSON.stringify(existing));
  const isPinned = (x: any) => x?._meta?.origin === "edited" || x?._meta?.origin === "pinned";
  if (scope.type === "brief" && fresh.company_brief) {
    // Hand-edited brief survives brief-scope regen (matches "survives regen" badge).
    if (!isPinned(kit.company_brief)) {
      kit.company_brief = { ...fresh.company_brief, _meta: { origin: "generated" } };
    }
  } else if (scope.type === "category") {
    const cat = (scope as { type: "category"; category: string }).category;
    // keep: pinned items (any category) + non-pinned items of OTHER categories.
    // drop: non-pinned items of this category (they are replaced by fresh).
    const kept = (kit.questions || []).filter((q: any) => isPinned(q) || q.category !== cat);
    let n = 0;
    for (const q of kit.questions || []) { const m = /^q(\d+)$/.exec(q.id || ""); if (m) n = Math.max(n, Number(m[1])); }
    const freshQs = (fresh.questions || [])
      .filter((q: any) => q.category === cat)
      .map((q: any) => ({ ...q, id: `q${++n}`, _meta: { origin: "generated" } }));
    kit.questions = kept.concat(freshQs);
  } else if (scope.type === "schedule" && fresh.schedule) {
    kit.schedule = fresh.schedule;
  }
  return kit;
}

const r = Router();
r.use(requireAuth);

const createSchema = z.object({
  jd: z.string().trim().min(1),
  company_url: z.string().trim().min(1),
  days: z.number().int().min(1).max(60),
});

// POST /api/kits -> dedupe -> job -> run async
r.post("/", asyncHandler(async (req: any, res) => {
  const p = createSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: "VALIDATION", message: p.error.message });
  const userId = String(req.userId);
  const hash = dedupeHash(userId, p.data.jd, p.data.company_url, p.data.days);
  const existing = await Kit.findOne({ owner: req.userId, dedupeHash: hash });
  if (existing) return res.json({ kitId: String(existing._id), deduped: true });

  const kit = await Kit.create({
    owner: req.userId, dedupeHash: hash, version: 1, status: "queued",
    jd: p.data.jd, company_url: p.data.company_url, days: p.data.days,
  });
  const job = await Job.create({ kitId: kit._id, step: "queued", status: "queued" });
  // fire-and-forget worker (in-process); onStep pushes live step + status=running for SSE/poll UI
  runPipeline(
    { ...p.data },
    {
      onStep: async (step: string, st: string) => {
        try {
          if (st !== "done") {
            await Kit.findByIdAndUpdate(kit._id, {
              $set: { status: "running" },
              $push: { steps: { step, at: new Date() } },
            });
            await Job.findByIdAndUpdate(job._id, { $set: { step, status: "running" } });
          }
        } catch {
          /* progress updates are best-effort */
        }
      },
    }
  ).then(async ({ kit: out, context, warnings }) => {
    const tagged: any = tagGenerated(out);
    await Kit.findByIdAndUpdate(kit._id, {
      $set: { kit: tagged, context, warnings: warnings || [], status: "done" },
      $push: { steps: { step: "done", at: new Date() } },
      $inc: { version: 1 },
    });
    await Job.findByIdAndUpdate(job._id, { $set: { step: "done", status: "done" } });
  }).catch(async (e: any) => {
    await Kit.findByIdAndUpdate(kit._id, { $set: { status: "failed", error: { code: e?.code || "SCHEMA_INVALID", message: e?.message || "failed" } } });
    await Job.findByIdAndUpdate(job._id, { $set: { step: "failed", status: "failed", error: { code: e?.code || "SCHEMA_INVALID", message: e?.message || "failed" } } });
  });
  res.status(202).json({ kitId: String(kit._id), jobId: String(job._id) });
}));

r.get("/", asyncHandler(async (req: any, res) => {
  const kits = await Kit.find({ owner: req.userId }).sort({ updatedAt: -1 }).limit(50);
  res.json(
    kits.map((k) => ({
      id: String(k._id),
      status: k.status,
      updatedAt: (k as any).updatedAt,
      created_at: (k as any).createdAt,
      days: k.days,
      version: (k as any).version,
      // slim projection for list rows - full kit still loads on GET /:id
      kit: k.kit
        ? {
            role: k.kit.role,
            source: k.kit.source ? { company: k.kit.source.company } : undefined,
            schedule: k.kit.schedule ? { days_available: k.kit.schedule.days_available } : undefined,
          }
        : null,
    }))
  );
}));

r.get("/:id", asyncHandler(async (req: any, res) => {
  const k = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  res.json(k);
}));

// SSE progress stream
r.get("/:id/stream", asyncHandler(async (req: any, res) => {
  const k = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ status: k.status, steps: k.steps });
  const timer = setInterval(async () => {
    const cur = await Kit.findById(k._id);
    if (!cur) { clearInterval(timer); res.end(); return; }
    send({ status: cur.status, steps: cur.steps });
    if (cur.status === "done" || cur.status === "failed") { clearInterval(timer); res.end(); }
  }, 2000);
  req.on("close", () => clearInterval(timer));
}));

// PATCH: requires X-Kits-Version; atomic version CAS so two tabs cannot clobber.
r.patch("/:id", asyncHandler(async (req: any, res) => {
  const match = parseVersionHeader(req.headers);
  if (match == null) {
    return res.status(428).json({ code: "VALIDATION", message: "X-Kits-Version header required" });
  }
  const patch = req.body?.kit;
  if (!patch) return res.status(400).json({ code: "VALIDATION", message: "kit patch required" });
  // Validate Appendix A structure before save; keep client _meta (zod would strip it from parsed output).
  const v = validateKit(patch);
  if (!v.success)
    return res.status(400).json({ code: "VALIDATION", message: v.error.message.slice(0, 300) });
  const sanitized = sanitizePatchMeta(patch);
  // Atomic compare-and-set: only write when stored version still equals X-Kits-Version.
  const updated = await Kit.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId, version: match },
    { $set: { kit: sanitized }, $inc: { version: 1 } },
    { new: true }
  );
  if (!updated) {
    const fresh = await Kit.findOne({ _id: req.params.id, owner: req.userId });
    if (!fresh) return res.status(404).json({ code: "VALIDATION", message: "not found" });
    return res.status(409).json({ code: "VALIDATION", message: "stale version; refetch and re-apply", kit: fresh });
  }
  res.json(updated);
}));

export default r;
