import { Router } from "express";
import { z } from "zod";
import { dedupeHash } from "@ai-prep/kit-schema";
import { requireAuth } from "../middleware/owner.js";
import { Kit } from "../models/Kit.js";
import { Job } from "../models/Job.js";
import { runPipeline } from "../services/runPipeline.js";

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
    kit.company_brief = { ...fresh.company_brief, _meta: { origin: "generated" } };
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
  jd: z.string().min(1),
  company_url: z.string().min(1),
  days: z.number().int().min(1).max(60),
});

// POST /api/kits -> dedupe -> job -> run async
r.post("/", async (req: any, res) => {
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
  // fire-and-forget worker (in-process)
  runPipeline({ ...p.data }).then(async ({ kit: out, context }) => {
    const tagged: any = tagGenerated(out);
    await Kit.findByIdAndUpdate(kit._id, { $set: { kit: tagged, context, status: "done" }, $push: { steps: { step: "done", at: new Date() } }, $inc: { version: 1 } });
    await Job.findByIdAndUpdate(job._id, { $set: { step: "done", status: "done" } });
  }).catch(async (e: any) => {
    await Kit.findByIdAndUpdate(kit._id, { $set: { status: "failed", error: { code: e?.code || "SCHEMA_INVALID", message: e?.message || "failed" } } });
    await Job.findByIdAndUpdate(job._id, { $set: { step: "failed", status: "failed", error: { code: e?.code || "SCHEMA_INVALID", message: e?.message || "failed" } } });
  });
  res.status(202).json({ kitId: String(kit._id), jobId: String(job._id) });
});

r.get("/", async (req: any, res) => {
  const kits = await Kit.find({ owner: req.userId }).sort({ updatedAt: -1 }).limit(50);
  res.json(kits.map((k) => ({ id: String(k._id), status: k.status, updatedAt: (k as any).updatedAt })));
});

r.get("/:id", async (req: any, res) => {
  const k = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  res.json(k);
});

// SSE progress stream
r.get("/:id/stream", async (req: any, res) => {
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
});

// PATCH with If-Match version (409 on stale)
r.patch("/:id", async (req: any, res) => {
  const match = Number(req.headers["if-match"]);
  const k = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  if (match && match !== (k as any).version) {
    return res.status(409).json({ code: "VALIDATION", message: "stale version; refetch and re-apply", kit: k });
  }
  const patch = req.body?.kit;
  if (!patch) return res.status(400).json({ code: "VALIDATION", message: "kit patch required" });
  (k as any).kit = patch;
  (k as any).version += 1;
  await k.save();
  res.json(k);
});

export default r;
