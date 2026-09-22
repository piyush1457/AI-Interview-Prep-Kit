import { Router } from "express";
import { z } from "zod";
import { dedupeHash } from "@ai-prep/kit-schema";
import { requireAuth } from "../middleware/owner.js";
import { Kit } from "../models/Kit.js";
import { Job } from "../models/Job.js";
import { runPipeline } from "../services/runPipeline.js";

const r = Router();
r.use(requireAuth);

const item = z.object({ jd: z.string().min(1), company_url: z.string().min(1), days: z.number().int().min(1).max(60) });

// POST /api/kits/batch — in-app multi-role upload (JSON array or {items}); 1MB/20-row caps enforced by express.json + length check
r.post("/batch", async (req: any, res) => {
  const raw = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(raw) || raw.length === 0) return res.status(400).json({ code: "VALIDATION", message: "items[] required" });
  if (raw.length > 20) return res.status(400).json({ code: "VALIDATION", message: "max 20 rows per batch" });
  const kitIds: string[] = [];
  const rowErrors: { index: number; message: string }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = item.safeParse(raw[i]);
    if (!p.success) { rowErrors.push({ index: i, message: p.error.message }); continue; }
    const hash = dedupeHash(String(req.userId), p.data.jd, p.data.company_url, p.data.days);
    const existing = await Kit.findOne({ owner: req.userId, dedupeHash: hash });
    if (existing) { kitIds.push(String(existing._id)); continue; }
    const kit = await Kit.create({ owner: req.userId, dedupeHash: hash, version: 1, status: "queued", ...p.data });
    const job = await Job.create({ kitId: kit._id, step: "queued", status: "queued" });
    kitIds.push(String(kit._id));
    runPipeline({ ...p.data }).then(async ({ kit: out }) => {
      await Kit.findByIdAndUpdate(kit._id, { $set: { kit: out, status: "done" }, $inc: { version: 1 } });
      await Job.findByIdAndUpdate(job._id, { $set: { step: "done", status: "done" } });
    }).catch(async (e: any) => {
      await Kit.findByIdAndUpdate(kit._id, { $set: { status: "failed", error: { code: e?.code || "SCHEMA_INVALID", message: e?.message } } });
      await Job.findByIdAndUpdate(job._id, { $set: { step: "failed", status: "failed" } });
    });
  }
  res.status(202).json({ kitIds, rowErrors });
});

export default r;
