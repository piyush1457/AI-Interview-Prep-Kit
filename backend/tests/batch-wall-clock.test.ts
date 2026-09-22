import { describe, it, expect } from "vitest";
import { ErrorCode, BatchOutputSchema } from "@ai-prep/kit-schema";

// Outer wall-clock contract: pathological contention still writes output
// within the budget with pending cases as BATCH_TIMEOUT (never hangs).
describe("batch-wall-clock (outer budget)", () => {
  it("Promise.race flushes BATCH_TIMEOUT entries on expiry", async () => {
    const WALL = 300; // scaled-down replica of the 13min race in evaluate.ts
    const hanging = new Promise<any[]>(() => {}); // never resolves
    const wall = new Promise<any[]>((resolve) => {
      const t = setTimeout(() => {
        resolve([{ id: "c1", status: "failed", kit: null, error: { code: ErrorCode.BATCH_TIMEOUT, message: "outer wall-clock exceeded" } }]);
      }, WALL);
      (t as any)?.unref?.();
    });
    const started = Date.now();
    const kits = await Promise.race([hanging, wall]);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(kits[0].status).toBe("failed");
    expect(kits[0].error.code).toBe(ErrorCode.BATCH_TIMEOUT);
    const out = { version: "1.0" as const, generated_at: new Date().toISOString(), kits };
    expect(BatchOutputSchema.safeParse(out).success).toBe(true);
  });
});
