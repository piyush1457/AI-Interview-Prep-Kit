import { describe, it, expect } from "vitest";
import { dedupeHash } from "@ai-prep/kit-schema";

describe("dedupeHash (server-side, no client key needed)", () => {
  it("is deterministic for identical inputs", () => {
    const a = dedupeHash("u1", "Senior Dev\nNode", "https://acme.com", 5);
    const b = dedupeHash("u1", "Senior Dev\nNode", "https://acme.com", 5);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizes case/whitespace (same posting, different paste)", () => {
    const a = dedupeHash("u1", "Senior   Dev", "https://ACME.com/", 5);
    const b = dedupeHash("u1", "senior dev", "https://acme.com/", 5);
    expect(a).toBe(b);
  });

  it("differs across user, jd, url, or days", () => {
    const base = dedupeHash("u1", "jd", "https://a.com", 5);
    expect(dedupeHash("u2", "jd", "https://a.com", 5)).not.toBe(base);
    expect(dedupeHash("u1", "jd!", "https://a.com", 5)).not.toBe(base);
    expect(dedupeHash("u1", "jd", "https://b.com", 5)).not.toBe(base);
    expect(dedupeHash("u1", "jd", "https://a.com", 6)).not.toBe(base);
  });
});
