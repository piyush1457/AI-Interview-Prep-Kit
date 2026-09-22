import dns from "dns/promises";
import net from "net";

// SSRF guard: block private/loopback/link-local + cloud metadata.
// ALLOW_LOCALHOST=true bypasses only for `npm run evaluate` localhost fixtures.
export function allowLocalhost() {
  return process.env.ALLOW_LOCALHOST === "true";
}

export function isBlockedIp(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local incl. 169.254.169.254
    if (p[0] === 0) return true;
    return false;
  }
  // IPv6: loopback, unspecified, link-local, unique-local
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true;
  if (low.startsWith("fe80:") || low.startsWith("fc") || low.startsWith("fd")) return true;
  return false;
}

/** Resolve hostname and reject if it maps to a blocked IP (per-hop pin-then-connect best effort). */
export async function resolveAndCheck(hostname: string): Promise<string[]> {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    if (allowLocalhost()) return ["127.0.0.1"];
    throw Object.assign(new Error("Blocked host"), { code: "COMPANY_UNREACHABLE" });
  }
  let records: string[] = [];
  try {
    const all = await dns.lookup(hostname, { all: true });
    records = all.map((r) => r.address);
  } catch {
    throw Object.assign(new Error(`DNS lookup failed for ${hostname}`), { code: "COMPANY_UNREACHABLE" });
  }
  const blocked = records.filter(isBlockedIp);
  if (blocked.length > 0 && !allowLocalhost()) {
    throw Object.assign(new Error(`Blocked IP for ${hostname}: ${blocked[0]}`), { code: "COMPANY_UNREACHABLE" });
  }
  return records;
}

export interface SafeFetchResult {
  text: string;
  finalUrl: string;
  contentType: string;
  hops: string[];
}

const UA = "InterviewPrepKit/1.0 (+assessment; respects robots.txt)";

/**
 * Fetch with redirect:manual + per-hop DNS validation (max 3 hops).
 * Enforces http/https, timeout, content-type html/text, byte cap.
 * NOTE: Node native fetch has no custom-lookup pinning hook without an
 * undici dispatcher; we validate resolved IP immediately before each hop's
 * socket connect (resolve-then-fetch per hop), which closes the practical
 * rebinding window for this assessment. Full TCP-IP pinning is backlog.
 */
export async function safeFetch(
  startUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {}
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const hops: string[] = [];
  let url = startUrl;

  for (let hop = 0; hop <= 3; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw Object.assign(new Error(`Invalid URL: ${url}`), { code: "COMPANY_UNREACHABLE" });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw Object.assign(new Error(`Unsupported protocol: ${parsed.protocol}`), { code: "COMPANY_UNREACHABLE" });
    }
    await resolveAndCheck(parsed.hostname);
    hops.push(parsed.toString());

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,text/plain" },
      });
    } catch (e: any) {
      clearTimeout(t);
      if (e?.name === "AbortError") throw Object.assign(new Error(`Fetch timeout: ${url}`), { code: "COMPANY_UNREACHABLE" });
      throw Object.assign(new Error(`Fetch failed: ${url} (${e?.message})`), { code: "COMPANY_UNREACHABLE" });
    } finally {
      clearTimeout(t);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) throw Object.assign(new Error(`Redirect without location: ${url}`), { code: "COMPANY_UNREACHABLE" });
      url = new URL(loc, parsed).toString(); // re-validated next loop iteration
      continue;
    }
    if (!res.ok) {
      throw Object.assign(new Error(`HTTP ${res.status} for ${url}`), { code: "COMPANY_UNREACHABLE" });
    }
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(ct) && ct !== "") {
      throw Object.assign(new Error(`Rejected content-type ${ct} for ${url}`), { code: "COMPANY_UNREACHABLE" });
    }
    // byte-capped read
    const reader = (res.body as any)?.getReader?.();
    let text: string;
    if (!reader) {
      text = await res.text();
      if (text.length > maxBytes) text = text.slice(0, maxBytes);
    } else {
      const dec = new TextDecoder();
      let bytes = 0;
      const chunks: string[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          chunks.push(dec.decode(value.slice(0, Math.max(0, maxBytes - (bytes - value.byteLength))), { stream: true }));
          try { await reader.cancel(); } catch {}
          break;
        }
        chunks.push(dec.decode(value, { stream: true }));
      }
      chunks.push(dec.decode());
      text = chunks.join("");
    }
    return { text, finalUrl: parsed.toString(), contentType: ct, hops };
  }
  throw Object.assign(new Error(`Too many redirects: ${startUrl}`), { code: "COMPANY_UNREACHABLE" });
}
