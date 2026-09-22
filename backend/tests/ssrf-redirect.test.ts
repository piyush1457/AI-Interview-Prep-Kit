import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { safeFetch, resolveAndCheck } from "../src/services/fetch.js";
import { startStub } from "./stub.js";

describe("SSRF: direct + redirect hops blocked", () => {
  let base = "";
  let close = async () => {};
  beforeAll(async () => {
    process.env.ALLOW_LOCALHOST = "true";
    const s = await startStub();
    base = s.base;
    close = s.close;
  });
  afterAll(async () => {
    delete process.env.ALLOW_LOCALHOST;
    await close();
  });

  it("blocks direct private IPs", async () => {
    process.env.ALLOW_LOCALHOST = "false";
    await expect(safeFetch("http://192.168.1.1/")).rejects.toMatchObject({ code: "COMPANY_UNREACHABLE" });
    await expect(safeFetch("http://169.254.169.254/")).rejects.toMatchObject({ code: "COMPANY_UNREACHABLE" });
    process.env.ALLOW_LOCALHOST = "true";
  });

  it("blocks 302 redirect to metadata IP on the hop", async () => {
    await expect(safeFetch(`${base}/redirect-private`, { timeoutMs: 8000 })).rejects.toMatchObject({ code: "COMPANY_UNREACHABLE" });
  });

  it("allows the stub origin itself with ALLOW_LOCALHOST", async () => {
    const r = await safeFetch(`${base}/about`, { timeoutMs: 8000 });
    expect(r.text).toContain("Acme");
    expect(r.hops.length).toBeGreaterThanOrEqual(1);
  });

  it("resolveAndCheck rejects private-resolved hosts", async () => {
    process.env.ALLOW_LOCALHOST = "false";
    await expect(resolveAndCheck("169.254.169.254")).rejects.toMatchObject({ code: "COMPANY_UNREACHABLE" });
    process.env.ALLOW_LOCALHOST = "true";
  });
});
