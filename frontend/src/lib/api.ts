import type {
  AuthUser,
  BatchResult,
  BriefSave,
  CreateKitResult,
  KitEnvelope,
  PracticeRecord,
  RegenScope,
  SessionUser,
  WeakSpotsReport,
} from "@/lib/types";

/** Structured API error: HTTP status + machine-readable body code. */
export class ApiError extends Error {
  status?: number;
  code?: string | number;
  kit?: KitEnvelope;

  constructor(
    message: string,
    opts: { status?: number; code?: string | number; kit?: KitEnvelope } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.kit = opts.kit;
  }
}

interface VersionedInit extends Omit<RequestInit, "headers"> {
  version?: number;
  headers?: Record<string, string>;
}

// Same-origin API client (Next rewrites /api/* -> Render, first-party cookies).
async function req<T>(path: string, init?: VersionedInit): Promise<T> {
  const { version, headers, ...rest } = init ?? {};
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  };
  if (version != null) {
    if (!Number.isInteger(version) || version < 1) {
      throw new ApiError("Missing kit version for optimistic concurrency", {
        status: 428,
        code: "VALIDATION",
      });
    }
    // Custom header, NOT If-Match: Vercel's edge evaluates If-Match against
    // response ETags and turns successful saves into a plain-text 412.
    finalHeaders["X-Kits-Version"] = String(version);
  }

  const res = await fetch(path, { ...rest, headers: finalHeaders, credentials: "include" });

  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as Partial<KitEnvelope> & {
      message?: string;
    };
    throw new ApiError(body.message || "Stale version - refetch and re-apply", {
      status: 409,
      code: 409,
      kit: body as KitEnvelope,
    });
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(body.message || `Request failed: ${res.status}`, {
      status: res.status,
      code: body.code,
    });
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => req<SessionUser>("/api/auth/me"),
  login: (email: string, password: string) =>
    req<AuthUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    req<AuthUser>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  listKits: () => req<KitEnvelope[]>("/api/kits"),
  createKit: (jd: string, company_url: string, days: number) =>
    req<CreateKitResult>("/api/kits", {
      method: "POST",
      body: JSON.stringify({ jd, company_url, days }),
    }),
  getKit: (id: string) => req<KitEnvelope>(`/api/kits/${id}`),
  patchKit: (id: string, kit: unknown, version: number) =>
    req<KitEnvelope>(`/api/kits/${id}`, { method: "PATCH", body: JSON.stringify({ kit }), version }),
  regenerate: (id: string, scope: RegenScope, version: number) =>
    req<KitEnvelope>(`/api/kits/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ scope }),
      version,
    }),
  batch: (items: { jd: string; company_url: string; days: number }[]) =>
    req<BatchResult>("/api/kits/batch", { method: "POST", body: JSON.stringify({ items }) }),
  recordPractice: (id: string, cardId: string, confidence: number) =>
    req<{ ok?: boolean }>(`/api/kits/${id}/practice`, {
      method: "POST",
      body: JSON.stringify({ cardId, confidence }),
    }),
  practiceProgress: (id: string) => req<PracticeRecord>(`/api/kits/${id}/practice`),
  weakSpots: (id: string) =>
    req<WeakSpotsReport>(`/api/kits/${id}/weak-spots`, { cache: "no-store" }),
};

export type { BriefSave };
