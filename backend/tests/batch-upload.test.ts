import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";

// In-app batch endpoint: caps enforced, row errors don't abort, fan-out reuses pipeline.
vi.mock("../src/middleware/owner.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.userId = "u1"; next(); },
}));
vi.mock("../src/models/Kit.js", () => ({
  Kit: { findOne: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock("../src/models/Job.js", () => ({
  Job: { create: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock("../src/services/runPipeline.js", () => ({
  runPipeline: vi.fn(async () => ({ kit: {}, warnings: [], context: {} })),
}));

import { Kit } from "../src/models/Kit.js";
import { Job } from "../src/models/Job.js";
import kitsBatch from "../src/routes/kitsBatch.js";

function app() {
  const a = express();
  a.use(express.json({ limit: "1mb" }));
  a.use("/api/kits", kitsBatch);
  return a;
}

describe("POST /api/kits/batch", () => {
  let server: any;
  let base = "";
  beforeEach(async () => {
    vi.clearAllMocks();
    (Kit.findOne as any).mockResolvedValue(null);
    (Kit.create as any).mockImplementation(async (d: any) => ({ _id: `k${Math.random()}`, ...d }));
    (Job.create as any).mockResolvedValue({ _id: "j1" });
    const a = app();
    await new Promise<void>((r) => { server = a.listen(0, "127.0.0.1", () => r()); });
    base = `http://127.0.0.1:${(server.address() as any).port}`;
  });
  afterEach(async () => { await new Promise<void>((r) => server.close(() => r())); });

  it("rejects >20 rows with VALIDATION", async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ jd: `jd ${i} long enough`, company_url: "https://a.com", days: 3 }));
    const res = await fetch(`${base}/api/kits/batch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).code).toBe("VALIDATION");
  });

  it("records row errors without aborting good rows", async () => {
    const res = await fetch(`${base}/api/kits/batch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ jd: "good jd here", company_url: "https://a.com", days: 3 }, { jd: "", company_url: "x", days: 99 }] }),
    });
    expect(res.status).toBe(202);
    const body: any = await res.json();
    expect(body.kitIds).toHaveLength(1);
    expect(body.rowErrors).toHaveLength(1);
    expect(body.rowErrors[0].index).toBe(1);
  });

  it("returns existing kit on dedupe instead of creating", async () => {
    (Kit.findOne as any).mockResolvedValue({ _id: "existing" });
    const res = await fetch(`${base}/api/kits/batch`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ jd: "same jd", company_url: "https://a.com", days: 3 }] }),
    });
    const body: any = await res.json();
    expect(body.kitIds).toEqual(["existing"]);
    expect(Kit.create).not.toHaveBeenCalled();
  });
});
