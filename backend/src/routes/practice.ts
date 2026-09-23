import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/owner.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { Kit } from "../models/Kit.js";

const r = Router();
r.use(requireAuth);

const recordSchema = z.object({ cardId: z.string().min(1), confidence: z.number().int().min(1).max(3) });

// POST /api/kits/:id/practice {cardId, confidence 1-3}
r.post("/:id/practice", asyncHandler(async (req: any, res) => {
  const p = recordSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ code: "VALIDATION", message: p.error.message });
  const k: any = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  k.practice = [...(k.practice || []).filter((x: any) => x.cardId !== p.data.cardId), { ...p.data, at: new Date() }];
  await k.save();
  res.json({ ok: true, progress: progressOf(k) });
}));

r.get("/:id/practice", asyncHandler(async (req: any, res) => {
  const k: any = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  res.json(progressOf(k));
}));

// Least-confident-first ordering (defended in README vs full SM-2: transparent + timebox).
export function progressOf(k: any) {
  const cards = k.kit?.flashcards || [];
  const conf = new Map<string, number>((k.practice || []).map((x: any) => [x.cardId, x.confidence]));
  const ordered = [...cards].sort((a: any, b: any) => (conf.get(a.id) ?? 0) - (conf.get(b.id) ?? 0));
  const covered = cards.filter((c: any) => conf.has(c.id)).length;
  return {
    total: cards.length,
    covered,
    uncovered: cards.length - covered,
    nextQueue: ordered.map((c: any) => c.id),
    confidence: Object.fromEntries(conf),
  };
}

export default r;
