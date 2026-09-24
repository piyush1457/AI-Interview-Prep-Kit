import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";

// Ownership isolation + optimistic concurrency on PATCH/GET.
vi.mock("../src/middleware/owner.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = "owner-1"; next(); },
}));
vi.mock("../src/models/Kit.js", () => ({
  Kit: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), find: vi.fn() },
}));
vi.mock("../src/models/Job.js", () => ({
  Job: { create: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock("../src/services/runPipeline.js", () => ({
  runPipeline: vi.fn(),
}));

import { Kit } from "../src/models/Kit.js";
import kits from "../src/routes/kits.js";
import { parseIfMatch, parseVersionHeader, sanitizePatchMeta } from "../src/routes/kits.js";

function app() {
  const a = express();
  a.use(express.json({ limit: "1mb" }));
  a.use("/api/kits", kits);
  a.use((err: any, _req: any, res: any, _next: any) => {
    res.status(500).json({ code: err?.code || "SCHEMA_INVALID", message: err?.message });
  });
  return a;
}

const minimalKit = () => ({
  source: { company: "Acme", company_url: "https://a.com", role: "Dev", location: "", jd_chars: 10, researched_at: new Date().toISOString(), pages_used: [] },
  company_brief: { summary: "s", what_they_do: "w", sources: [] },
  role: { title: "Dev", seniority: "", responsibilities: [], requirements: [{ id: "r1", text: "Go", kind: "technical", priority: "must" }] },
  questions: [{ id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 }],
  flashcards: [{ id: "f1", front: "p", back: "a", requirement_ids: ["r1"] }],
  schedule: { days_available: 3, days: [{ day: 1, focus: "f", question_ids: ["q1"], minutes: 45 }] },
  coverage: { uncovered_requirement_ids: [], passes: 1 },
});

describe("kits ownership + concurrency", () => {
  let server: any;
  let base = "";
  beforeEach(async () => {
    vi.clearAllMocks();
    const a = app();
    await new Promise<void>((r) => { server = a.listen(0, "127.0.0.1", () => r()); });
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterEach(async () => { await new Promise<void>((r) => server.close(() => r())); });

  it("GET /:id only finds kits owned by the session user", async () => {
    (Kit.findOne as any).mockResolvedValue(null);
    const res = await fetch(`${base}/api/kits/some-id`);
    expect(res.status).toBe(404);
    expect(Kit.findOne).toHaveBeenCalledWith({ _id: "some-id", owner: "owner-1" });
  });

  it("PATCH without version header returns 428", async () => {
    const res = await fetch(`${base}/api/kits/k1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kit: minimalKit() }),
    });
    expect(res.status).toBe(428);
    expect(((await res.json()) as any).code).toBe("VALIDATION");
    expect(Kit.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("PATCH with stale X-Kits-Version returns 409 + fresh doc, does not write", async () => {
    (Kit.findOneAndUpdate as any).mockResolvedValue(null);
    (Kit.findOne as any).mockResolvedValue({ _id: "k1", version: 9, kit: minimalKit() });
    const res = await fetch(`${base}/api/kits/k1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Kits-Version": "3" },
      body: JSON.stringify({ kit: minimalKit() }),
    });
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body.message).toContain("stale");
    expect(body.kit.version).toBe(9);
    // CAS filter included owner + expected version
    expect(Kit.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "k1", owner: "owner-1", version: 3 }),
      expect.anything(),
      expect.anything()
    );
  });

  it("PATCH with matching X-Kits-Version writes atomically and bumps version", async () => {
    const saved = { _id: "k1", version: 4, kit: minimalKit() };
    (Kit.findOneAndUpdate as any).mockResolvedValue(saved);
    const res = await fetch(`${base}/api/kits/k1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Kits-Version": "3" },
      body: JSON.stringify({ kit: minimalKit() }),
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.version).toBe(4);
    expect(Kit.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "k1", owner: "owner-1", version: 3 },
      { $set: expect.anything(), $inc: { version: 1 } },
      { new: true }
    );
  });

  it("PATCH rejects unknown kit body", async () => {
    const res = await fetch(`${base}/api/kits/k1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Kits-Version": "1" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH accepts legacy If-Match header as version fallback", async () => {
    const saved = { _id: "k1", version: 4, kit: minimalKit() };
    (Kit.findOneAndUpdate as any).mockResolvedValue(saved);
    const res = await fetch(`${base}/api/kits/k1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "3" },
      body: JSON.stringify({ kit: minimalKit() }),
    });
    expect(res.status).toBe(200);
    expect(Kit.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "k1", owner: "owner-1", version: 3 },
      expect.anything(),
      expect.anything()
    );
  });
});

describe("parseIfMatch", () => {
  it("accepts positive integers only", () => {
    expect(parseIfMatch("3")).toBe(3);
    expect(parseIfMatch(3)).toBe(3);
    expect(parseIfMatch(undefined)).toBeNull();
    expect(parseIfMatch("")).toBeNull();
    expect(parseIfMatch("abc")).toBeNull();
    expect(parseIfMatch("0")).toBeNull();
    expect(parseIfMatch("-1")).toBeNull();
    expect(parseIfMatch("1.5")).toBeNull();
    expect(parseIfMatch(NaN)).toBeNull();
  });
});

describe("parseVersionHeader", () => {
  it("prefers X-Kits-Version, falls back to If-Match", () => {
    expect(parseVersionHeader({ "x-kits-version": "7" })).toBe(7);
    expect(parseVersionHeader({ "if-match": "5" })).toBe(5);
    expect(parseVersionHeader({ "x-kits-version": "7", "if-match": "5" })).toBe(7);
    expect(parseVersionHeader({ "x-kits-version": "", "if-match": "5" })).toBe(5);
    expect(parseVersionHeader({})).toBeNull();
    expect(parseVersionHeader({ "x-kits-version": "abc", "if-match": "x" })).toBeNull();
  });
});

describe("sanitizePatchMeta", () => {
  it("keeps legal origins and repairs missing/invalid ones to edited", () => {
    const out = sanitizePatchMeta({
      questions: [
        { id: "q1", _meta: { origin: "generated" } },
        { id: "q2", _meta: { origin: "hacked" } },
        { id: "q3" },
      ],
      flashcards: [{ id: "f1", _meta: { origin: "pinned" } }],
      company_brief: { summary: "s" },
    });
    expect(out.questions[0]._meta.origin).toBe("generated");
    expect(out.questions[1]._meta.origin).toBe("edited");
    expect(out.questions[2]._meta.origin).toBe("edited");
    expect(out.flashcards[0]._meta.origin).toBe("pinned");
    expect(out.company_brief._meta.origin).toBe("edited");
  });
});
