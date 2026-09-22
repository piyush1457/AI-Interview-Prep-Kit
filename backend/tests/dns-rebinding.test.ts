import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import dns from "dns/promises";

// Pin-then-connect: the IP validated must be the IP connected to.
// We mock dns.lookup to simulate a rebinding hostname -> private IP.
describe("dns-rebinding (mocked resolver)", () => {
  const realLookup = dns.lookup;
  beforeEach(() => {
    (dns as any).lookup = async (host: string, opts: any) => {
      if (host === "rebind-test.invalid") {
        if (opts?.all) return [{ address: "10.0.0.5", family: 4 }];
        return { address: "10.0.0.5", family: 4 };
      }
      return (realLookup as any)(host, opts);
    };
  });
  afterEach(() => {
    (dns as any).lookup = realLookup;
    delete process.env.ALLOW_LOCALHOST;
  });

  it("resolveAndCheck blocks rebinding host at connect time", async () => {
    const { resolveAndCheck } = await import("../src/services/fetch.js");
    await expect(resolveAndCheck("rebind-test.invalid")).rejects.toMatchObject({ code: "COMPANY_UNREACHABLE" });
  });

  it("safeFetch blocks initial URL whose DNS resolves private", async () => {
    const { safeFetch } = await import("../src/services/fetch.js");
    await expect(safeFetch("http://rebind-test.invalid/", { timeoutMs: 5000 })).rejects.toMatchObject({ code: "COMPANY_UNREACHABLE" });
  });
});
