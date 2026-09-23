import { Router } from "express";
import { requireAuth } from "../middleware/owner.js";
import { Kit } from "../models/Kit.js";

const r = Router();
r.use(requireAuth);

// GET /api/kits/:id/weak-spots — creative feature: low-confidence cards + uncovered musts.
r.get("/:id/weak-spots", async (req: any, res) => {
  const k: any = await Kit.findOne({ _id: req.params.id, owner: req.userId });
  if (!k) return res.status(404).json({ code: "VALIDATION", message: "not found" });
  const conf = new Map<string, number>((k.practice || []).map((x: any) => [x.cardId, x.confidence]));
  const cards = k.kit?.flashcards || [];
  const low = cards.filter((c: any) => (conf.get(c.id) ?? 0) <= 1);
  const uncoveredMusts: string[] = k.kit?.coverage?.uncovered_requirement_ids || [];
  const reqText = new Map((k.kit?.role?.requirements || []).map((x: any) => [x.id, x.text]));
  const focusDays = (k.kit?.schedule?.days || [])
    .filter((d: any) => (d.question_ids || []).some((qid: string) => {
      const q = (k.kit?.questions || []).find((qq: any) => qq.id === qid);
      return q && (q.requirement_ids || []).some((rid: string) => uncoveredMusts.includes(rid));
    }))
    .map((d: any) => d.day);
  res.json({
    lowConfidenceCards: low.map((c: any) => ({ id: c.id, front: c.front, confidence: conf.get(c.id) ?? 0 })),
    uncoveredMusts: uncoveredMusts.map((id: string) => ({ id, text: reqText.get(id) || id })),
    suggestedDays: focusDays,
    summary: low.length === 0 && uncoveredMusts.length === 0
      ? "No weak spots — all must-haves covered and confidence is solid."
      : `${low.length} shaky card(s), ${uncoveredMusts.length} uncovered must-have(s). Revisit days ${focusDays.join(", ") || "—"}.`,
  });
});

export default r;
