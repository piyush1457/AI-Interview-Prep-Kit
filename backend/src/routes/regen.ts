import { Router } from "express";
import { z } from "zod";
import { validateKit } from "@ai-prep/kit-schema";
import { requireAuth } from "../middleware/owner.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { Kit } from "../models/Kit.js";
import { generateBrief, generateCategory, type Category } from "../services/generation.js";
import { allocateSchedule } from "../services/scheduling.js";
import { findUncovered } from "../services/coverage.js";
import { mergeRegen, parseIfMatch } from "./kits.js";

const r = Router();
r.use(requireAuth);

const scopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("brief") }),
  z.object({ type: z.literal("category"), category: z.enum(["technical", "behavioural", "system-design", "company-fit"]) }),
  z.object({ type: z.literal("schedule") }),
]);

// POST /api/kits/:id/regenerate {scope, If-Match: version}
// Regenerates ONE section; pinned/edited items elsewhere survive via mergeRegen.
r.post("/:id/regenerate", asyncHandler(async (req: any, res) => {
  const s = scopeSchema.safeParse(req.body?.scope);
  if (!s.success) return res.status(400).json({ code: "VALIDATION", message: s.error.message });
  const match = parseIfMatch(req.headers["if-match"]);
  if (match == null) {
    return res.status(428).json({ code: "VALIDATION", message: "If-Match version required" });
  }
  const k: any = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  if (match !== k.version) {
    return res.status(409).json({ code: "VALIDATION", message: "stale version; refetch and re-apply", kit: k });
  }
  if (!k.kit) return res.status(409).json({ code: "VALIDATION", message: "kit not ready yet" });

  const ctx = k.context || { hiring: "", discText: "", crawlText: "" };
  const reqs = k.kit.role?.requirements || [];
  const fresh: any = {};
  try {
    if (s.data.type === "brief") {
      const b = await generateBrief(ctx.crawlText || "", k.kit.source?.company || "Company");
      fresh.company_brief = { summary: b.summary, what_they_do: b.what_they_do, sources: k.kit.company_brief?.sources || [] };
    } else if (s.data.type === "category") {
      const cat = s.data.category as Category;
      fresh.questions = await generateCategory(cat, reqs, ctx.hiring || "", ctx.discText || "", 0);
      fresh.questions = fresh.questions.map((q: any) => ({ ...q, category: cat }));
    } else {
      // Variant from version so each Regenerate actually re-rolls day buckets
      // (allocateSchedule is deterministic on identical inputs).
      const daysAvail = k.kit.schedule?.days_available || k.days || 5;
      const variant = Math.max(1, Number(k.version) || 1);
      fresh.schedule = {
        days_available: daysAvail,
        days: allocateSchedule(daysAvail, k.kit.questions || [], reqs, variant),
      };
    }
  } catch (e: any) {
    return res.status(502).json({ code: e?.code || "LLM_INVALID_JSON", message: e?.message || "regen failed" });
  }

  const merged = mergeRegen(k.kit, fresh, s.data as any);
  // Category/schedule regen changes question membership - recompute coverage
  // so uncovered musts stay truthful (hand-edited flashcards are left alone).
  if (s.data.type === "category") {
    const reqs = merged.role?.requirements || [];
    const uncovered = findUncovered(reqs, merged.questions || []);
    const passes = Math.max(1, Number(merged.coverage?.passes) || 1);
    merged.coverage = { uncovered_requirement_ids: uncovered, passes };
  }
  const v = validateKit(stripForValidate(merged));
  if (!v.success) return res.status(502).json({ code: "SCHEMA_INVALID", message: v.error.message });
  // Atomic CAS on version so concurrent PATCH/regen cannot clobber.
  const updated = await Kit.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId, version: match },
    { $set: { kit: merged }, $inc: { version: 1 } },
    { new: true }
  );
  if (!updated) {
    const freshDoc = await Kit.findOne({ _id: req.params.id, owner: req.userId });
    if (!freshDoc) return res.status(404).json({ code: "VALIDATION", message: "not found" });
    return res.status(409).json({ code: "VALIDATION", message: "stale version; refetch and re-apply", kit: freshDoc });
  }
  res.json(updated);
}));

function stripForValidate(kit: any) {
  return JSON.parse(JSON.stringify(kit, (key, val) => (key === "_meta" ? undefined : val)));
}

export default r;
