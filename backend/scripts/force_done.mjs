// Dev-only: force a kit to done with a minimal payload for local UI smoke.
// node --import tsx scripts/force_done.mjs <kitId>
import "dotenv/config";
import mongoose from "mongoose";

const kitId = process.argv[2];
if (!kitId) {
  console.error("usage: node --import tsx scripts/force_done.mjs <kitId>");
  process.exit(1);
}

const Kit = mongoose.model(
  "Kit",
  new mongoose.Schema({}, { strict: false, timestamps: true })
);

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI missing");
  process.exit(1);
}
await mongoose.connect(uri);
const payload = {
  role: {
    title: "Senior Frontend Engineer",
    seniority: "Senior",
    responsibilities: ["Ship UI"],
    requirements: [
      { id: "r1", text: "React", must: true },
      { id: "r2", text: "TypeScript", must: true },
    ],
  },
  source: { company: "example" },
  company_brief: {
    summary: "Example co",
    what_they_do: "Stuff",
    sources: [],
    _meta: { origin: "edited" },
  },
  schedule: { days_available: 5, days: [] },
  questions: [
    {
      id: "q1",
      category: "technical",
      prompt: "Explain hooks",
      answer_outline: "a",
      difficulty: 2,
      requirement_ids: ["r1"],
      _meta: { origin: "generated" },
    },
  ],
  flashcards: [
    {
      id: "f1",
      front: "What is a closure?",
      back: "Scope + function",
      requirement_ids: ["r1"],
      _meta: { origin: "generated" },
    },
  ],
  coverage: { uncovered_requirement_ids: [], passes: 1 },
};

const r = await Kit.findByIdAndUpdate(kitId, {
  $set: {
    status: "done",
    kit: payload,
    warnings: ["NO_HIRING_PAGE: no public hiring page found."],
    steps: [
      { step: "queued", at: new Date() },
      { step: "extracting", at: new Date() },
      { step: "crawling", at: new Date() },
      { step: "generating", at: new Date() },
      { step: "done", at: new Date() },
    ],
  },
  $inc: { version: 1 },
});
console.log(r ? `ok kit=${kitId}` : "not found");
await mongoose.disconnect();
