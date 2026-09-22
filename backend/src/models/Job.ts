import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    kitId: { type: mongoose.Schema.Types.ObjectId, ref: "Kit", required: true },
    step: String,
    status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
    error: { code: String, message: String },
  },
  { timestamps: true }
);

export type JobDoc = mongoose.InferSchemaType<typeof jobSchema> & { _id: mongoose.Types.ObjectId };
export const Job = mongoose.model("Job", jobSchema);
