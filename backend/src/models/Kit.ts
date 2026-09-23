import mongoose from "mongoose";

const kitSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dedupeHash: { type: String, index: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
    steps: [{ step: String, at: Date }],
    // Full kit per Appendix A + _meta per item (version/origin)
    kit: { type: mongoose.Schema.Types.Mixed, default: null },
    // Regen context (NOT part of Appendix A; stripped from batch output)
    context: { type: mongoose.Schema.Types.Mixed, default: null },
    // Research/generation warnings (NO_HIRING_PAGE, crawl errors, etc.) - shown in UI
    warnings: { type: [String], default: [] },
    practice: [{ cardId: String, confidence: Number, at: Date }],
    // raw inputs for dedupe/debug
    jd: String,
    company_url: String,
    days: Number,
    error: { code: String, message: String },
  },
  { timestamps: true }
);

// Unique per user+payload for app; CLI bypasses this check (bypassDedupe)
kitSchema.index({ owner: 1, dedupeHash: 1 }, { unique: true, sparse: true });

export type KitDoc = mongoose.InferSchemaType<typeof kitSchema> & { _id: mongoose.Types.ObjectId };
export const Kit = mongoose.model("Kit", kitSchema);
