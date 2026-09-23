import { Router } from "express";
import { z } from "zod";
import { validateKit } from "@ai-prep/kit-schema";
import { requireAuth } from "../middleware/owner.js";
import { Kit } from "../models/Kit.js";
import { generateBrief, generateCategory, type Category } from "../services/generation.js";
import { allocateSchedule } from "../services/scheduling.js";
import { mergeRegen } from "./kits.js";

const r = Router();
r.use(requireAuth);

const scopeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("brief") }),
  z.object({ type: z.literal("category"), category: z.enum(["technical", "behavioural", "system-design", "company-fit"]) }),
  z.object({ type: z.literal("schedule") }),
]);

// POST /api/kits/:id/regenerate {scope, If-Match: version}
// Regenerates ONE section; pinned/edited items elsewhere survive via mergeRegen.
r.post("/:id/regenerate", async (req: any, res) => {
  const s = scopeSchema.safeParse(req.body?.scope);
  if (!s.success) return res.status(400).json({ code: "VALIDATION", message: s.error.message });
  const match = Number(req.headers["if-match"]);
  const k: any = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  if (match && match !== k.version) {
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
      fresh.schedule = { days_available: k.kit.schedule?.days_available || k.days || 5, days: allocateSchedule(k.kit.schedule?.days_available || k.days || 5, k.kit.questions || [], reqs) };
    }
  } catch (e: any) {
    return res.status(502).json({ code: e?.code || "LLM_INVALID_JSON", message: e?.message || "regen failed" });
  }

  const merged = mergeRegen(k.kit, fresh, s.data as any);
  const v = validateKit(stripForValidate(merged));
  if (!v.success) return res.status(502).json({ code: "SCHEMA_INVALID", message: v.error.message });
  k.kit = merged;
  k.version += 1;
  await k.save();
  res.json(k);
});

function stripForValidate(kit: any) {
  return JSON.parse(JSON.stringify(kit, (key, val) => (key === "_meta" ? undefined : val)));
}

export default r;
